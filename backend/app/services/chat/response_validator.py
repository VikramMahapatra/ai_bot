from __future__ import annotations

import re

from app.services.chat.types import HybridRetrievalResult, StructuredAnswer, ValidatedResponse


def _token_set(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    stopwords = {"the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "what", "when", "where", "which", "who", "how", "why", "can", "could", "would", "should", "a", "an", "in", "on", "of", "to", "is", "it", "as", "at", "by", "or", "we", "our", "us", "i", "me", "my", "they", "their", "them", "about", "those", "these", "have", "has", "had", "many"}
    return {token for token in tokens if token not in stopwords}


def _answer_context_similarity(answer: str, context_text: str) -> float:
    answer_tokens = _token_set(answer)
    context_tokens = _token_set(context_text)
    if not answer_tokens or not context_tokens:
        return 0.0
    return len(answer_tokens & context_tokens) / max(len(answer_tokens), 1)


def validate_answer(answer: StructuredAnswer, retrieval_result: HybridRetrievalResult) -> ValidatedResponse:
    response = (answer.response or "").strip()
    similarity = _answer_context_similarity(response, retrieval_result.context_text)
    top_confidence = retrieval_result.confidence.score if retrieval_result.confidence else 0.0
    if not response:
        return ValidatedResponse(accepted=False, response="", confidence=0.0, similarity=0.0, reason="empty_response", requires_clarification=True)
    if answer.requires_escalation and top_confidence < 0.65:
        return ValidatedResponse(accepted=False, response=response, confidence=answer.confidence, similarity=similarity, reason="escalation_requested_low_confidence", requires_clarification=False)
    if answer.confidence < 0.55 and similarity < 0.08:
        return ValidatedResponse(accepted=False, response=response, confidence=answer.confidence, similarity=similarity, reason="low_confidence_low_similarity", requires_clarification=True)
    if retrieval_result.confidence.requires_clarification and similarity < 0.1:
        return ValidatedResponse(accepted=False, response=response, confidence=answer.confidence, similarity=similarity, reason="retrieval_needs_clarification", requires_clarification=True)
    if similarity < 0.03 and top_confidence < 0.45:
        return ValidatedResponse(accepted=False, response=response, confidence=answer.confidence, similarity=similarity, reason="potential_hallucination", requires_clarification=True)
    return ValidatedResponse(accepted=True, response=response, confidence=answer.confidence, similarity=similarity, reason="accepted", requires_clarification=False)
