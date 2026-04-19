from openai import OpenAI
from app.config import settings
from app.services.rag import chroma_client
from app.models import Conversation, KnowledgeSource, WidgetConfig, RetrievalTrace
from app.services.report_service import sync_conversation_metrics
from sqlalchemy.orm import Session
import logging
from typing import Tuple, List, Dict, Optional, Set
import re
import json
import time
import hashlib
from threading import Lock
from urllib.parse import parse_qs, unquote, urlparse

from app.models.campaign import Contact

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAPI_KEY2)


DEFAULT_WIDGET_SYSTEM_PROMPT = (
    "You are a friendly and empathetic assistant chatting like a real human. "
    "Use warm, natural language, short sentences, and contractions when appropriate."
)

APPOINTMENT_BOOKING_CTA = (
    "Would you like to book an appointment? "
    "You can choose a preferred slot from the in-app calendar."
)


_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was",
    "were", "what", "when", "where", "which", "who", "how", "why", "can", "could",
    "would", "should", "a", "an", "in", "on", "of", "to", "is", "it", "as", "at",
    "by", "or", "we", "our", "us", "i", "me", "my", "they", "their", "them", "about",
    "those", "these", "have", "has", "had", "many",
}


_QUERY_GROUPS = [
    {"address", "location", "office", "hq", "head", "branch"},
    {"contact", "email", "phone", "support", "help"},
    {"price", "pricing", "cost", "fee", "charge", "plan"},
    {"hours", "timing", "opening", "open", "close"},
    {"delivery", "shipping", "ship"},
    {"refund", "return", "cancel", "cancellation"},
    {"features", "capabilities", "feature"},
    {"integration", "integrations", "api", "webhook", "sdk"},
    {"security", "privacy", "compliance", "gdpr", "soc"},
    {"setup", "install", "onboarding", "getting", "started"},
]


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

_GENERIC_URL_SEGMENTS = {
    "home", "index", "default", "page", "pages", "blog", "blogs", "post", "posts",
    "search", "label", "category", "categories", "tag", "tags", "about", "contact",
    "login", "signup", "register", "api", "docs", "documentation",
}

_GENERIC_TOPIC_WORDS = {
    "web", "www", "com", "co", "in", "org", "net", "site", "website", "blogspot",
}

_TOPIC_PREFIX_STOPWORDS = {"and", "or", "the", "a", "an", "to", "of", "for"}

_GENERIC_TOPICS = {
    "about", "about us", "contact", "contact us", "home", "welcome", "main", "index",
    "login", "signup", "register",
}

_SUGGESTED_QUESTIONS_CACHE_TTL_SECONDS = 120
_SUGGESTED_QUESTIONS_CACHE_MAX_ITEMS = 300
_SUGGESTED_QUESTIONS_CACHE_VERSION = 2
_suggested_questions_cache: Dict[Tuple[int, str, int], Tuple[float, List[str]]] = {}
_suggested_questions_cache_lock = Lock()


