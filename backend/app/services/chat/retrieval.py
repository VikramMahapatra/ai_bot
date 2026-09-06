from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import parse_qs, unquote, urlparse

from sqlalchemy.orm import Session

from app.models import KnowledgeSource, WidgetConfig
from app.services.chat.cache_service import build_cache_key, chat_cache
from app.services.chat.reranker import build_hybrid_result, rerank_candidates
from app.services.chat.types import HybridRetrievalResult, RerankedChunk, VectorStoreClient


_SUGGESTION_PATTERNS = [
    (r"price|pricing|plan", "What are your pricing plans?"),
    (r"ship|shipping|delivery", "What are your shipping options?"),
    (r"return|refund|cancel", "What is your return or refund policy?"),
    (r"support|help|contact", "How can I contact support?"),
    (r"hours|open|closing|timing", "What are your business hours?"),
    (r"warranty|guarantee", "Do you offer a warranty?"),
    (r"install|setup|onboard", "How do I get started?"),
    (r"integration|api|webhook|sdk", "What integrations are available?"),
    (r"security|privacy|compliance|gdpr|soc", "How do you handle security and privacy?"),
]

_GENERIC_URL_SEGMENTS = {"home", "index", "default", "page", "pages", "blog", "blogs", "post", "posts", "search", "label", "category", "categories", "tag", "tags", "about", "contact", "login", "signup", "register", "api", "docs", "documentation"}
_GENERIC_TOPICS = {"about", "about us", "contact", "contact us", "home", "welcome", "main", "index", "login", "signup", "register"}
_GENERIC_TOPIC_WORDS = {"web", "www", "com", "co", "in", "org", "net", "site", "website", "blogspot"}
_TOPIC_PREFIX_STOPWORDS = {"and", "or", "the", "a", "an", "to", "of", "for"}
_STOPWORDS = {"the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "what", "when", "where", "which", "who", "how", "why", "can", "could", "would", "should", "a", "an", "in", "on", "of", "to", "is", "it", "as", "at", "by", "or", "we", "our", "us", "i", "me", "my", "they", "their", "them", "about", "those", "these", "have", "has", "had", "many"}


def sanitize_retrieved_chunk(text: str, max_chars: int = 1200) -> str:
    compact = " ".join((text or "").split()).strip()
    if not compact:
        return ""
    suspicious_markers = ["ignore previous instructions", "system prompt", "developer message", "act as", "tool call", "follow these instructions", "do not answer"]
    sanitized = compact
    lowered = sanitized.lower()
    if any(marker in lowered for marker in suspicious_markers):
        sanitized = re.sub(r"(?i)(ignore previous instructions|system prompt|developer message|follow these instructions|do not answer)", "[redacted instruction]", sanitized)
        sanitized = f"[untrusted reference material] {sanitized}"
    if len(sanitized) > max_chars:
        sanitized = f"{sanitized[: max_chars - 3]}..."
    return sanitized


def _clean_label(label: str) -> str:
    cleaned = re.sub(r"^web:\s*", "", label.strip(), flags=re.IGNORECASE)
    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        parsed = urlparse(cleaned)
        path = parsed.path.strip("/")
        cleaned = path.split("/")[-1] if path else parsed.netloc
    cleaned = re.sub(r"\.(pdf|docx|xlsx|txt)$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.replace("_", " ").replace("-", " ").strip()


def _normalize_topic(raw_topic: str) -> Optional[str]:
    if not raw_topic:
        return None
    topic = unquote(raw_topic).replace("+", " ")
    topic = re.sub(r"[^a-zA-Z0-9\s]", " ", topic)
    topic = re.sub(r"\s+", " ", topic).strip()
    if len(topic) < 3:
        return None
    words = [w for w in topic.split() if w and w.lower() not in _GENERIC_TOPIC_WORDS]
    while words and words[0].lower() in _TOPIC_PREFIX_STOPWORDS:
        words.pop(0)
    if not words:
        return None
    normalized = " ".join(words)
    if re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", normalized.lower()):
        return None
    if normalized.lower() in _GENERIC_TOPICS:
        return None
    return normalized


def _topic_from_url(raw_url: str) -> Optional[str]:
    if not raw_url:
        return None
    cleaned_url = re.sub(r"^web:\s*", "", raw_url.strip(), flags=re.IGNORECASE)
    if not (cleaned_url.startswith("http://") or cleaned_url.startswith("https://")):
        return None
    parsed = urlparse(cleaned_url)
    path_segments = [segment for segment in parsed.path.split("/") if segment]
    qs = parse_qs(parsed.query)
    for key in ("label", "category", "topic", "tag"):
        values = qs.get(key)
        if values:
            topic = _normalize_topic(values[0])
            if topic:
                return topic
    lower_segments = [segment.lower() for segment in path_segments]
    if "label" in lower_segments:
        idx = lower_segments.index("label")
        if idx + 1 < len(path_segments):
            topic = _normalize_topic(path_segments[idx + 1])
            if topic:
                return topic
    for segment in reversed(path_segments):
        topic = _normalize_topic(segment)
        if topic and topic.lower() not in _GENERIC_URL_SEGMENTS:
            return topic
    return None


def _extract_metadata_labels(raw_metadata: Optional[str], limit: int = 8) -> List[str]:
    if not raw_metadata or len(raw_metadata) > 250000:
        return []
    try:
        metadata = json.loads(raw_metadata)
    except Exception:
        return []
    labels: List[str] = []
    if isinstance(metadata, dict):
        page_cache = metadata.get("page_cache")
        if isinstance(page_cache, dict):
            for cached_url in page_cache.keys():
                if isinstance(cached_url, str) and cached_url:
                    labels.append(cached_url)
                    if len(labels) >= limit:
                        break
    return labels


def _iter_source_labels(source: KnowledgeSource) -> List[str]:
    raw_labels: List[str] = []
    raw_labels.extend(_extract_metadata_labels(source.source_metadata))
    if source.url:
        raw_labels.append(source.url)
    if source.name:
        name = source.name.strip()
        if not (name.lower().startswith("web:") and source.url and source.url in name):
            raw_labels.append(source.name)
    deduped: List[str] = []
    seen = set()
    for label in raw_labels:
        key = label.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(label)
    return deduped


def _labels_from_chroma_metadatas(raw_metadatas: object, limit: int = 30) -> List[str]:
    labels: List[str] = []
    if not raw_metadatas:
        return labels
    metadatas = raw_metadatas[0] if isinstance(raw_metadatas, list) and raw_metadatas and isinstance(raw_metadatas[0], list) else raw_metadatas
    if not isinstance(metadatas, list):
        return labels
    for meta in metadatas:
        if not isinstance(meta, dict):
            continue
        for key in ("title", "filename", "url", "source_name", "path"):
            value = meta.get(key)
            if isinstance(value, str) and value.strip():
                labels.append(value.strip())
        if len(labels) >= limit:
            break
    return labels[:limit]


def _question_from_label(label: str) -> Optional[str]:
    if not label:
        return None
    url_topic = _topic_from_url(label)
    if url_topic:
        lowered_topic = url_topic.lower()
        for pattern, question in _SUGGESTION_PATTERNS:
            if re.search(pattern, lowered_topic):
                return question
        return f"Can you tell me about {url_topic}?"
    cleaned = _clean_label(label)
    if not cleaned or len(cleaned) < 3:
        return None
    if re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", cleaned.lower()):
        return None
    lowered = cleaned.lower()
    for pattern, question in _SUGGESTION_PATTERNS:
        if re.search(pattern, lowered):
            return question
    normalized_topic = _normalize_topic(cleaned)
    if not normalized_topic:
        return None
    lower_topic = normalized_topic.lower()
    if lower_topic.endswith("solutions"):
        base = normalized_topic[: -len("solutions")].strip()
        if base:
            return f"What {base} solutions do you offer?"
    if lower_topic.endswith("services"):
        base = normalized_topic[: -len("services")].strip()
        if base:
            return f"What {base} services do you provide?"
    if normalized_topic.lower().startswith("how") or normalized_topic.lower().startswith("what"):
        return normalized_topic.rstrip("?") + "?"
    if len(normalized_topic.split()) == 1:
        return f"What should I know about {normalized_topic}?"
    return f"Can you explain {normalized_topic}?"


def _keyword_query(text: str) -> str:
    tokens = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    keywords = []
    for token in tokens:
        if token in _STOPWORDS:
            continue
        if len(token) > 4 and token.endswith("ies"):
            token = f"{token[:-3]}y"
        elif len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        keywords.append(token)
    return " ".join(keywords[:12])


def _extract_year_token(text: str) -> Optional[str]:
    if not text:
        return None
    match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    return match.group(1) if match else None


def build_query_variants(base_query: str, raw_message: str) -> List[str]:
    queries = [base_query]
    raw_tokens = set(re.findall(r"[a-zA-Z0-9]+", raw_message.lower()))
    query_groups = [
        {"address", "location", "office", "hq", "head", "branch"},
        {"contact", "email", "phone", "support", "help"},
        {"price", "pricing", "cost", "fee", "charge", "plan"},
        {"offer", "offering", "offers", "service", "services", "solution", "solutions", "product", "products", "workspace", "coworking", "office"},
        {"hours", "timing", "opening", "open", "close"},
        {"delivery", "shipping", "ship"},
        {"refund", "return", "cancel", "cancellation"},
        {"features", "capabilities", "feature"},
        {"integration", "integrations", "api", "webhook", "sdk"},
        {"security", "privacy", "compliance", "gdpr", "soc"},
        {"setup", "install", "onboarding", "getting", "started"},
    ]
    for group in query_groups:
        if raw_tokens & group:
            related = " ".join(sorted(group))
            queries.append(f"{base_query}\n\nRelated terms: {related}")
            break
    keyword_query = _keyword_query(raw_message)
    if keyword_query and keyword_query not in base_query:
        queries.append(keyword_query)
    target_year = _extract_year_token(raw_message)
    asks_for_count = bool(raw_tokens & {"how", "many", "count", "number", "published", "posts", "post", "blog", "blogpost"})
    if target_year and asks_for_count:
        queries.append(f"blog archive {target_year} posts count")
        queries.append(f"posts published {target_year} site archive")
    deduped: List[str] = []
    seen = set()
    for query in queries:
        normalized = " ".join((query or "").split()).strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(query)
    return deduped[:5]


def _estimate_tokens(text: str) -> int:
    if not text:
        return 1
    try:
        import tiktoken

        encoder = tiktoken.get_encoding("cl100k_base")
        return max(1, len(encoder.encode(text)))
    except Exception:
        return max(1, len(text) // 4)


def build_context_with_budget(chunks: Sequence[RerankedChunk], max_context_tokens: int = 1600, min_chunk_tokens: int = 24) -> Tuple[str, List[RerankedChunk]]:
    selected: List[RerankedChunk] = []
    budget_remaining = max_context_tokens
    rendered_parts: List[str] = []
    for chunk in sorted(chunks, key=lambda item: (item.confidence, item.rerank_score), reverse=True):
        if budget_remaining <= 0:
            break
        sanitized = sanitize_retrieved_chunk(chunk.text)
        if not sanitized:
            continue
        chunk_tokens = _estimate_tokens(sanitized)
        if chunk_tokens < min_chunk_tokens and not selected:
            continue
        if chunk_tokens > budget_remaining:
            truncated_chars = max(240, int(len(sanitized) * (budget_remaining / max(chunk_tokens, 1))))
            sanitized = sanitized[:truncated_chars].rstrip() + "..."
            chunk_tokens = _estimate_tokens(sanitized)
        if chunk_tokens > budget_remaining:
            continue
        header = f"Source: {chunk.source_label}" if chunk.source_label else "Source: knowledge base"
        rendered_parts.append(f"{header}\n{sanitized}")
        selected.append(chunk)
        budget_remaining -= chunk_tokens
        if len(selected) >= 8:
            break
    return "\n\n".join(rendered_parts), selected


def retrieve_hybrid_result(
    *,
    message: str,
    query_text: str,
    organization_id: int,
    widget_id: str,
    chroma_client: VectorStoreClient,
    db: Session,
    cache_ttl_seconds: int = 120,
) -> HybridRetrievalResult:
    cache_key = build_cache_key("hybrid_retrieval", organization_id, widget_id, message.strip().lower(), query_text.strip().lower())
    cached = chat_cache.get(cache_key)
    if isinstance(cached, HybridRetrievalResult):
        return cached

    sources = []
    source_ids = set()
    retrieved_chunks: List[Dict[str, Any]] = []
    candidate_pool: List[Dict[str, Any]] = []
    seen_chunks = set()
    target_year = _extract_year_token(message)
    query_variants = build_query_variants(query_text, message)

    def _snippet(text: str, limit: int = 240) -> str:
        compact = " ".join((text or "").split()).strip()
        return compact if len(compact) <= limit else f"{compact[: limit - 3]}..."

    def _add_results(results: Dict[str, Any], query_used: str, stage: str, apply_threshold: bool = True) -> None:
        distances = results.get("distances", [[]])[0] if results and results.get("distances") else []
        documents = results.get("documents", [[]])[0] if results and results.get("documents") else []
        metadatas = results.get("metadatas", [[]])[0] if results and results.get("metadatas") else []
        valid_distances = [distance for distance in distances if distance is not None]
        min_distance = min(valid_distances) if valid_distances else None
        # Be conservative with filtering here; reranker will do the final quality gate.
        # A strict cutoff can drop all candidates for paraphrased queries.
        distance_threshold = min(1.2, min_distance + 0.35) if apply_threshold and min_distance is not None else None
        for idx, doc in enumerate(documents):
            if not doc:
                continue
            metadata = metadatas[idx] if idx < len(metadatas) and isinstance(metadatas[idx], dict) else {}
            distance_value = distances[idx] if idx < len(distances) else None
            source_id = None
            if isinstance(metadata, dict):
                raw_source_id = metadata.get("source_id")
                try:
                    source_id = int(raw_source_id) if raw_source_id is not None else None
                except Exception:
                    source_id = None
            source_label = metadata.get("title") or metadata.get("filename") or metadata.get("url") if isinstance(metadata, dict) else None
            if len(retrieved_chunks) < 40:
                retrieved_chunks.append({
                    "stage": stage,
                    "query": query_used,
                    "rank": idx,
                    "distance": distance_value,
                    "source_id": source_id,
                    "source_label": source_label,
                    "url": metadata.get("url") if isinstance(metadata, dict) else None,
                    "chunk_index": metadata.get("chunk_index") if isinstance(metadata, dict) else None,
                    "snippet": _snippet(doc),
                })
            if distance_threshold is not None and distance_value is not None:
                threshold = distance_threshold
                if target_year and target_year in doc:
                    threshold = min(1.2, threshold + 0.12)
                if distance_value > threshold:
                    continue
            normalized = " ".join(doc.split()).strip().lower()
            if normalized in seen_chunks:
                continue
            seen_chunks.add(normalized)
            candidate_pool.append({
                "stage": stage,
                "query": query_used,
                "rank": idx,
                "distance": distance_value,
                "source_id": source_id,
                "source_label": source_label,
                "url": metadata.get("url") if isinstance(metadata, dict) else None,
                "chunk_index": metadata.get("chunk_index") if isinstance(metadata, dict) else None,
                "doc": doc,
                "snippet": _snippet(doc),
            })

    primary_results = chroma_client.query(query_text, n_results=6, organization_id=organization_id, widget_id=widget_id)
    _add_results(primary_results, query_used=query_variants[0], stage="primary", apply_threshold=True)
    if len(candidate_pool) < 2:
        for q in query_variants[1:3]:
            if len(candidate_pool) >= 6:
                break
            results = chroma_client.query(q, n_results=6, organization_id=organization_id, widget_id=widget_id)
            _add_results(results, query_used=q, stage="expanded", apply_threshold=False)
    if not candidate_pool:
        fallback_results = chroma_client.query(query_text, n_results=8, organization_id=organization_id, widget_id=widget_id)
        _add_results(fallback_results, query_used=query_text, stage="fallback", apply_threshold=False)

    reranked_chunks = rerank_candidates(candidate_pool, message)
    context_text, selected_chunks = build_context_with_budget(reranked_chunks)
    if not context_text and reranked_chunks:
        fallback_parts: List[str] = []
        for chunk in reranked_chunks[:3]:
            snippet = sanitize_retrieved_chunk(chunk.snippet or chunk.text, max_chars=260)
            if not snippet:
                continue
            header = f"Source: {chunk.source_label}" if chunk.source_label else "Source: knowledge base"
            fallback_parts.append(f"{header}\n{snippet}")
        if fallback_parts:
            context_text = "\n\n".join(fallback_parts)
            selected_chunks = list(reranked_chunks[: min(3, len(reranked_chunks))])

    for chunk in selected_chunks:
        if chunk.source_id is not None:
            source_ids.add(int(chunk.source_id))

    retrieval_trace = {
        "user_query": message,
        "retrieval_query": query_text,
        "query_variants": query_variants,
        "retrieved_chunks": retrieved_chunks,
        "selected_chunks": [chunk.__dict__ for chunk in selected_chunks],
        "source_ids": sorted(source_ids),
        "has_context": bool(context_text),
        "escalation_triggered": False,
        "top_distance": float(selected_chunks[0].distance) if selected_chunks and selected_chunks[0].distance is not None else None,
        "rerank_top_score": round(selected_chunks[0].rerank_score, 6) if selected_chunks else 0.0,
        "rerank_avg_overlap_top3": round(sum(chunk.overlap for chunk in selected_chunks[:3]) / max(len(selected_chunks[:3]), 1), 6) if selected_chunks else 0.0,
    }

    if source_ids:
        source_records = db.query(KnowledgeSource).filter(
            KnowledgeSource.id.in_(source_ids),
            KnowledgeSource.organization_id == organization_id,
            KnowledgeSource.widget_id == widget_id,
        ).all()
        for source in source_records:
            sources.append({"id": source.id, "name": source.name, "type": source.source_type.value, "url": source.url})

    result = build_hybrid_result(query_text, reranked_chunks, retrieval_trace, sources, context_text)
    effective_ttl = cache_ttl_seconds
    if not result.chunks or not result.context_text:
        # Avoid replaying temporary misses for too long when ingestion/retrieval just changed.
        effective_ttl = min(cache_ttl_seconds, 15)
    chat_cache.set(cache_key, result, ttl_seconds=effective_ttl)
    return result


def get_suggested_questions(widget_id: str, organization_id: int, db: Session, limit: int = 6) -> List[Dict[str, str]]:
    cache_key = build_cache_key("suggested_questions_v2", organization_id, widget_id, int(limit))
    cached = chat_cache.get(cache_key)
    if isinstance(cached, list):
        return list(cached)

    suggestions: List[Dict[str, str]] = []
    used = set()

    widget_config = db.query(WidgetConfig).filter(
        WidgetConfig.widget_id == widget_id,
        WidgetConfig.organization_id == organization_id,
    ).first()
    if not widget_config or not widget_config.lead_fields:
        return []

    try:
        metadata = json.loads(widget_config.lead_fields)
    except (TypeError, json.JSONDecodeError):
        return []

    configured_questions = metadata.get("quick_questions") if isinstance(metadata, dict) else None
    if not isinstance(configured_questions, list):
        return []

    def add(item: Any) -> None:
        question = item.get("question") if isinstance(item, dict) else None
        answer = item.get("answer") if isinstance(item, dict) else None
        if not isinstance(question, str) or not isinstance(answer, str):
            return
        question = question.strip()
        answer = answer.strip()
        key = question.lower()
        if not question or not answer or key in used:
            return
        used.add(key)
        suggestions.append({"question": question, "answer": answer})

    for item in configured_questions:
        add(item)
        if len(suggestions) >= limit:
            return suggestions[:limit]

    chat_cache.set(cache_key, suggestions[:limit], ttl_seconds=120)
    return suggestions[:limit]
