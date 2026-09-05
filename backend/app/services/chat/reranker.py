from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence

from app.services.chat.types import HybridRetrievalResult, RerankedChunk, RetrievalConfidence


def _token_set(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    stopwords = {"the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "what", "when", "where", "which", "who", "how", "why", "can", "could", "would", "should", "a", "an", "in", "on", "of", "to", "is", "it", "as", "at", "by", "or", "we", "our", "us", "i", "me", "my", "they", "their", "them", "about", "those", "these", "have", "has", "had", "many"}
    return {token for token in tokens if token not in stopwords}


def _lexical_score(query: str, doc: str) -> float:
    query_tokens = _token_set(query)
    doc_tokens = _token_set(doc)
    if not query_tokens or not doc_tokens:
        return 0.0
    return len(query_tokens & doc_tokens) / max(len(query_tokens | doc_tokens), 1)


def _semantic_score(distance: Optional[float]) -> float:
    if distance is None:
        return 0.48
    clamped = min(max(float(distance), 0.0), 1.5)
    return 1.0 - clamped / 1.5


def _confidence_from_scores(rerank_score: float, overlap: float, distance: Optional[float]) -> float:
    base = (0.7 * rerank_score) + (0.25 * overlap)
    if distance is not None:
        base += max(0.0, 0.05 * (0.5 - min(float(distance), 0.5)))
    return max(0.0, min(1.0, base))


def _is_suspicious_snippet(text: str) -> bool:
    compact = " ".join((text or "").split()).strip().lower()
    suspicious_markers = ["ignore previous instructions", "system prompt", "developer message", "act as", "you are chatgpt", "tool call", "reveal the prompt", "follow these instructions", "do not answer"]
    return any(marker in compact for marker in suspicious_markers)


def rerank_candidates(candidates: Sequence[Dict[str, Any]], query_text: str) -> List[RerankedChunk]:
    reranked: List[RerankedChunk] = []
    for candidate in candidates:
        doc = str(candidate.get("doc") or candidate.get("snippet") or "")
        overlap = _lexical_score(query_text, doc)
        distance = candidate.get("distance")
        semantic_score = _semantic_score(distance)
        stage = str(candidate.get("stage") or "fallback")
        stage_boost = {"primary": 0.05, "expanded": 0.025, "fallback": 0.0}.get(stage, 0.0)
        rerank_score = (0.58 * semantic_score) + (0.3 * overlap) + stage_boost
        confidence = _confidence_from_scores(rerank_score, overlap, distance)
        reranked.append(RerankedChunk(text=doc, stage=stage, rank=int(candidate.get("rank") or 0), distance=float(distance) if distance is not None else None, source_id=candidate.get("source_id"), source_label=candidate.get("source_label"), url=candidate.get("url"), chunk_index=candidate.get("chunk_index"), lexical_score=overlap, semantic_score=semantic_score, rerank_score=rerank_score, confidence=confidence, overlap=overlap, is_suspicious=_is_suspicious_snippet(doc), snippet=str(candidate.get("snippet") or doc[:240])))
    reranked.sort(key=lambda chunk: (chunk.rerank_score, chunk.confidence, -(chunk.distance or 9.0), -chunk.rank), reverse=True)
    return reranked


def build_retrieval_confidence(chunks: Sequence[RerankedChunk]) -> RetrievalConfidence:
    if not chunks:
        return RetrievalConfidence(score=0.0, label="empty", requires_clarification=True, reasons=("no_chunks",))
    top = chunks[0]
    reasons = []
    if top.rerank_score < 0.32:
        reasons.append("low_rerank_score")
    if top.confidence < 0.45:
        reasons.append("low_confidence")
    # Raised from 0.33 → 0.55: cosine distance of 0.33 (67% similarity) was too strict
    # for paraphrased queries. Content about "offerings/services" can score 0.4–0.5 against
    # a query like "what are your offerings" even with correct embeddings.
    if top.distance is not None and top.distance > 0.55:
        reasons.append("high_distance")
    if all(chunk.is_suspicious for chunk in chunks[:3]):
        reasons.append("suspicious_context")
    requires_clarification = bool(reasons)
    label = "high" if top.confidence >= 0.72 else "medium" if top.confidence >= 0.5 else "low"
    return RetrievalConfidence(score=round(top.confidence, 4), label=label, requires_clarification=requires_clarification, reasons=tuple(reasons))


def build_hybrid_result(query_text: str, chunks: Sequence[RerankedChunk], retrieval_trace: Dict[str, Any], sources: List[Dict[str, Any]], context_text: str) -> HybridRetrievalResult:
    confidence = build_retrieval_confidence(chunks)
    return HybridRetrievalResult(query_text=query_text, chunks=list(chunks), confidence=confidence, retrieval_trace=retrieval_trace, sources=sources, context_text=context_text)