def _clean_label(label: str) -> str:
    cleaned = re.sub(r"^web:\s*", "", label.strip(), flags=re.IGNORECASE)
    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        parsed = urlparse(cleaned)
        path = parsed.path.strip("/")
        if path:
            cleaned = path.split("/")[-1]
        else:
            cleaned = parsed.netloc
    cleaned = re.sub(r"\.(pdf|docx|xlsx|txt)$", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    return cleaned.strip()


def _normalize_topic(raw_topic: str) -> Optional[str]:
    if not raw_topic:
        return None

    topic = unquote(raw_topic)
    topic = topic.replace("+", " ")
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
    path_segments = [seg for seg in parsed.path.split("/") if seg]

    qs = parse_qs(parsed.query)
    for key in ("label", "category", "topic", "tag"):
        values = qs.get(key)
        if values:
            topic = _normalize_topic(values[0])
            if topic:
                return topic

    lower_segments = [seg.lower() for seg in path_segments]
    if "label" in lower_segments:
        idx = lower_segments.index("label")
        if idx + 1 < len(path_segments):
            topic = _normalize_topic(path_segments[idx + 1])
            if topic:
                return topic

    for segment in reversed(path_segments):
        topic = _normalize_topic(segment)
        if not topic:
            continue
        if topic.lower() in _GENERIC_URL_SEGMENTS:
            continue
        return topic

    return None


def _extract_metadata_labels(raw_metadata: Optional[str], limit: int = 8) -> List[str]:
    if not raw_metadata:
        return []
    if len(raw_metadata) > 250000:
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

    # Prefer deeper crawled URLs first since they are usually more specific.
    raw_labels.extend(_extract_metadata_labels(source.source_metadata))

    if source.url:
        raw_labels.append(source.url)

    if source.name:
        name = source.name.strip()
        # Skip noisy default names that duplicate the source URL.
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

    metadatas = raw_metadatas
    if isinstance(metadatas, list) and metadatas and isinstance(metadatas[0], list):
        metadatas = metadatas[0]

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


def get_suggested_questions(
    widget_id: str,
    organization_id: int,
    db: Session,
    limit: int = 6
) -> List[str]:
    cache_key = (_SUGGESTED_QUESTIONS_CACHE_VERSION, organization_id, widget_id or "", int(limit))
    now = time.monotonic()
    with _suggested_questions_cache_lock:
        cached = _suggested_questions_cache.get(cache_key)
        if cached and (now - cached[0]) < _SUGGESTED_QUESTIONS_CACHE_TTL_SECONDS:
            return list(cached[1])

    suggestions: List[str] = []
    used = set()

    def finalize() -> List[str]:
        final_suggestions = suggestions[:limit]
        with _suggested_questions_cache_lock:
            _suggested_questions_cache[cache_key] = (time.monotonic(), list(final_suggestions))
            if len(_suggested_questions_cache) > _SUGGESTED_QUESTIONS_CACHE_MAX_ITEMS:
                oldest_key = min(
                    _suggested_questions_cache,
                    key=lambda key: _suggested_questions_cache[key][0],
                )
                _suggested_questions_cache.pop(oldest_key, None)
        return final_suggestions

    def add(question: Optional[str]) -> None:
        if not question:
            return
        key = question.strip().lower()
        if not key or key in used:
            return
        used.add(key)
        suggestions.append(question.strip())

    sources = db.query(KnowledgeSource).filter(
        KnowledgeSource.organization_id == organization_id,
        KnowledgeSource.widget_id == widget_id,
        KnowledgeSource.status == "active",
    ).order_by(KnowledgeSource.created_at.desc()).limit(12).all()

    for source in sources:
        for label in _iter_source_labels(source):
            add(_question_from_label(label))
            if len(suggestions) >= limit:
                return finalize()

    try:
        chroma_docs = chroma_client.get_documents(
            organization_id=organization_id,
            widget_id=widget_id,
            include_documents=False,
            limit=120,
        )
        for label in _labels_from_chroma_metadatas(chroma_docs.get("metadatas")):
            add(_question_from_label(label))
            if len(suggestions) >= limit:
                return finalize()
    except Exception:
        pass

    # Keep this endpoint lightweight under heavy UI traffic: avoid vector retrieval
    # (which can trigger embedding calls and delay first paint of suggestions).

    for _, question in _SUGGESTION_PATTERNS:
        add(question)
        if len(suggestions) >= limit:
            return finalize()

    for question in [
        "What products or services do you offer?",
        "How do I get support?",
        "What are your business hours?",
    ]:
        add(question)
        if len(suggestions) >= limit:
            return finalize()

    return finalize()


def _keyword_query(text: str) -> str:
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())

    def _normalize_token(token: str) -> str:
        # Light stemming to keep singular/plural variants aligned (post/posts).
        if len(token) > 4 and token.endswith("ies"):
            return f"{token[:-3]}y"
        if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            return token[:-1]
        return token

    keywords = [_normalize_token(t) for t in tokens if t not in _STOPWORDS]
    return " ".join(keywords[:12])


def _extract_year_token(text: str) -> Optional[str]:
    if not text:
        return None
    match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    return match.group(1) if match else None


def _token_set(text: str) -> Set[str]:
    return set(_keyword_query(text).split())


def _semantic_rerank_candidates(candidates: List[Dict], raw_message: str) -> List[Dict]:
    if not candidates:
        return []

    query_tokens = _token_set(raw_message)
    reranked: List[Dict] = []
    for candidate in candidates:
        doc_tokens = _token_set(candidate.get("doc", ""))
        overlap = 0.0
        if query_tokens and doc_tokens:
            overlap = len(query_tokens & doc_tokens) / max(len(query_tokens | doc_tokens), 1)

        distance = candidate.get("distance")
        if distance is None:
            semantic_score = 0.45
        else:
            semantic_score = 1.0 - min(max(float(distance), 0.0), 1.5) / 1.5

        stage = candidate.get("stage") or "fallback"
        stage_boost = {"primary": 0.04, "expanded": 0.02, "fallback": 0.0}.get(stage, 0.0)

        rerank_score = (0.68 * semantic_score) + (0.28 * overlap) + stage_boost

        enriched = dict(candidate)
        enriched["overlap"] = overlap
        enriched["rerank_score"] = rerank_score
        reranked.append(enriched)

    reranked.sort(
        key=lambda item: (
            item.get("rerank_score", 0.0),
            -float(item.get("distance") or 999.0),
            -int(item.get("rank") or 0),
        ),
        reverse=True,
    )
    return reranked


def _is_count_or_time_question(message: str) -> bool:
    lower = (message or "").lower()
    tokens = set(re.findall(r"[a-zA-Z0-9]+", lower))
    count_tokens = {"how", "many", "count", "number", "total", "published", "posts", "post", "blog", "blogpost", "blogs"}
    time_tokens = {"year", "month", "day", "date", "when", "timeline"}
    return bool(tokens & count_tokens and (tokens & time_tokens or _extract_year_token(lower)))


