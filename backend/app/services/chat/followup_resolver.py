from __future__ import annotations

import re
from typing import Iterable

from app.models import Conversation
from app.services.chat.types import FollowupContext


_GENERIC_FOLLOWUP_TOKENS = {
    "a", "an", "and", "are", "begin", "build", "can", "could", "create", "do", "first",
    "for", "get", "give", "help", "how", "i", "learn", "make", "me", "my", "need", "on", "program",
    "show", "start", "step", "steps", "teach", "tell", "to", "want", "write", "you", "your",
    "guide", "guidance", "instruction", "instructions", "example", "examples", "detail", "details",
    "more", "next",
}

_SMALL_TALK_TOKENS = {
    "hi", "hello", "hey", "hola", "hii", "yo", "thanks", "thank", "thankyou", "thank-you",
    "good morning", "good afternoon", "good evening", "ok", "okay", "cool", "nice", "what", "huh",
}


def _normalize_message(message: str) -> str:
    return re.sub(r"\s+", " ", (message or "").strip().lower())


def _is_small_talk_message(message: str) -> bool:
    lowered = _normalize_message(message)
    if not lowered:
        return False
    if lowered in _SMALL_TALK_TOKENS:
        return True
    tokens = set(keyword_query(lowered).split())
    return bool(tokens) and tokens.issubset({"hi", "hello", "hey", "hola", "hii", "yo", "thanks", "thank", "ok", "okay", "cool", "nice", "what", "huh"})


def keyword_query(text: str) -> str:
    tokens = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    keywords = []
    for token in tokens:
        if token in {"the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "were", "what", "when", "where", "which", "who", "how", "why", "can", "could", "would", "should", "a", "an", "in", "on", "of", "to", "is", "it", "as", "at", "by", "or", "we", "our", "us", "i", "me", "my", "they", "their", "them", "about", "those", "these", "have", "has", "had", "many"}:
            continue
        if len(token) > 4 and token.endswith("ies"):
            token = f"{token[:-3]}y"
        elif len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        keywords.append(token)
    return " ".join(keywords[:12])


def _followup_overlap_score(current_message: str, previous_message: str) -> float:
    current_keywords = set(keyword_query(current_message).split())
    previous_keywords = set(keyword_query(previous_message).split())
    if not current_keywords or not previous_keywords:
        return 0.0
    return len(current_keywords & previous_keywords) / max(len(current_keywords), 1)


def _is_referential_followup(message: str) -> bool:
    lower = (message or "").lower().strip()
    if not lower:
        return False
    has_reference = bool(re.search(r"\b(it|that|those|them|this|these|same|again|previous|earlier)\b", lower))
    is_short = len(keyword_query(message).split()) <= 6
    return has_reference and is_short


def _should_include_previous_message(current_message: str, previous_message: str) -> bool:
    if not current_message or not previous_message:
        return False
    current_keywords = set(keyword_query(current_message).split())
    previous_keywords = set(keyword_query(previous_message).split())
    if not current_keywords or not previous_keywords:
        return False
    overlap_ratio = len(current_keywords & previous_keywords) / max(len(current_keywords), 1)
    if overlap_ratio >= 0.35:
        return True
    lower_current = current_message.lower().strip()
    polite_followups = {"please", "yes please", "ok", "okay", "sure", "go ahead", "proceed", "continue", "tell me more", "more", "details", "share more", "can you share"}
    if lower_current in polite_followups:
        return True
    followup_pattern = re.search(
        r"^(and|also|then|same for|what about|how about|please|yes please|ok|okay|sure)\b|\b(it|that|those|them|same|again|previous|earlier)\b",
        lower_current,
    )
    short_query = len(current_keywords) <= 5
    starter_pattern = re.search(
        r"^(want to|i want to|need to|i need to|how to|can you|could you|help me|guide me|show me|teach me)\b",
        lower_current,
    )
    non_generic_tokens = {token for token in current_keywords if token not in _GENERIC_FOLLOWUP_TOKENS}
    underspecified_followup = bool(starter_pattern and short_query and len(non_generic_tokens) == 0)
    return bool((followup_pattern and short_query) or underspecified_followup)


def resolve_followup_context(history: Iterable[Conversation], current_message: str) -> FollowupContext:
    normalized_message = _normalize_message(current_message)
    if _is_small_talk_message(normalized_message):
        return FollowupContext(query_text=current_message, history_message=None, history_response=None, overlap=0.0, is_referential=False)

    best_message = None
    best_response = None
    best_score = -1.0
    for row in history:
        prior_message = (row.message or "").strip()
        if not prior_message or prior_message == current_message.strip():
            continue
        if _is_small_talk_message(prior_message):
            continue
        if not _should_include_previous_message(current_message, prior_message):
            continue
        score = _followup_overlap_score(current_message, prior_message)
        if score > best_score:
            best_score = score
            best_message = prior_message
            best_response = (row.response or "").strip() or None
    query_text = current_message
    if best_message:
        query_text = f"{query_text}\n\nPrevious user message: {best_message}"
        if best_response and _is_referential_followup(current_message):
            compact_response = " ".join(best_response.split())
            query_text = f"{query_text}\n\nPrevious assistant response: {compact_response[:240]}"
    return FollowupContext(query_text=query_text, history_message=best_message, history_response=best_response, overlap=max(best_score, 0.0), is_referential=_is_referential_followup(current_message))
