from __future__ import annotations

from typing import Optional

from app.config import settings


def build_escalation_message(level_1: str, level_2: str) -> str:
    return (
        "That sounds exciting, and I love the creativity. "
        "I am sorry, I do not have reliable expertise on this specific topic in my current knowledge base. "
        "If you would like, I can still help with topics covered here, such as services, setup, pricing, or support. "
        "Or I can connect you with our escalation contacts:\n"
        f"- Level 1: {level_1}\n"
        f"- Level 2: {level_2}\n"
        "Would you like me to connect you?"
    )


def is_escalation_contacts_message(text: Optional[str]) -> bool:
    if not text:
        return False
    lower = text.lower()
    markers = ["escalation contacts", "level 1:", "level 2:", "would you like me to connect you"]
    return all(marker in lower for marker in ("level 1:", "level 2:")) or any(marker in lower for marker in markers)


def looks_like_booking_intent(text: str) -> bool:
    normalized = (text or "").lower().strip()
    if not normalized:
        return False
    booking_keywords = ["appointment", "book", "booking", "schedule", "calendar", "slot", "meeting", "demo call", "consultation"]
    return any(keyword in normalized for keyword in booking_keywords)


def append_appointment_cta_if_needed(response_text: str, is_first_turn: bool, user_message: Optional[str] = None) -> str:
    if not is_first_turn or not response_text:
        return response_text
    if not looks_like_booking_intent(user_message or ""):
        return response_text
    lower = response_text.lower()
    appointment_keywords = ["appointment", "book", "booking", "schedule", "calendar", "slot"]
    if any(keyword in lower for keyword in appointment_keywords):
        return response_text
    return f"{response_text}\n\nWould you like to book an appointment? You can choose a preferred slot from the in-app calendar."


def should_escalate_response(text: Optional[str]) -> bool:
    if not text:
        return True
    normalized = text.lower()
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


def default_escalation_contacts() -> tuple[str, str]:
    return settings.DEFAULT_ESCALATION_CONTACT_LEVEL_1, settings.DEFAULT_ESCALATION_CONTACT_LEVEL_2