def _extract_numeric_evidence(doc: str, target_year: Optional[str]) -> List[int]:
    if not doc:
        return []

    values: List[int] = []
    compact = " ".join(doc.split())

    if target_year:
        patterns = [
            rf"\b{target_year}\b\s*[\(\[\{{:\-]?\s*(\d{{1,5}})\b",
            rf"(\d{{1,5}})\s+(?:blog\s+)?posts?\b[^\n\.\r]{{0,40}}\b(?:in|for)\b[^\n\.\r]{{0,12}}\b{target_year}\b",
            rf"\b(?:in|for)\b[^\n\.\r]{{0,12}}\b{target_year}\b[^\n\.\r]{{0,40}}\b(\d{{1,5}})\s+(?:blog\s+)?posts?\b",
        ]
    else:
        patterns = [
            r"\b(\d{1,5})\s+(?:blog\s+)?posts?\b",
        ]

    for pattern in patterns:
        for raw in re.findall(pattern, compact, flags=re.IGNORECASE):
            try:
                number = int(raw)
            except Exception:
                continue
            if number <= 0:
                continue
            if target_year and number == int(target_year):
                continue
            values.append(number)

    return values


def _build_clarifying_question(message: str, target_year: Optional[str], conflicting_values: List[int]) -> str:
    if conflicting_values:
        sampled = ", ".join(str(v) for v in conflicting_values[:3])
        if target_year:
            return (
                f"I found multiple possible counts for {target_year} ({sampled}) in the current context. "
                f"Do you want the total number of posts from the blog archive for {target_year}?"
            )
        return (
            f"I found multiple possible counts ({sampled}) in the current context. "
            "Could you clarify what exact count you want?"
        )

    if target_year:
        return (
            f"I found related information, but I need one quick clarification to answer reliably: "
            f"do you want the total number of posts published in calendar year {target_year}?"
        )

    return (
        "I found related information, but I need one quick clarification to answer reliably: "
        "what exact period or post type should I count?"
    )


def _try_structured_fact_answer(message: str, selected_candidates: List[Dict]) -> Tuple[Optional[str], List[int]]:
    if not _is_count_or_time_question(message):
        return None, []

    target_year = _extract_year_token(message)
    extracted_values: List[int] = []

    for candidate in selected_candidates[:10]:
        extracted_values.extend(_extract_numeric_evidence(candidate.get("doc", ""), target_year))

    unique_values = sorted(set(extracted_values))
    if len(unique_values) != 1:
        return None, unique_values

    answer_value = unique_values[0]
    if target_year:
        return f"In {target_year}, there were {answer_value} blog posts published on the site.", unique_values

    return f"I found {answer_value} posts in the retrieved context.", unique_values


def _should_include_previous_message(current_message: str, previous_message: str) -> bool:
    if not current_message or not previous_message:
        return False

    current_keywords = set(_keyword_query(current_message).split())
    previous_keywords = set(_keyword_query(previous_message).split())
    if not current_keywords or not previous_keywords:
        return False

    overlap_ratio = len(current_keywords & previous_keywords) / max(len(current_keywords), 1)
    if overlap_ratio >= 0.35:
        return True

    lower_current = current_message.lower().strip()
    polite_followups = {
        "please",
        "yes please",
        "ok",
        "okay",
        "sure",
        "go ahead",
        "proceed",
        "continue",
        "tell me more",
        "more",
        "details",
        "share more",
        "can you share",
    }
    if lower_current in polite_followups:
        return True

    followup_pattern = re.search(
        r"^(and|also|then|same for|what about|how about|please|yes please|ok|okay|sure)\b|\b(it|that|those|them|same|again|previous|earlier)\b",
        lower_current,
    )
    short_query = len(current_keywords) <= 5

    # Capture under-specified follow-ups like "want to write my first program"
    # so they inherit the previous topical context (for example: Docker).
    starter_pattern = re.search(
        r"^(want to|i want to|need to|i need to|how to|can you|could you|help me|guide me|show me|teach me)\b",
        lower_current,
    )
    generic_followup_tokens = {
        "a", "an", "and", "are", "begin", "build", "can", "could", "create", "do", "first",
        "for", "get", "give", "help", "how", "i", "learn", "make", "me", "my", "need", "on", "program",
        "show", "start", "step", "steps", "teach", "tell", "to", "want", "write", "you", "your",
        "guide", "guidance", "instruction", "instructions", "example", "examples", "detail", "details",
        "more", "next",
    }
    non_generic_tokens = {token for token in current_keywords if token not in generic_followup_tokens}
    underspecified_followup = bool(starter_pattern and short_query and len(non_generic_tokens) == 0)

    return bool((followup_pattern and short_query) or underspecified_followup)


def _followup_overlap_score(current_message: str, previous_message: str) -> float:
    current_keywords = set(_keyword_query(current_message).split())
    previous_keywords = set(_keyword_query(previous_message).split())
    if not current_keywords or not previous_keywords:
        return 0.0
    return len(current_keywords & previous_keywords) / max(len(current_keywords), 1)


def _is_referential_followup(message: str) -> bool:
    lower = (message or "").lower().strip()
    if not lower:
        return False

    has_reference = bool(re.search(r"\b(it|that|those|them|this|these|same|again|previous|earlier)\b", lower))
    is_short = len(_keyword_query(message).split()) <= 6
    return has_reference and is_short


