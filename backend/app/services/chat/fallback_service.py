from __future__ import annotations

import hashlib
import re
from typing import Optional, Sequence


_FALLBACK_VARIANTS = (
    "I could not find reliable information about that in this knowledge base yet. I can still help with services, setup, pricing, or support.",
    "That topic is not covered clearly in the available context right now. If you want, I can help with what is documented here, like services, onboarding, pricing, or support.",
    "I do not have enough verified context to answer that accurately yet. I can still help with questions about services, setup steps, pricing plans, or support options.",
    "I am not seeing a reliable answer for that in the current knowledge base. I can still help with common topics here, including services, setup, pricing, and support.",
)


def _select_variant(options: Sequence[str], seed_text: Optional[str]) -> str:
    if not options:
        return ""
    if not seed_text:
        return options[0]
    digest = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()
    return options[int(digest[:8], 16) % len(options)]


def build_soft_fallback_message(seed_text: Optional[str] = None) -> str:
    return _select_variant(_FALLBACK_VARIANTS, seed_text)


def build_grounded_fallback_message(context_snippet: str) -> str:
    snippet = " ".join((context_snippet or "").split()).strip()
    if not snippet:
        return build_soft_fallback_message()
    return (
        "I found related information in the knowledge base, but it does not fully answer your question. "
        f"The relevant context says: {snippet}"
    )


def build_clarifying_question(message: str, target_year: Optional[str], conflicting_values: Sequence[int]) -> str:
    lowered = (message or "").lower()
    post_keywords = {"blog", "post", "posts", "article", "articles", "published", "publish", "count", "how many", "number of", "archive"}
    is_post_related = any(keyword in lowered for keyword in post_keywords) or bool(conflicting_values) or bool(target_year)

    if not is_post_related:
        return "I found some information related to your question, but I need a bit of clarification. Could you rephrase or provide more details?"

    if conflicting_values:
        sampled = ", ".join(str(value) for value in conflicting_values[:3])
        if target_year:
            return (
                f"I found multiple possible counts for {target_year} ({sampled}) in the current context. "
                f"Do you want the total number of posts from the blog archive for {target_year}?"
            )
        return f"I found multiple possible counts ({sampled}) in the current context. Could you clarify what exact count you want?"

    if target_year:
        return (
            f"I found related information, but I need one quick clarification to answer reliably: do you want the total number of posts published in calendar year {target_year}?"
        )

    return "I found related information, but I need one quick clarification to answer reliably: what exact period or post type should I count?"