def _compact_response_for_retrieval(text: str, max_chars: int = 240) -> str:
    compact = " ".join((text or "").split()).strip()
    if len(compact) <= max_chars:
        return compact
    return f"{compact[:max_chars - 3]}..."


def _expand_queries(base_query: str, raw_message: str) -> List[str]:
    queries = [base_query]
    raw_tokens = set(re.findall(r"[a-zA-Z0-9]+", raw_message.lower()))
    for group in _QUERY_GROUPS:
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

    # keep bounded variants to avoid latency spikes
    return deduped[:5]

def _build_escalation_message(level_1: str, level_2: str) -> str:
    return (
        "That sounds exciting, and I love the creativity. "
        "I'm sorry-I don't have reliable expertise on this specific topic in my current knowledge base. "
        "If you'd like, I can still help with topics covered here (for example: our services, setup, pricing, or support). "
        "Or I can connect you with our escalation contacts:\n"
        f"- Level 1: {level_1}\n"
        f"- Level 2: {level_2}\n"
        "Would you like me to connect you?"
    )


def _select_message_variant(options: List[str], seed_text: Optional[str]) -> str:
    if not options:
        return ""
    if not seed_text:
        return options[0]

    digest = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()
    idx = int(digest[:8], 16) % len(options)
    return options[idx]


def _build_soft_fallback_message(seed_text: Optional[str] = None) -> str:
    variants = [
        (
            "I could not find reliable information about that in this knowledge base yet. "
            "I can still help with our services, setup, pricing, or support."
        ),
        (
            "That topic is not covered clearly in the available context right now. "
            "If you want, I can help with what is documented here, like services, onboarding, pricing, or support."
        ),
        (
            "I do not have enough verified context to answer that accurately yet. "
            "I can still help with questions about our services, setup steps, pricing plans, or support options."
        ),
        (
            "I am not seeing a reliable answer for that in the current knowledge base. "
            "I can still help with common topics here, including services, setup, pricing, and support."
        ),
    ]
    return _select_message_variant(variants, seed_text)



def _is_escalation_contacts_message(text: Optional[str]) -> bool:
    if not text:
        return False
    lower = text.lower()
    markers = [
        "escalation contacts",
        "level 1:",
        "level 2:",
        "would you like me to connect you",
    ]
    return all(marker in lower for marker in ("level 1:", "level 2:")) or any(marker in lower for marker in markers)


def _has_prior_escalation_contacts(db: Session, session_id: str, widget_id: str) -> bool:
    recent = db.query(Conversation.response).filter(
        Conversation.session_id == session_id,
        Conversation.widget_id == widget_id,
    ).order_by(Conversation.created_at.desc(), Conversation.id.desc()).limit(12).all()
    for row in recent:
        response_text = None
        if isinstance(row, tuple):
            response_text = row[0] if row else None
        else:
            response_text = getattr(row, "response", None)
            if response_text is None:
                try:
                    response_text = row[0]
                except Exception:
                    response_text = None

        if _is_escalation_contacts_message(response_text):
            return True
    return False


def _looks_like_no_answer(text: Optional[str]) -> bool:
    if not text:
        return True
    lower = text.lower()
    normalized = (
        lower
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2014", "-")
        .replace("\u2013", "-")
    )
    patterns = [
        "i don't know",
        "i do not know",
        "don't have",
        "do not have",
        "can't find",
        "cannot find",
        "not available in the provided context",
        "not in the context",
        "no relevant information",
        "reliable expertise",
        "escalation contacts",
        "would you like me to connect you",
    ]
    return any(pattern in normalized for pattern in patterns)


def _is_noisy_snippet(text: str) -> bool:
    if not text:
        return True

    compact = " ".join(text.split()).strip().lower()
    if not compact:
        return True

    noise_markers = [
        "http://",
        "https://",
        "www.",
        "@",
        "linkedin.com",
        "twitter.com",
        "facebook.com",
        "search this blog",
        "view my complete profile",
        "git commit",
        "git push",
    ]
    marker_hits = sum(1 for marker in noise_markers if marker in compact)
    if marker_hits >= 2:
        return True

    return False


def _build_context_grounded_response(message: str, retrieval_trace: Dict) -> Optional[str]:
    selected_chunks = retrieval_trace.get("selected_chunks") or []
    query_tokens = _keyword_query(message).split()
    snippets: List[Dict] = []

    for chunk in selected_chunks:
        raw_snippet = str(chunk.get("snippet") or "")
        snippet = " ".join(raw_snippet.split()).strip()
        if not snippet:
            continue

        lower_snippet = snippet.lower()
        snippet_tokens = set(re.findall(r"[a-zA-Z0-9]+", lower_snippet))
        match_tokens = [token for token in query_tokens if token in snippet_tokens]
        overlap = float(chunk.get("overlap", 0.0) or 0.0)
        distance = chunk.get("distance")

        snippets.append({
            "snippet": snippet,
            "match_tokens": match_tokens,
            "match_count": len(match_tokens),
            "overlap": overlap,
            "distance": float(distance) if distance is not None else None,
            "is_noisy": _is_noisy_snippet(snippet),
        })

        if len(snippets) >= 8:
            break

    if not snippets:
        return None

    snippets.sort(
        key=lambda item: (
            int(item["match_count"]),
            float(item["overlap"]),
            -float(item["distance"] if item["distance"] is not None else 9.0),
            0 if not item["is_noisy"] else -1,
        ),
        reverse=True,
    )

    best = snippets[0]
    has_strong_context = (
        best["match_count"] >= 2
        or float(best["overlap"]) >= 0.09
        or (
            best["distance"] is not None
            and float(best["distance"]) <= 0.22
            and best["match_count"] >= 1
        )
    )

    if not has_strong_context:
        return None

    coverage_ratio = 0.0
    if query_tokens:
        coverage_ratio = min(1.0, best["match_count"] / max(len(query_tokens), 1))

    if len(query_tokens) >= 4 and coverage_ratio < 0.5:
        matched_terms = ", ".join(best["match_tokens"][:3]) if best["match_tokens"] else "a nearby topic"
        return (
            "I found only partial information in the knowledge base, and it does not fully answer your question. "
            f"The available context mainly covers: {matched_terms}. "
            "If you want, I can help with that part, or we can refine your question for a more specific answer."
        )

    chosen: List[str] = []
    for item in snippets:
        if item["is_noisy"]:
            continue
        if item["match_count"] <= 0:
            continue
        text = item["snippet"]
        if text in chosen:
            continue
        chosen.append(text)
        if len(chosen) >= 2:
            break

    if not chosen:
        chosen.append(best["snippet"])

    if len(chosen) == 1:
        return (
            "I found relevant information in the knowledge base. "
            f"Here is what it says: {chosen[0]}"
        )

    return (
        "I found relevant information in the knowledge base. "
        f"Here is what it says: {chosen[0]}\n\n"
        f"Also related: {chosen[1]}"
    )


def _has_prior_turns(db: Session, session_id: str, widget_id: str) -> bool:
    return db.query(Conversation.id).filter(
        Conversation.session_id == session_id,
        Conversation.widget_id == widget_id,
    ).first() is not None


def append_appointment_cta_if_needed(response_text: str, is_first_turn: bool) -> str:
    if not is_first_turn:
        return response_text
    if not response_text:
        return APPOINTMENT_BOOKING_CTA

    lower = response_text.lower()
    appointment_keywords = ["appointment", "book", "booking", "schedule", "calendar", "slot"]
    if any(keyword in lower for keyword in appointment_keywords):
        return response_text

    return f"{response_text}\n\n{APPOINTMENT_BOOKING_CTA}"


def _prepare_chat_payload(
    message: str,
    session_id: str,
    widget_id: str,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None
) -> Tuple[List[Dict], List[Dict], bool, str, Dict]:
    history = db.query(Conversation).filter(
        Conversation.session_id == session_id,
        Conversation.widget_id == widget_id,
    ).order_by(Conversation.created_at.desc()).limit(3).all()

    query_text = retrieval_message or message
    if history:
        best_followup_row = None
        best_followup_score = -1.0
        for row in history:
            prior_message = (row.message or "").strip()
            if not prior_message or prior_message == message.strip():
                continue
            if not _should_include_previous_message(message, prior_message):
                continue

            score = _followup_overlap_score(message, prior_message)
            if score > best_followup_score:
                best_followup_score = score
                best_followup_row = row

        if best_followup_row is not None:
            prior_message = (best_followup_row.message or "").strip()
            query_text = f"{query_text}\n\nPrevious user message: {prior_message}"

            # Referential prompts like "what are those posts" benefit from
            # including a compact prior assistant summary as an anchor.
            prior_response = _compact_response_for_retrieval(best_followup_row.response or "")
            if prior_response and _is_referential_followup(message):
                query_text = f"{query_text}\n\nPrevious assistant response: {prior_response}"

    context_parts = []
    source_ids = set()
    seen_chunks = set()
    target_year = _extract_year_token(message)
    query_variants = _expand_queries(query_text, message)
    candidate_pool: List[Dict] = []

    retrieval_trace = {
        "user_query": message,
        "retrieval_query": query_text,
        "query_variants": query_variants,
        "retrieved_chunks": [],
        "selected_chunks": [],
        "source_ids": [],
        "has_context": False,
        "escalation_triggered": False,
        "top_distance": None,
    }

    def _snippet(text: str, limit: int = 240) -> str:
        compact = " ".join((text or "").split()).strip()
        if len(compact) <= limit:
            return compact
        return f"{compact[:limit - 3]}..."

    def _add_results(results: Dict, query_used: str, stage: str, max_chunks: int = 12, apply_threshold: bool = True) -> None:
        distances = None
        if results and results.get('distances') and results['distances'][0]:
            distances = results['distances'][0]
        valid_distances = [d for d in (distances or []) if d is not None]
        min_distance = min(valid_distances) if valid_distances else None
        distance_threshold = None
        if apply_threshold and min_distance is not None:
            distance_threshold = min(0.6, min_distance + 0.2)

        top_distance = retrieval_trace.get("top_distance")
        if min_distance is not None and (top_distance is None or min_distance < top_distance):
            retrieval_trace["top_distance"] = min_distance

        if results and results.get('documents') and results['documents'][0]:
            docs = results['documents'][0]
            for idx, doc in enumerate(docs):
                if not doc:
                    continue

                metadata = None
                if results.get('metadatas') and results['metadatas'][0] and idx < len(results['metadatas'][0]):
                    metadata = results['metadatas'][0][idx]
                distance_value = distances[idx] if distances and idx < len(distances) else None

                source_id = None
                source_label = None
                url = None
                chunk_index = None
                if isinstance(metadata, dict):
                    raw_source_id = metadata.get('source_id')
                    try:
                        source_id = int(raw_source_id) if raw_source_id is not None else None
                    except Exception:
                        source_id = None
                    source_label = metadata.get('title') or metadata.get('filename') or metadata.get('url')
                    url = metadata.get('url')
                    chunk_index = metadata.get('chunk_index')

                if len(retrieval_trace["retrieved_chunks"]) < 40:
                    retrieval_trace["retrieved_chunks"].append({
                        "stage": stage,
                        "query": query_used,
                        "rank": idx,
                        "distance": distance_value,
                        "source_id": source_id,
                        "source_label": source_label,
                        "url": url,
                        "chunk_index": chunk_index,
                        "snippet": _snippet(doc),
                    })

                if distances and distance_threshold is not None and idx < len(distances):
                    threshold = distance_threshold
                    if target_year and target_year in doc:
                        threshold = min(0.8, threshold + 0.12)
                    if distances[idx] is not None and distances[idx] > threshold:
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
                    "url": url,
                    "chunk_index": chunk_index,
                    "doc": doc,
                    "snippet": _snippet(doc),
                })

    primary_results = chroma_client.query(
        query_text,
        n_results=6,
        organization_id=organization_id,
        widget_id=widget_id,
    )
    _add_results(primary_results, query_used=query_variants[0], stage="primary", apply_threshold=True)

    # Expand query variants only when primary retrieval is sparse.
    if len(candidate_pool) < 2:
        for q in query_variants[1:3]:
            if len(candidate_pool) >= 6:
                break
            results = chroma_client.query(
                q,
                n_results=6,
                organization_id=organization_id,
                widget_id=widget_id,
            )
            _add_results(results, query_used=q, stage="expanded", apply_threshold=False)

    if not candidate_pool:
        fallback_results = chroma_client.query(
            query_text,
            n_results=8,
            organization_id=organization_id,
            widget_id=widget_id,
        )
        _add_results(fallback_results, query_used=query_text, stage="fallback", max_chunks=12, apply_threshold=False)

    reranked_candidates = _semantic_rerank_candidates(candidate_pool, message)
    selected_candidates = reranked_candidates[:8]

    for candidate in selected_candidates:
        doc = candidate.get("doc") or ""
        label = candidate.get("source_label")
        context_entry = f"Source: {label}\n{doc}" if label else doc
        context_parts.append(context_entry)

        source_id = candidate.get("source_id")
        if source_id is not None:
            source_ids.add(source_id)

        if len(retrieval_trace["selected_chunks"]) < 16:
            retrieval_trace["selected_chunks"].append({
                "stage": candidate.get("stage"),
                "query": candidate.get("query"),
                "rank": candidate.get("rank"),
                "distance": candidate.get("distance"),
                "source_id": candidate.get("source_id"),
                "source_label": candidate.get("source_label"),
                "url": candidate.get("url"),
                "chunk_index": candidate.get("chunk_index"),
                "snippet": candidate.get("snippet"),
                "rerank_score": round(float(candidate.get("rerank_score", 0.0)), 6),
                "overlap": round(float(candidate.get("overlap", 0.0)), 6),
            })

    top_score = float(selected_candidates[0].get("rerank_score", 0.0)) if selected_candidates else 0.0
    top_distance = selected_candidates[0].get("distance") if selected_candidates else None
    top_distance = float(top_distance) if top_distance is not None else None
    avg_overlap = 0.0
    if selected_candidates:
        top_subset = selected_candidates[:3]
        avg_overlap = sum(float(c.get("overlap", 0.0)) for c in top_subset) / len(top_subset)

    weak_evidence = (
        not selected_candidates
        or top_score < 0.33
        or ((top_distance is None or top_distance > 0.32) and avg_overlap < 0.08)
    )

    structured_answer, conflicting_values = _try_structured_fact_answer(message, selected_candidates)
    contradictory_evidence = len(conflicting_values) > 1
    needs_clarification = bool(not structured_answer and (weak_evidence or contradictory_evidence) and bool(selected_candidates))

    if needs_clarification:
        retrieval_trace["clarifying_question"] = _build_clarifying_question(message, target_year, conflicting_values)
    else:
        retrieval_trace["clarifying_question"] = None

    retrieval_trace["structured_answer"] = structured_answer
    retrieval_trace["weak_evidence"] = weak_evidence
    retrieval_trace["contradictory_evidence"] = contradictory_evidence
    retrieval_trace["needs_clarification"] = needs_clarification
    retrieval_trace["rerank_top_score"] = round(top_score, 6)
    retrieval_trace["rerank_avg_overlap_top3"] = round(avg_overlap, 6)

    context = "\n\n".join(context_parts) if context_parts else ""
    # Mark weakly matched retrieval as no-context so similarly phrased queries behave consistently.
    has_context = bool(context_parts) and not weak_evidence
    retrieval_trace["has_context"] = has_context
    retrieval_trace["source_ids"] = sorted(source_ids)

    widget_config = db.query(WidgetConfig).filter(
        WidgetConfig.widget_id == widget_id,
        WidgetConfig.organization_id == organization_id,
    ).first()

    custom_system_prompt = ""
    if widget_config and widget_config.system_prompt:
        custom_system_prompt = widget_config.system_prompt.strip()
    system_prompt = custom_system_prompt or DEFAULT_WIDGET_SYSTEM_PROMPT

    escalation_level_1 = (
        widget_config.escalation_contact_level_1
        if widget_config and widget_config.escalation_contact_level_1
        else settings.DEFAULT_ESCALATION_CONTACT_LEVEL_1
    )
    escalation_level_2 = (
        widget_config.escalation_contact_level_2
        if widget_config and widget_config.escalation_contact_level_2
        else settings.DEFAULT_ESCALATION_CONTACT_LEVEL_2
    )
    escalation_message = _build_escalation_message(escalation_level_1, escalation_level_2)

    sources = []
    if source_ids:
        source_records = db.query(KnowledgeSource).filter(
            KnowledgeSource.id.in_(source_ids),
            KnowledgeSource.organization_id == organization_id,
            KnowledgeSource.widget_id == widget_id,
        ).all()

        for source in source_records:
            source_info = {
                "id": source.id,
                "name": source.name,
                "type": source.source_type.value,
                "url": source.url
            }
            sources.append(source_info)

    language_instruction = ''
    if language_label or language_code:
        label = language_label or 'the requested language'
        code = language_code or 'unknown'
        language_instruction = f"\n\nAlways respond in {label} ({code})."

    messages = [
        {
            "role": "system",
            "content": f"""{system_prompt}

Follow these non-negotiable rules:
- Answer using only the context from the user's knowledge base and the conversation history.
- If the answer is not in context, do not guess. Say briefly that this topic is not covered in the current knowledge base, then offer to connect the user with escalation contacts.

- Do not use outside knowledge or make assumptions.
- You may derive simple aggregates (e.g., price ranges) from context if present, but do not expose step-by-step reasoning.
{language_instruction}

Context:
{context if context else "(No relevant context found in the knowledge base.)"}"""
        }
    ]

    for conv in reversed(history):
        messages.append({"role": "user", "content": conv.message})
        messages.append({"role": "assistant", "content": conv.response})

    messages.append({"role": "user", "content": message})

    return messages, sources, has_context, escalation_message, retrieval_trace


def persist_conversation(
    db: Session,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    message: str,
    response_text: str,
    token_usage: Dict,
    retrieval_trace: Optional[Dict] = None,
) -> None:
    
    contact = db.query(Contact).filter(Contact.session_id == session_id).first()
    
    conversation = Conversation(
        session_id=session_id,
        widget_id=widget_id,
        user_id=user_id,
        organization_id=organization_id,
        message=message,
        response=response_text,
        role="user",
        source="chat",
        contact_id= contact.id if contact else None
    )
    db.add(conversation)
    db.flush()

    if retrieval_trace:
        trace_record = RetrievalTrace(
            conversation_id=conversation.id,
            session_id=session_id,
            widget_id=widget_id,
            organization_id=organization_id,
            user_id=user_id,
            user_query=retrieval_trace.get("user_query") or message,
            retrieval_query=retrieval_trace.get("retrieval_query"),
            query_variants=json.dumps(retrieval_trace.get("query_variants", [])),
            retrieved_chunks=json.dumps(retrieval_trace.get("retrieved_chunks", [])),
            selected_chunks=json.dumps(retrieval_trace.get("selected_chunks", [])),
            source_ids=json.dumps(retrieval_trace.get("source_ids", [])),
            has_context=bool(retrieval_trace.get("has_context")),
            escalation_triggered=bool(retrieval_trace.get("escalation_triggered")),
            top_distance=float(retrieval_trace["top_distance"]) if retrieval_trace.get("top_distance") is not None else None,
        )
        db.add(trace_record)

    sync_conversation_metrics(db, conversation.id, organization_id, session_id, token_usage=token_usage)
    db.commit()


def generate_chat_response(
    message: str,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None
) -> Tuple[str, List[Dict], Dict]:
    """Generate AI response using RAG with organization-scoped knowledge base. Returns (response, sources, token_usage)."""
    try:
        is_first_turn = not _has_prior_turns(db, session_id, widget_id)

        messages, sources, has_context, escalation_message, retrieval_trace = _prepare_chat_payload(
            message,
            session_id,
            widget_id,
            organization_id,
            db,
            language_code=language_code,
            language_label=language_label,
            retrieval_message=retrieval_message
        )

        override_response = retrieval_trace.get("structured_answer")
        if not override_response and retrieval_trace.get("needs_clarification"):
            override_response = retrieval_trace.get("clarifying_question")

        if override_response:
            ai_response = str(override_response)
            escalation_triggered = False
            token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        elif not has_context:
            if _has_prior_escalation_contacts(db, session_id, widget_id):
                ai_response = escalation_message
                escalation_triggered = True
            else:
                ai_response = _build_soft_fallback_message(seed_text=f"{session_id}:{message}")
                escalation_triggered = False
            token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        else:
            try:
                response = client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=messages,
                    max_tokens=220,
                    temperature=0.3,
                    timeout=float(settings.OPENAI_CHAT_TIMEOUT_SECONDS),
                )

                ai_response = response.choices[0].message.content
                if has_context and _looks_like_no_answer(ai_response):
                    grounded_response = _build_context_grounded_response(message, retrieval_trace)
                    if grounded_response:
                        ai_response = grounded_response

                escalation_triggered = not has_context or _looks_like_no_answer(ai_response)
                if escalation_triggered:
                    if _has_prior_escalation_contacts(db, session_id, widget_id):
                        ai_response = escalation_message
                    else:
                        ai_response = _build_soft_fallback_message(seed_text=f"{session_id}:{message}")
                        escalation_triggered = False

                usage = getattr(response, "usage", None)
                token_usage = {
                    "prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
                    "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
                    "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
                }
            except Exception as completion_error:
                logger.warning(
                    "OpenAI completion failed for widget_id=%s session_id=%s: %s",
                    widget_id,
                    session_id,
                    str(completion_error),
                )
                grounded_response = _build_context_grounded_response(message, retrieval_trace)
                if grounded_response:
                    ai_response = grounded_response
                    escalation_triggered = False
                elif _has_prior_escalation_contacts(db, session_id, widget_id):
                    ai_response = escalation_message
                    escalation_triggered = True
                else:
                    ai_response = _build_soft_fallback_message(seed_text=f"{session_id}:{message}")
                    escalation_triggered = False

                token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        ai_response = append_appointment_cta_if_needed(ai_response, is_first_turn)
        retrieval_trace["escalation_triggered"] = escalation_triggered
        
        persist_conversation(
            db,
            session_id=session_id,
            widget_id=widget_id,
            user_id=user_id,
            organization_id=organization_id,
            message=message,
            response_text=ai_response,
            token_usage=token_usage,
            retrieval_trace=retrieval_trace,
        )

        return ai_response, sources, token_usage
        
    except Exception as e:
        logger.error(f"Error generating chat response: {str(e)}")
        raise


def stream_chat_response(
    message: str,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None
):
    messages, sources, has_context, escalation_message, retrieval_trace = _prepare_chat_payload(
        message,
        session_id,
        widget_id,
        organization_id,
        db,
        language_code=language_code,
        language_label=language_label,
        retrieval_message=retrieval_message
    )

    override_response = retrieval_trace.get("structured_answer")
    if not override_response and retrieval_trace.get("needs_clarification"):
        override_response = retrieval_trace.get("clarifying_question")

    if override_response:
        retrieval_trace["escalation_triggered"] = False
        return None, sources, str(override_response), retrieval_trace

    if not has_context:
        if _has_prior_escalation_contacts(db, session_id, widget_id):
            retrieval_trace["escalation_triggered"] = True
            return None, sources, escalation_message, retrieval_trace

        retrieval_trace["escalation_triggered"] = False
        return None, sources, _build_soft_fallback_message(seed_text=f"{session_id}:{message}"), retrieval_trace

    try:
        stream = client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            messages=messages,
            max_tokens=220,
            temperature=0.3,
            stream=True,
            stream_options={"include_usage": True},
            timeout=float(settings.OPENAI_STREAM_TIMEOUT_SECONDS),
        )
        return stream, sources, escalation_message, retrieval_trace
    except Exception as stream_error:
        logger.warning(
            "OpenAI stream init failed for widget_id=%s session_id=%s: %s",
            widget_id,
            session_id,
            str(stream_error),
        )

        grounded_response = _build_context_grounded_response(message, retrieval_trace)
        if grounded_response:
            retrieval_trace["escalation_triggered"] = False
            return None, sources, grounded_response, retrieval_trace

        if _has_prior_escalation_contacts(db, session_id, widget_id):
            retrieval_trace["escalation_triggered"] = True
            return None, sources, escalation_message, retrieval_trace

        retrieval_trace["escalation_triggered"] = False
        return None, sources, _build_soft_fallback_message(seed_text=f"{session_id}:{message}"), retrieval_trace


def translate_text(text: str, target_language_code: Optional[str] = None, target_language_label: Optional[str] = None) -> str:
    if not text.strip():
        return text

    label = target_language_label or 'the requested language'
    code = target_language_code or 'unknown'
    response = client.chat.completions.create(
        model=settings.OPENAI_TRANSLATION_MODEL,
        messages=[
            {
                "role": "system",
                "content": f"Translate the user's text to {label} ({code}). Return only the translated text, no extra commentary."
            },
            {"role": "user", "content": text}
        ],
        max_tokens=400,
        temperature=0.2,
        timeout=float(settings.OPENAI_TRANSLATION_TIMEOUT_SECONDS),
    )

    return response.choices[0].message.content or text

