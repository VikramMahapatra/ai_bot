from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import uuid
import asyncio
from app.database import get_db
from app.models import (
    Conversation,
    WidgetConfig,
    User,
    Lead,
    Appointment,
    AppointmentIntake,
    ContactList,
    Contact,
    HandoffSession,
    HandoffMessage,
)
from app.schemas import ChatMessage, ChatResponse, ConversationHistoryItem, TranslateRequest, TranslateResponse, SuggestedQuestionsResponse
from app.services import generate_chat_response, should_capture_lead, translate_text, stream_chat_response, persist_conversation, get_suggested_questions, append_appointment_cta_if_needed
from app.services.limits_service import get_effective_limits, get_or_create_subscription_usage, get_or_create_usage, increment_usage
from app.services.email_service import send_conversation_email
from app.auth import get_current_user, get_current_user_optional
from app.config import settings
from app.services.handoff_hub import handoff_hub
import logging
import json
import re

from app.services.shopify_service import handle_shopify_intent, verify_shopify_customer
from app.models.organization_settings import OrganizationSettings
from app.services.organization_setting_service import get_settings, get_org_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])
DEFAULT_APPOINTMENT_TIMEZONE = "Asia/Kolkata"


def _build_escalation_contacts_message(widget_config: Optional[WidgetConfig]) -> str:
    level_1 = (
        widget_config.escalation_contact_level_1
        if widget_config and widget_config.escalation_contact_level_1
        else settings.DEFAULT_ESCALATION_CONTACT_LEVEL_1
    )
    level_2 = (
        widget_config.escalation_contact_level_2
        if widget_config and widget_config.escalation_contact_level_2
        else settings.DEFAULT_ESCALATION_CONTACT_LEVEL_2
    )
    return (
        "Sorry-I do not have a reliable answer for this right now. "
        "If you'd like, I can connect you with our escalation contacts:\n"
        f"- Level 1: {level_1}\n"
        f"- Level 2: {level_2}\n"
        "Would you like me to help you reach them?"
    )


def _build_light_handoff_offer_prompt() -> str:
    return (
        "If you'd like, I can connect you with our escalation contacts. "
        "Would you like me to connect you?"
    )


def _is_booking_intent(text: str) -> bool:
    lower = (text or "").lower()
    patterns = [
        "book appointment",
        "book an appointment",
        "schedule appointment",
        "please schedule",
        "schedule please",
        "please book",
        "book please",
        "please set up a meeting",
        "set up a meeting",
        "set appointment",
        "set an appointment",
        "set the appointment",
        "book a call",
        "schedule a call",
        "set up a call",
        "book meeting",
        "schedule meeting",
        "set meeting",
        "book demo",
        "schedule demo",
        "book slot",
        "schedule slot",
        "yes book",
    ]
    if any(pattern in lower for pattern in patterns):
        return True

    tokens = set(re.findall(r"[a-zA-Z0-9]+", lower))
    has_appointment_word = bool(tokens & {"appointment", "meeting", "call", "demo", "slot"})
    has_action_word = bool(tokens & {"book", "schedule", "set"})
    if has_appointment_word and has_action_word:
        return True

    # Handle concise intents like "please schedule" during escalation/handoff flows.
    if has_action_word and "please" in tokens and len(tokens) <= 3:
        return True

    return False


def _is_affirmative(text: str) -> bool:
    tokens = set(re.findall(r"[a-zA-Z0-9]+", (text or "").lower()))
    return bool(tokens & {"yes", "yeah", "yep", "sure", "ok", "okay", "please", "book", "schedule", "connect", "sure"})


def _is_escalation_opt_in(text: str) -> bool:
    raw = (text or "").strip().lower()
    if not raw:
        return False

    # Explicit scheduling intent should always qualify.
    if _is_booking_intent(raw):
        return True

    direct_phrases = {
        "yes",
        "yeah",
        "yep",
        "sure",
        "ok",
        "okay",
        "go ahead",
        "please do",
        "connect me",
        "contact them",
        "help me reach them",
        "proceed",
        "yes please",
        "sure"
    }
    if raw in direct_phrases:
        return True

    tokens = re.findall(r"[a-zA-Z0-9]+", raw)
    if len(tokens) > 5:
        # Long free-form text like "yes, I want to build..." should not auto-start booking.
        return False

    token_set = set(tokens)
    return bool(token_set & {"yes", "yeah", "yep", "sure", "ok", "okay"})


def _is_cancel(text: str) -> bool:
    lower = (text or "").strip().lower()
    return lower in {"cancel", "stop", "nevermind", "never mind", "no"}


def _is_skip(text: str) -> bool:
    lower = (text or "").strip().lower()
    return lower in {"skip", "none", "na", "n/a", "no", "nope"}


def _is_greeting_or_smalltalk(text: str) -> bool:
    lower = (text or "").strip().lower()
    return lower in {
        "hi", "hello", "hey", "hola", "hii", "yo",
        "good morning", "good afternoon", "good evening",
        "thanks", "thank you", "ok", "okay", "cool", "nice"
    }


def _is_resume_booking_intent(text: str) -> bool:
    lower = (text or "").lower()
    phrases = {
        "continue", "continue booking", "resume", "resume booking",
        "go ahead", "yes continue", "proceed", "continue appointment"
    }
    return lower.strip() in phrases


def _mentions_appointment_topic(text: str) -> bool:
    tokens = set(re.findall(r"[a-zA-Z0-9]+", (text or "").lower()))
    return bool(tokens & {"appointment", "appointments", "meeting", "meet", "call", "demo", "slot"})


def _appointment_datetime_examples_message() -> str:
    now_local = datetime.now(ZoneInfo(DEFAULT_APPOINTMENT_TIMEZONE))
    example_1 = (now_local + timedelta(days=1)).replace(hour=15, minute=30, second=0, microsecond=0)
    example_2 = (now_local + timedelta(days=2)).replace(hour=16, minute=0, second=0, microsecond=0)
    example_3 = (now_local + timedelta(days=3)).replace(hour=10, minute=30, second=0, microsecond=0)
    return (
        "Please share your preferred appointment date and time. You can use:\n"
        f"- {example_1.strftime('%Y-%m-%d %H:%M')}\n"
        f"- {example_2.strftime('%d %B %Y %I:%M %p')}\n"
        f"- {example_3.strftime('%d %B, at %I:%M %p')}"
    )


def _prompt_for_next_intake_field(next_field: str) -> str:
    if next_field == "name":
        return "Please share your full name to continue booking."
    if next_field == "email":
        return "Please share your email address to continue booking."
    if next_field == "appointment_at":
        return _appointment_datetime_examples_message()
    if next_field == "timezone":
        return "Please share your timezone (for example: Asia/Kolkata, IST, or UTC)."
    if next_field == "contact":
        return "Please share your email or phone number (or type skip)."
    if next_field == "notes":
        return "Any additional notes for the appointment? (Type skip if none)"
    return "Let's continue the appointment booking flow."


def _is_relevant_for_next_field(text: str, next_field: str) -> bool:
    if not text:
        return False

    if _is_cancel(text) or _is_skip(text) or _is_resume_booking_intent(text):
        return True

    if next_field == "name":
        return _extract_name(text) is not None
    if next_field == "email":
        return _extract_email(text) is not None or bool(re.search(r"\b(email|mail)\b", text.lower()))
    if next_field == "appointment_at":
        return _parse_datetime_input(text) is not None or bool(re.search(r"\b(\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|tomorrow)\b", text.lower()))
    if next_field == "timezone":
        return _extract_timezone(text) is not None or bool(re.search(r"\b(utc|gmt|ist|timezone|time zone)\b", text.lower()))
    if next_field == "contact":
        return _extract_email(text) is not None or _extract_phone(text) is not None or bool(re.search(r"\b(email|phone|mobile|contact)\b", text.lower()))
    if next_field == "notes":
        return True
    return False


def _extract_email(text: str) -> Optional[str]:
    match = re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", text or "")
    return match.group(0) if match else None


def _extract_phone(text: str) -> Optional[str]:
    match = re.search(r"\+?\d[\d\s\-()]{7,}\d", text or "")
    if not match:
        return None
    raw = match.group(0).strip()
    digits_only = re.sub(r"\D", "", raw)
    if len(digits_only) < 8:
        return None
    return raw


def _extract_name(text: str) -> Optional[str]:
    raw = (text or "").strip()
    if not raw:
        return None
    lowered = raw.lower()
    for marker in ["my name is", "name is", "i am", "i'm"]:
        if marker in lowered:
            idx = lowered.find(marker)
            candidate = raw[idx + len(marker):].strip(" .,-")
            if candidate:
                return candidate[:120]
    if len(raw.split()) <= 6 and len(raw) <= 120 and not re.search(r"[@0-9]", raw):
        return raw
    return None


def _parse_datetime_input(text: str) -> Optional[datetime]:
    if not text:
        return None

    candidate = text.strip()
    parsed = datetime.strptime(candidate, fmt)
    now_local = datetime.now(ZoneInfo(DEFAULT_APPOINTMENT_TIMEZONE))

    lower = candidate.lower()
    relative_time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", lower)
    if lower.startswith("tomorrow") and relative_time_match:
        hour = int(relative_time_match.group(1))
        minute = int(relative_time_match.group(2) or 0)
        meridiem = relative_time_match.group(3)
        if meridiem == "pm" and hour != 12:
            hour += 12
        if meridiem == "am" and hour == 12:
            hour = 0
        base = now_local.replace(second=0, microsecond=0)
        base = base.replace(hour=hour, minute=minute)
        return base + timedelta(days=1)

    candidate = re.sub(r"\b(\d{1,2})(st|nd|rd|th)\b", r"\1", candidate, flags=re.IGNORECASE)
    candidate = candidate.replace(",", " ")
    candidate = re.sub(r"\bat\b", " ", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"\s+", " ", candidate).strip()

    if re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", candidate):
        try:
            return datetime.fromisoformat(candidate.replace("Z", "+00:00")).astimezone(
                ZoneInfo(DEFAULT_APPOINTMENT_TIMEZONE)
            )
        except Exception:
            pass

    formats = [
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %I:%M %p",
        "%Y/%m/%d %H:%M",
        "%d-%m-%Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%d %B %Y %I:%M %p",
        "%d %B %Y %H:%M",
        "%d %b %Y %I:%M %p",
        "%d %b %Y %H:%M",
        "%d %B %I:%M %p",
        "%d %B %H:%M",
        "%d %b %I:%M %p",
        "%d %b %H:%M",
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(candidate, fmt)
            parsed = parsed.replace(tzinfo=ZoneInfo(DEFAULT_APPOINTMENT_TIMEZONE))
            if "%Y" not in fmt:
                parsed = parsed.replace(year=now_local.year)
                if parsed < now_local:
                    parsed = parsed.replace(year=now_local.year + 1)
            return parsed
        except Exception:
            continue

    match = re.search(r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}", candidate)
    if match:
        try:
            return datetime.strptime(match.group(0), "%Y-%m-%d %H:%M")
        except Exception:
            return None

    return None


def _extract_timezone(text: str) -> Optional[str]:
    if not text:
        return None

    upper_text = text.strip().upper()
    alias_map = {
        "UTC": "UTC",
        "GMT": "UTC",
        "IST": "Asia/Kolkata",
        "CET": "Europe/Paris",
        "EET": "Europe/Athens",
        "PST": "America/Los_Angeles",
        "PDT": "America/Los_Angeles",
        "EST": "America/New_York",
        "EDT": "America/New_York",
    }
    if upper_text in alias_map:
        return alias_map[upper_text]

    match = re.search(r"\b[A-Za-z_]+/[A-Za-z_]+\b", text)
    if not match:
        return None

    tz_name = _canonical_timezone(match.group(0).strip())
    try:
        ZoneInfo(tz_name)
    except Exception:
        return None
    return tz_name


def _last_response_was_escalation(db: Session, session_id: str, widget_id: str) -> bool:
    last = db.query(Conversation).filter(
        Conversation.session_id == session_id,
        Conversation.widget_id == widget_id,
    ).order_by(Conversation.created_at.desc(), Conversation.id.desc()).first()
    if not last or not last.response:
        return False
    lower = last.response.lower()
    escalation_markers = [
        "escalation contacts",
        "level 1:",
        "level 2:",
        "would you like me to connect you",
        "set up a meeting now",
        "set up a meeting for you", 
        "don’t have a reliable answer",
        "don't have a reliable answer",
        "don’t have reliable expertise",
        "don't have reliable expertise",
    ]
    return any(marker in lower for marker in escalation_markers)


def _get_active_intake(db: Session, session_id: str, widget_id: str, organization_id: int) -> Optional[AppointmentIntake]:
    return db.query(AppointmentIntake).filter(
        AppointmentIntake.session_id == session_id,
        AppointmentIntake.widget_id == widget_id,
        AppointmentIntake.organization_id == organization_id,
        AppointmentIntake.status == "collecting",
    ).order_by(AppointmentIntake.created_at.desc(), AppointmentIntake.id.desc()).first()


def _has_booked_appointment(db: Session, session_id: str, widget_id: str, organization_id: int) -> bool:
    existing = db.query(Appointment.id).filter(
        Appointment.session_id == session_id,
        Appointment.widget_id == widget_id,
        Appointment.organization_id == organization_id,
        Appointment.status != "cancelled",
    ).order_by(Appointment.created_at.desc(), Appointment.id.desc()).first()
    return existing is not None


def _get_open_handoff_session(db: Session, session_id: str, widget_id: str, organization_id: int) -> Optional[HandoffSession]:
    return db.query(HandoffSession).filter(
        HandoffSession.session_id == session_id,
        HandoffSession.widget_id == widget_id,
        HandoffSession.organization_id == organization_id,
        HandoffSession.status.in_(["waiting_for_agent", "assigned"]),
    ).order_by(HandoffSession.created_at.desc(), HandoffSession.id.desc()).first()


def _response_looks_like_no_answer(response_text: str) -> bool:
    lower = (response_text or "").strip().lower()
    if not lower:
        return False

    # Normalize common smart punctuation from model output before substring checks.
    normalized = (
        lower
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2014", "-")
        .replace("\u2013", "-")
    )

    if any(pattern in normalized for pattern in settings.handoff_no_answer_patterns_list):
        return True

    fallback_hints = [
        "reliable expertise",
        "escalation contacts",
        "would you like me to connect you",
        "could not find reliable information",
        "topic is not covered",
        "not covered clearly",
        "not enough verified context",
        "not seeing a reliable answer",
        "not covered in the current knowledge base",
    ]
    return any(hint in normalized for hint in fallback_hints)


def _normalize_handoff_text(text: Optional[str]) -> str:
    return (
        (text or "")
        .strip()
        .lower()
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2014", "-")
        .replace("\u2013", "-")
    )


def _response_offers_handoff(response_text: Optional[str]) -> bool:
    normalized = _normalize_handoff_text(response_text)
    if not normalized:
        return False

    offer_markers = [
        "would you like me to connect you",
        "would you like me to help you reach them",
        "or i can connect you with our escalation contacts",
        "i can connect you with our escalation contacts",
        "before i transfer this handoff request to a live agent",
    ]
    return any(marker in normalized for marker in offer_markers)


def _ensure_handoff_offer_response(response_text: str, widget_config: Optional[WidgetConfig]) -> str:
    if not _response_looks_like_no_answer(response_text):
        return response_text
    if _response_offers_handoff(response_text):
        return response_text

    base = (response_text or "").strip()
    if not base:
        return _build_escalation_contacts_message(widget_config)

    return f"{base}\n\n{_build_light_handoff_offer_prompt()}"


def _has_captured_lead_for_session(
    db: Session,
    organization_id: int,
    session_id: str,
    widget_id: str,
) -> bool:
    query = db.query(Lead.id).filter(
        Lead.organization_id == organization_id,
        Lead.session_id == session_id,
    )
    if widget_id:
        query = query.filter(Lead.widget_id == widget_id)
    return query.first() is not None


def _handoff_lead_capture_prompt_if_needed(
    db: Session,
    organization_id: int,
    session_id: str,
    widget_id: str,
    user_message: str,
) -> Optional[str]:
    if _get_open_handoff_session(db, session_id, widget_id, organization_id):
        return None

    offered_response = _latest_handoff_offer_response(db, session_id, widget_id)
    if not offered_response:
        return None
    if not _is_handoff_opt_in(user_message):
        return None
    if _has_captured_lead_for_session(db, organization_id, session_id, widget_id):
        return None

    return (
        "Before I transfer this handoff request to a live agent, "
        "please fill the quick contact form in chat so we can reach you if needed."
    )


def _latest_handoff_offer_response(db: Session, session_id: str, widget_id: str) -> Optional[str]:
    last = db.query(Conversation).filter(
        Conversation.session_id == session_id,
        Conversation.widget_id == widget_id,
    ).order_by(Conversation.created_at.desc(), Conversation.id.desc()).first()
    if not last or not last.response:
        return None
    return last.response if _response_offers_handoff(last.response) else None


def _is_handoff_opt_in(text: str) -> bool:
    normalized = _normalize_handoff_text(text)
    if not normalized:
        return False

    negative_phrases = {
        "no",
        "nope",
        "nah",
        "not now",
        "no thanks",
        "don't",
        "do not",
        "dont",
        "stop",
    }
    if normalized in negative_phrases:
        return False

    direct_affirmative = {
        "yes",
        "yeah",
        "yep",
        "sure",
        "ok",
        "okay",
        "go ahead",
        "please do",
        "yes please",
        "connect me",
    }
    if normalized in direct_affirmative:
        return True

    tokens = set(re.findall(r"[a-zA-Z0-9]+", normalized))
    if not tokens:
        return False

    if "connect" in tokens and ({"human", "agent", "support", "live", "escalation", "team"} & tokens or "me" in tokens):
        return True
    if ({"talk", "speak"} & tokens) and ({"human", "agent", "support", "team"} & tokens):
        return True
    if {"handoff", "escalate", "escalation"} & tokens:
        return True

    return False


def _is_direct_live_agent_request(text: str) -> bool:
    normalized = _normalize_handoff_text(text)
    if not normalized:
        return False

    negative_phrases = {
        "no",
        "no thanks",
        "not now",
        "dont connect",
        "don't connect",
    }
    if normalized in negative_phrases:
        return False

    direct_markers = [
        "live agent",
        "human agent",
        "real agent",
        "customer support agent",
        "support agent",
        "representative",
        "talk to agent",
        "chat to agent",
        "talk to live",
        "chat to live",
        "connect me to",
        "transfer me",
        "handoff",
    ]
    if any(marker in normalized for marker in direct_markers):
        return True

    tokens = set(re.findall(r"[a-zA-Z0-9]+", normalized))
    if not tokens:
        return False

    has_agent_target = bool(tokens & {"agent", "human", "live", "support", "representative", "team"})
    has_action = bool(tokens & {"talk", "chat", "speak", "connect", "transfer", "handoff", "reach"})
    return has_agent_target and has_action


def _handoff_lead_capture_prompt_for_direct_request(
    db: Session,
    organization_id: int,
    session_id: str,
    widget_id: str,
    user_message: str,
) -> Optional[str]:
    if _get_open_handoff_session(db, session_id, widget_id, organization_id):
        return None
    if not _is_direct_live_agent_request(user_message):
        return None
    if _has_captured_lead_for_session(db, organization_id, session_id, widget_id):
        return None

    return (
        "Before I transfer this handoff request to a live agent, "
        "please fill the quick contact form in chat so we can reach you if needed."
    )


def _create_direct_handoff_request(
    db: Session,
    organization_id: int,
    session_id: str,
    widget_id: str,
    user_message: str,
) -> Optional[HandoffSession]:
    if _get_open_handoff_session(db, session_id, widget_id, organization_id):
        return None
    if not _is_direct_live_agent_request(user_message):
        return None

    handoff_session = _create_or_get_handoff_session(
        db,
        organization_id,
        session_id,
        widget_id,
        user_message,
        "User requested a live agent directly.",
        "user_requested_live_agent_directly",
    )
    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="bot",
        sender_user_id=None,
        message=settings.HUMAN_HANDOFF_WAITING_MESSAGE,
    ))
    handoff_session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(handoff_session)
    return handoff_session


def _create_handoff_after_user_confirmation(
    db: Session,
    organization_id: int,
    session_id: str,
    widget_id: str,
    user_message: str,
) -> Optional[HandoffSession]:
    if _get_open_handoff_session(db, session_id, widget_id, organization_id):
        return None

    offered_response = _latest_handoff_offer_response(db, session_id, widget_id)
    if not offered_response:
        return None
    if not _is_handoff_opt_in(user_message):
        return None

    handoff_session = _create_or_get_handoff_session(
        db,
        organization_id,
        session_id,
        widget_id,
        user_message,
        offered_response,
        "user_confirmed_handoff",
    )
    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="bot",
        sender_user_id=None,
        message=settings.HUMAN_HANDOFF_WAITING_MESSAGE,
    ))
    handoff_session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(handoff_session)
    return handoff_session


def _handoff_wait_timeout_seconds() -> int:
    try:
        value = int(settings.HUMAN_HANDOFF_WAIT_TIMEOUT_SECONDS)
        return value if value > 0 else 120
    except Exception:
        return 120


def _handoff_max_wait_cycles() -> int:
    try:
        value = int(settings.HUMAN_HANDOFF_MAX_WAIT_CYCLES)
        return value if value > 0 else 2
    except Exception:
        return 2


def _next_handoff_wait_expiry(from_time: Optional[datetime] = None) -> datetime:
    base = from_time or datetime.utcnow()
    return base + timedelta(seconds=_handoff_wait_timeout_seconds())


def _final_handoff_timeout_message() -> str:
    base = (settings.HUMAN_HANDOFF_FINAL_TIMEOUT_MESSAGE or "").strip()
    if not base:
        base = "Live users are still busy."

    normalized = base.lower()
    if "set up a meeting" in normalized or "schedule" in normalized:
        return base

    return f"{base} If you want, I can set up a meeting for you now."


def _close_handoff_to_bot_after_timeout(
    db: Session,
    handoff_session: HandoffSession,
    now: Optional[datetime] = None,
    include_bot_message: bool = True,
) -> None:
    closed_at = now or datetime.utcnow()

    if include_bot_message:
        db.add(HandoffMessage(
            handoff_session_id=handoff_session.id,
            sender_type="bot",
            sender_user_id=None,
            message=_final_handoff_timeout_message(),
        ))

    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="system",
        sender_user_id=None,
        message="Human handoff was closed because no live user was available in time.",
    ))

    handoff_session.status = "bot_active"
    handoff_session.assigned_agent_id = None
    handoff_session.waiting_timeout_notified = True
    handoff_session.waiting_expires_at = None
    handoff_session.updated_at = closed_at
    handoff_session.closed_at = closed_at


def _is_wait_more_intent(text: str) -> bool:
    lower = (text or "").strip().lower()
    if not lower:
        return False

    wait_markers = [
        "wait",
        "wait more",
        "continue waiting",
        "try again",
        "yes",
        "ok",
        "okay",
        "sure",
    ]
    return any(marker in lower for marker in wait_markers)


def _emit_handoff_timeout_prompt_if_needed(db: Session, handoff_session: HandoffSession) -> bool:
    if handoff_session.status != "waiting_for_agent" or handoff_session.assigned_agent_id is not None:
        return False

    now = datetime.utcnow()
    if handoff_session.waiting_expires_at is None:
        handoff_session.waiting_expires_at = _next_handoff_wait_expiry(now)
        handoff_session.updated_at = now
        db.commit()
        db.refresh(handoff_session)
        return False

    if now < handoff_session.waiting_expires_at:
        return False

    current_cycle = max(1, int(handoff_session.wait_cycle or 1))
    max_wait_cycles = _handoff_max_wait_cycles()
    if current_cycle >= max_wait_cycles:
        _close_handoff_to_bot_after_timeout(db, handoff_session, now=now, include_bot_message=True)
        db.commit()
        db.refresh(handoff_session)
        return True

    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="bot",
        sender_user_id=None,
        message=settings.HUMAN_HANDOFF_BUSY_MESSAGE,
    ))
    handoff_session.wait_cycle = min(max_wait_cycles, current_cycle + 1)
    handoff_session.waiting_expires_at = _next_handoff_wait_expiry(now)
    handoff_session.waiting_timeout_notified = True
    handoff_session.updated_at = now
    db.commit()
    db.refresh(handoff_session)
    return True


def _create_or_get_handoff_session(
    db: Session,
    organization_id: int,
    session_id: str,
    widget_id: str,
    user_message: str,
    bot_response: str,
    handoff_reason: str,
) -> HandoffSession:
    existing = _get_open_handoff_session(db, session_id, widget_id, organization_id)
    if existing:
        return existing

    handoff_session = HandoffSession(
        chat_id=str(uuid.uuid4()),
        session_id=session_id,
        widget_id=widget_id,
        organization_id=organization_id,
        status="waiting_for_agent",
        handoff_reason=handoff_reason,
        bot_suggested_answer=(bot_response or "")[:2000] or None,
        wait_cycle=1,
        waiting_expires_at=_next_handoff_wait_expiry(),
        waiting_timeout_notified=False,
    )
    db.add(handoff_session)
    db.flush()

    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="user",
        sender_user_id=None,
        message=(user_message or "")[:4000] or "User requested assistance",
    ))
    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="bot",
        sender_user_id=None,
        message=(bot_response or "")[:4000] or "Bot fallback was triggered",
    ))
    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="system",
        sender_user_id=None,
        message="A human handoff request has been created.",
    ))
    db.commit()
    db.refresh(handoff_session)
    return handoff_session


def _route_user_message_to_handoff_if_active(
    db: Session,
    organization_id: int,
    session_id: str,
    widget_id: str,
    message_text: str,
) -> Optional[dict]:
    session = _get_open_handoff_session(db, session_id, widget_id, organization_id)
    if not session:
        return None

    now = datetime.utcnow()
    response_text = settings.HUMAN_HANDOFF_WAITING_MESSAGE
    ui_action: Optional[str] = None
    add_bot_message_text: Optional[str] = None
    max_wait_cycles = _handoff_max_wait_cycles()

    if session.status == "waiting_for_agent" and session.assigned_agent_id is None:
        ui_action = "open_human_handoff"
        if session.waiting_expires_at is None:
            session.waiting_expires_at = _next_handoff_wait_expiry(now)

        current_wait_cycle = max(1, int(session.wait_cycle or 1))
        wants_booking = _is_booking_intent(message_text) or _mentions_appointment_topic(message_text)

        if session.waiting_timeout_notified and wants_booking:
            response_text = "If you would like to set a meeting, please fill this short form and I will set it up for you."
            ui_action = "open_appointment_form"
            add_bot_message_text = response_text
            session.status = "bot_active"
            session.assigned_agent_id = None
            session.waiting_expires_at = None
            session.waiting_timeout_notified = True
            session.closed_at = now
        elif session.waiting_expires_at is not None and now >= session.waiting_expires_at:
            if current_wait_cycle >= max_wait_cycles:
                if wants_booking:
                    response_text = "Live users are still busy, so I am moving you back to bot support. If you would like to set a meeting, please fill this short form and I will set it up for you."
                    ui_action = "open_appointment_form"
                    session.status = "bot_active"
                    session.assigned_agent_id = None
                    session.waiting_expires_at = None
                    session.waiting_timeout_notified = True
                    session.closed_at = now
                else:
                    response_text = _final_handoff_timeout_message()
                    ui_action = None
                    _close_handoff_to_bot_after_timeout(db, session, now=now, include_bot_message=False)
                add_bot_message_text = response_text
            else:
                session.wait_cycle = min(max_wait_cycles, current_wait_cycle + 1)
                session.waiting_expires_at = _next_handoff_wait_expiry(now)
                session.waiting_timeout_notified = True
                response_text = settings.HUMAN_HANDOFF_BUSY_MESSAGE
                add_bot_message_text = response_text
        elif session.waiting_timeout_notified and _is_wait_more_intent(message_text):
            if current_wait_cycle >= max_wait_cycles:
                response_text = _final_handoff_timeout_message()
                add_bot_message_text = response_text
                ui_action = None
                _close_handoff_to_bot_after_timeout(db, session, now=now, include_bot_message=False)
            else:
                session.wait_cycle = min(max_wait_cycles, current_wait_cycle + 1)
                session.waiting_expires_at = _next_handoff_wait_expiry(now)
                session.waiting_timeout_notified = False
                response_text = "Thanks for waiting. I will try to connect you with a live user for 2 more minutes."
                add_bot_message_text = response_text
        elif session.waiting_timeout_notified:
            response_text = settings.HUMAN_HANDOFF_BUSY_MESSAGE
        else:
            response_text = settings.HUMAN_HANDOFF_WAITING_MESSAGE
    elif session.status == "assigned":
        # Avoid repeating a bot acknowledgement while a live user is already assigned.
        response_text = ""

    normalized_user_message = ((message_text or "")[:4000] or "").strip()
    should_store_user_message = bool(normalized_user_message)
    if normalized_user_message:
        latest_user_message = db.query(HandoffMessage).filter(
            HandoffMessage.handoff_session_id == session.id,
            HandoffMessage.sender_type == "user",
        ).order_by(HandoffMessage.id.desc()).first()

        if latest_user_message:
            same_text = ((latest_user_message.message or "").strip() == normalized_user_message)
            latest_created_at = getattr(latest_user_message, "created_at", None)
            is_recent_duplicate = bool(
                latest_created_at and (now - latest_created_at).total_seconds() <= 3
            )
            if same_text and is_recent_duplicate:
                should_store_user_message = False

    if should_store_user_message:
        db.add(HandoffMessage(
            handoff_session_id=session.id,
            sender_type="user",
            sender_user_id=None,
            message=normalized_user_message,
        ))

    if add_bot_message_text:
        db.add(HandoffMessage(
            handoff_session_id=session.id,
            sender_type="bot",
            sender_user_id=None,
            message=add_bot_message_text,
        ))

    session.updated_at = now
    db.commit()
    db.refresh(session)
    return {
        "session": session,
        "response_text": response_text,
        "ui_action": ui_action,
    }


def _normalize_phone(phone: Optional[str]) -> str:
    return re.sub(r"\D", "", phone or "")


def _agent_contact_list_name(widget_config: WidgetConfig) -> str:
    base_name = (widget_config.name or widget_config.widget_id or "Agent").strip() or "Agent"
    # Keep names readable while avoiding overly long values in DB.
    if len(base_name) > 80:
        base_name = f"{base_name[:77]}..."
    return f"{base_name} - Appointment Contacts"


def _agent_contact_list_marker(widget_config: WidgetConfig) -> str:
    return f"AUTO_AGENT_APPOINTMENT_LIST::{widget_config.widget_id}"


def _get_or_create_agent_contact_list(db: Session, widget_config: WidgetConfig) -> Optional[ContactList]:
    if not widget_config.organization_id:
        return None

    marker = _agent_contact_list_marker(widget_config)
    contact_list = db.query(ContactList).filter(
        ContactList.organization_id == widget_config.organization_id,
        ContactList.description == marker,
    ).first()

    if contact_list:
        return contact_list

    list_name = _agent_contact_list_name(widget_config)
    contact_list = db.query(ContactList).filter(
        ContactList.organization_id == widget_config.organization_id,
        ContactList.list_name == list_name,
    ).first()

    if contact_list:
        if (contact_list.description or "") != marker:
            contact_list.description = marker
        return contact_list

    contact_list = ContactList(
        organization_id=widget_config.organization_id,
        list_name=list_name,
        description=marker,
    )
    db.add(contact_list)
    db.flush()
    return contact_list


def _sync_appointment_contact_to_agent_list(db: Session, widget_config: WidgetConfig, appointment: Appointment) -> None:
    cleaned_email = (appointment.email or "").strip().lower()
    cleaned_phone = (appointment.phone or "").strip()
    normalized_phone = _normalize_phone(cleaned_phone)

    if not cleaned_email and not normalized_phone:
        return

    contact_list = _get_or_create_agent_contact_list(db, widget_config)
    if not contact_list:
        return

    existing_contacts = db.query(Contact).filter(Contact.contact_list_id == contact_list.id).all()
    for existing in existing_contacts:
        existing_email = (existing.email or "").strip().lower()
        existing_phone_normalized = _normalize_phone((existing.phone or "").strip())

        if cleaned_email and existing_email and existing_email == cleaned_email:
            return
        if normalized_phone and existing_phone_normalized and existing_phone_normalized == normalized_phone:
            return

    cleaned_name = (appointment.name or "").strip() or None
    db.add(Contact(
        contact_list_id=contact_list.id,
        name=cleaned_name,
        email=cleaned_email or None,
        phone=cleaned_phone or None,
        session_id=appointment.session_id if appointment and appointment.session_id else None
    ))


def _finalize_intake_appointment(
    db: Session,
    user: User,
    widget_config: WidgetConfig,
    active: AppointmentIntake,
    session_id: str,
    widget_id: str,
) -> str:
    if not (active.email or "").strip():
        active.next_field = "email"
        db.commit()
        return "Please share your email address before I confirm this appointment."

    dt_value = active.appointment_at
    if not dt_value:
        active.next_field = "appointment_at"
        db.commit()
        return f"I am missing appointment time. {_appointment_datetime_examples_message()}"

    tz_name = _canonical_timezone(active.timezone or DEFAULT_APPOINTMENT_TIMEZONE) or DEFAULT_APPOINTMENT_TIMEZONE
    try:
        tz_obj = ZoneInfo(tz_name)
    except Exception:
        tz_obj = timezone.utc
        tz_name = "UTC"

    if dt_value.tzinfo is None:
        dt_value = dt_value.replace(tzinfo=tz_obj)

    now_value = datetime.now(timezone.utc)
    if dt_value.astimezone(timezone.utc) <= now_value:
        active.next_field = "appointment_at"
        db.commit()
        return f"That time is in the past. {_appointment_datetime_examples_message()}"

    appointment = Appointment(
        session_id=session_id,
        widget_id=widget_id,
        user_id=user.id,
        organization_id=user.organization_id,
        name=active.name or "Guest",
        email=active.email,
        phone=active.phone,
        notes=active.notes,
        timezone=tz_name,
        appointment_at=dt_value,
        status="booked",
    )
    db.add(appointment)
    _sync_appointment_contact_to_agent_list(db, widget_config, appointment)

    active.appointment_at = dt_value
    active.timezone = tz_name
    active.status = "completed"
    active.next_field = "completed"
    db.commit()
    db.refresh(appointment)

    local_dt = appointment.appointment_at.astimezone(tz_obj)
    time_label = local_dt.strftime("%d %b %Y, %I:%M %p")
    contact_line = appointment.email or appointment.phone or "not provided"

    return _build_appointment_confirmation_message(
        time_label=time_label,
        tz_name=tz_name,
        name=appointment.name,
        contact=contact_line,
    )


def _handle_appointment_intake_flow(
    db: Session,
    user: User,
    widget_config: WidgetConfig,
    session_id: str,
    widget_id: str,
    incoming_text: str,
) -> Optional[str]:
    text = (incoming_text or "").strip()
    if not text:
        return None

    active = _get_active_intake(db, session_id, widget_id, user.organization_id)

    if active and _is_cancel(text):
        active.status = "cancelled"
        active.next_field = "cancelled"
        db.commit()
        return "No problem, I have cancelled the appointment booking flow. If you want, we can start again anytime."

    if active and _is_resume_booking_intent(text):
        return _prompt_for_next_intake_field(active.next_field)

    if active and (_is_booking_intent(text) or _mentions_appointment_topic(text) or _is_escalation_opt_in(text)):
        # Only resume intake when user explicitly stays on appointment/escalation intent.
        return _prompt_for_next_intake_field(active.next_field)

    if active and _is_greeting_or_smalltalk(text):
        # Do not hijack casual chat with intake parser errors.
        return None

    if active and not _is_relevant_for_next_field(text, active.next_field):
        return None

    if not active:
        if _has_booked_appointment(db, session_id, widget_id, user.organization_id):
            if _is_booking_intent(text) or _mentions_appointment_topic(text) or _is_escalation_opt_in(text):
                return (
                    "Your meeting is already scheduled. "
                    "If you want to reschedule, just share a new preferred date and time."
                )
            return None

        booking_intent = _is_booking_intent(text)
        escalation_affirmation = _last_response_was_escalation(db, session_id, widget_id) and _is_escalation_opt_in(text)
        should_start = booking_intent or escalation_affirmation
        if not should_start:
            return None

        active = AppointmentIntake(
            session_id=session_id,
            widget_id=widget_id,
            user_id=user.id,
            organization_id=user.organization_id,
            status="collecting",
            next_field="name",
        )
        db.add(active)
        db.commit()

        if escalation_affirmation:
            return "Perfect, I can auto-book an appointment for you now. Please share your full name to get started."

        return (
            "Absolutely, I can auto-book an appointment for you right now. "
            "Please share your full name to get started."
        )

    if active.next_field == "name":
        name = _extract_name(text)
        if not name:
            return "Please share your full name (for example: My name is Vikram Mahapatra)."
        active.name = name
        active.next_field = "email"
        db.commit()
        return f"Thanks, {name}. Please share your email address to continue booking."

    if active.next_field == "email":
        email = _extract_email(text)
        if not email:
            return "Please share a valid email address (for example: name@example.com)."
        active.email = email
        if active.appointment_at:
            db.commit()
            return _finalize_intake_appointment(
                db=db,
                user=user,
                widget_config=widget_config,
                active=active,
                session_id=session_id,
                widget_id=widget_id,
            )
        active.next_field = "appointment_at"
        db.commit()
        return _appointment_datetime_examples_message()

    if active.next_field == "appointment_at":
        dt_value = _parse_datetime_input(text)
        if not dt_value:
            return f"I could not parse the date/time. {_appointment_datetime_examples_message()}"

        active.appointment_at = dt_value
        detected_timezone = _extract_timezone(text)
        active.timezone = _canonical_timezone(detected_timezone or active.timezone or DEFAULT_APPOINTMENT_TIMEZONE)
        db.commit()
        return _finalize_intake_appointment(
            db=db,
            user=user,
            widget_config=widget_config,
            active=active,
            session_id=session_id,
            widget_id=widget_id,
        )

    if active.next_field == "timezone":
        if _is_skip(text):
            active.timezone = DEFAULT_APPOINTMENT_TIMEZONE
        else:
            timezone_name = _extract_timezone(text)
            if not timezone_name:
                return "Please provide a valid timezone, for example: Asia/Kolkata, IST, Europe/London, or UTC."
            active.timezone = _canonical_timezone(timezone_name)

        if not active.appointment_at:
            active.next_field = "appointment_at"
            db.commit()
            return _appointment_datetime_examples_message()

        db.commit()
        return _finalize_intake_appointment(
            db=db,
            user=user,
            widget_config=widget_config,
            active=active,
            session_id=session_id,
            widget_id=widget_id,
        )


    if active.next_field == "contact":
        email = _extract_email(text)
        if not email:
            return "Please share a valid email address (for example: name@example.com)."
        active.email = email
        if active.appointment_at:
            db.commit()
            return _finalize_intake_appointment(
                db=db,
                user=user,
                widget_config=widget_config,
                active=active,
                session_id=session_id,
                widget_id=widget_id,
            )
        active.next_field = "appointment_at"
        db.commit()
        return _appointment_datetime_examples_message()

    if active.next_field == "notes":
        notes = None if _is_skip(text) else text[:1000]
        active.notes = notes
        db.commit()
        return _finalize_intake_appointment(
            db=db,
            user=user,
            widget_config=widget_config,
            active=active,
            session_id=session_id,
            widget_id=widget_id,
        )


    return None


def _get_subscription_session_count(db: Session, organization_id: int, usage) -> int:
    """Count distinct sessions in the active subscription window for accurate conversation limits."""
    if not usage:
        return 0
    
    period_start = usage.period_start
    period_end = usage.period_end

    # normalize if naive
    if period_start and period_start.tzinfo is None:
        period_start = period_start.replace(tzinfo=timezone.utc)

    if period_end and period_end.tzinfo is None:
        period_end = period_end.replace(tzinfo=timezone.utc)

    query = db.query(func.count(func.distinct(Conversation.session_id))).filter(
        Conversation.organization_id == organization_id,
        Conversation.created_at >= period_start,
        Conversation.created_at <= period_end,
    )
    return int(query.scalar() or 0)


def _get_monthly_session_count(db: Session, organization_id: int) -> int:
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    
    query = db.query(func.count(func.distinct(Conversation.session_id))).filter(
        Conversation.organization_id == organization_id,
        Conversation.created_at >= month_start,
    )
    return int(query.scalar() or 0)


def _canonical_timezone(tz_name: Optional[str]) -> Optional[str]:
    if not tz_name:
        return tz_name
    if tz_name == "Asia/Calcutta":
        return "Asia/Kolkata"
    return tz_name


def _build_appointment_confirmation_message(
    time_label: str,
    tz_name: str,
    name: Optional[str] = None,
    contact: Optional[str] = None,
) -> str:
    person = f", {name.strip()}" if name and name.strip() else ""
    if contact and contact.strip() and contact.strip().lower() != "not provided":
        contact_line = f"I will share the meeting details on {contact.strip()}."
    else:
        contact_line = "If you want, I can also add your email or phone for meeting updates."

    return (
        f"Great news{person}! Your meeting is all set for {time_label} ({tz_name}).\n"
        f"{contact_line}\n"
        "If you want to reschedule, just tell me a new date/time."
    )


class EmailConversationRequest(BaseModel):
    session_id: str
    email: EmailStr
    widget_id: Optional[str] = None


class AppointmentBookingRequest(BaseModel):
    session_id: str
    widget_id: str
    appointment_at: datetime
    name: str
    email: EmailStr
    phone: Optional[str] = None
    notes: Optional[str] = None
    timezone: Optional[str] = None


class AppointmentBookingResponse(BaseModel):
    id: int
    session_id: str
    widget_id: str
    appointment_at: datetime
    message: str


class HandoffVideoCallRequest(BaseModel):
    session_id: str
    widget_id: str


class HandoffCallModeRequest(BaseModel):
    session_id: str
    widget_id: str
    mode: str


@router.get("/suggested-questions", response_model=SuggestedQuestionsResponse)
async def suggested_questions(
    widget_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    try:
        organization_id = None
        if widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == widget_id
            ).first()
            if widget_config:
                organization_id = widget_config.organization_id
        elif current_user:
            organization_id = current_user.organization_id

        if organization_id is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid widget_id or user not found. Please provide a valid widget_id or authenticate."
            )

        questions = get_suggested_questions(widget_id, organization_id, db)
        return SuggestedQuestionsResponse(questions=questions)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in suggested questions endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ChatResponse)
async def chat(
    message: ChatMessage,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional),
):
    """Chat endpoint with RAG - uses user's knowledge base"""
    print(f"Received chat message: {message}")
    try:
        # Get user_id from widget_id or authenticated user
        user_id = None
        widget_config = None
        if message.widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == message.widget_id
            ).first()
            if widget_config:
                user_id = widget_config.user_id
        elif current_user:
            # If authenticated admin user, use their ID
            user_id = current_user.id
        
        # If no user_id found, return error
        if user_id is None:
            raise HTTPException(
                status_code=400, 
                detail="Invalid widget_id or user not found. Please provide a valid widget_id or authenticate."
            )
           
        use_shopify = False
        if message.customer_id and message.shop_domain:
            is_valid_customer  = await verify_shopify_customer(db, message.shop_domain, int(message.customer_id))
            use_shopify = is_valid_customer
        
        # Resolve organization for scoping
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found for chat context")
        org_settings = get_org_settings(db, user.organization_id)

        limits = get_effective_limits(db, user.organization_id)
        subscription_usage = get_or_create_subscription_usage(db, user.organization_id)
        if not limits.get("subscription_active"):
            if settings.DEV_BYPASS_SUBSCRIPTION_CHECK:
                logger.warning(
                    "DEV_BYPASS_SUBSCRIPTION_CHECK enabled for org_id=%s; allowing chat without active subscription",
                    user.organization_id,
                )
                limits = {
                    **limits,
                    "subscription_active": True,
                }
            else:
                raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        usage = subscription_usage or get_or_create_usage(db, user.organization_id)

        is_new_session = db.query(Conversation.id).filter(
            Conversation.organization_id == user.organization_id,
            Conversation.session_id == message.session_id,
            Conversation.widget_id == message.widget_id,
        ).first() is None

        # Self-heal historical overcounting from earlier conversation counter logic.
        actual_sessions_used = _get_subscription_session_count(db, user.organization_id, subscription_usage) if subscription_usage else _get_monthly_session_count(db, user.organization_id)
        if subscription_usage and usage.conversations_count and usage.conversations_count > actual_sessions_used:
            usage.conversations_count = actual_sessions_used
            db.commit()
            db.refresh(usage)

        if limits.get("human_handoff_enabled"):
            active_handoff = _route_user_message_to_handoff_if_active(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if active_handoff:
                handoff_session = active_handoff["session"]
                waiting_response = active_handoff["response_text"]
                ui_action = active_handoff.get("ui_action")
                persist_conversation(
                    db,
                    session_id=message.session_id,
                    widget_id=message.widget_id,
                    user_id=user_id,
                    organization_id=user.organization_id,
                    message=message.message,
                    response_text=waiting_response,
                    token_usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    retrieval_trace={
                        "user_query": message.message,
                        "retrieval_query": None,
                        "query_variants": [],
                        "retrieved_chunks": [],
                        "selected_chunks": [],
                        "source_ids": [],
                        "has_context": False,
                        "escalation_triggered": True,
                        "top_distance": None,
                    },
                )
                increment_usage(
                    db,
                    user.organization_id,
                    conversations_count=1 if is_new_session else 0,
                    messages_count=2,
                    tokens_used=0,
                )
                await handoff_hub.broadcast(user.organization_id, {
                    "type": "handoff_user_message",
                    "chat_id": handoff_session.chat_id,
                    "widget_id": handoff_session.widget_id,
                    "session_id": handoff_session.session_id,
                    "status": handoff_session.status,
                    "message": (message.message or "")[:500],
                })
                return ChatResponse(
                    response=waiting_response,
                    session_id=message.session_id,
                    sources=[],
                    ui_action=ui_action,
                    handoff_chat_id=handoff_session.chat_id,
                    handoff_status=handoff_session.status,
                )

            direct_lead_prompt = _handoff_lead_capture_prompt_for_direct_request(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if direct_lead_prompt:
                persist_conversation(
                    db,
                    session_id=message.session_id,
                    widget_id=message.widget_id,
                    user_id=user_id,
                    organization_id=user.organization_id,
                    message=message.message,
                    response_text=direct_lead_prompt,
                    token_usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    retrieval_trace={
                        "user_query": message.message,
                        "retrieval_query": None,
                        "query_variants": [],
                        "retrieved_chunks": [],
                        "selected_chunks": [],
                        "source_ids": [],
                        "has_context": False,
                        "escalation_triggered": True,
                        "top_distance": None,
                    },
                )
                increment_usage(
                    db,
                    user.organization_id,
                    conversations_count=1 if is_new_session else 0,
                    messages_count=2,
                    tokens_used=0,
                )
                return ChatResponse(
                    response=direct_lead_prompt,
                    session_id=message.session_id,
                    sources=[],
                    ui_action="open_lead_form",
                )

            direct_handoff = _create_direct_handoff_request(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if direct_handoff:
                waiting_response = settings.HUMAN_HANDOFF_WAITING_MESSAGE
                persist_conversation(
                    db,
                    session_id=message.session_id,
                    widget_id=message.widget_id,
                    user_id=user_id,
                    organization_id=user.organization_id,
                    message=message.message,
                    response_text=waiting_response,
                    token_usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    retrieval_trace={
                        "user_query": message.message,
                        "retrieval_query": None,
                        "query_variants": [],
                        "retrieved_chunks": [],
                        "selected_chunks": [],
                        "source_ids": [],
                        "has_context": False,
                        "escalation_triggered": True,
                        "top_distance": None,
                    },
                )
                increment_usage(
                    db,
                    user.organization_id,
                    conversations_count=1 if is_new_session else 0,
                    messages_count=2,
                    tokens_used=0,
                )
                await handoff_hub.broadcast(user.organization_id, {
                    "type": "handoff_request_created",
                    "chat_id": direct_handoff.chat_id,
                    "widget_id": direct_handoff.widget_id,
                    "session_id": direct_handoff.session_id,
                    "status": direct_handoff.status,
                    "handoff_reason": direct_handoff.handoff_reason,
                })
                return ChatResponse(
                    response=waiting_response,
                    session_id=message.session_id,
                    sources=[],
                    ui_action="open_human_handoff",
                    handoff_chat_id=direct_handoff.chat_id,
                    handoff_status=direct_handoff.status,
                )

            lead_prompt = _handoff_lead_capture_prompt_if_needed(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if lead_prompt:
                persist_conversation(
                    db,
                    session_id=message.session_id,
                    widget_id=message.widget_id,
                    user_id=user_id,
                    organization_id=user.organization_id,
                    message=message.message,
                    response_text=lead_prompt,
                    token_usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    retrieval_trace={
                        "user_query": message.message,
                        "retrieval_query": None,
                        "query_variants": [],
                        "retrieved_chunks": [],
                        "selected_chunks": [],
                        "source_ids": [],
                        "has_context": False,
                        "escalation_triggered": True,
                        "top_distance": None,
                    },
                )
                increment_usage(
                    db,
                    user.organization_id,
                    conversations_count=1 if is_new_session else 0,
                    messages_count=2,
                    tokens_used=0,
                )
                return ChatResponse(
                    response=lead_prompt,
                    session_id=message.session_id,
                    sources=[],
                    ui_action="open_lead_form",
                )

            confirmed_handoff = _create_handoff_after_user_confirmation(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if confirmed_handoff:
                waiting_response = settings.HUMAN_HANDOFF_WAITING_MESSAGE
                persist_conversation(
                    db,
                    session_id=message.session_id,
                    widget_id=message.widget_id,
                    user_id=user_id,
                    organization_id=user.organization_id,
                    message=message.message,
                    response_text=waiting_response,
                    token_usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                    retrieval_trace={
                        "user_query": message.message,
                        "retrieval_query": None,
                        "query_variants": [],
                        "retrieved_chunks": [],
                        "selected_chunks": [],
                        "source_ids": [],
                        "has_context": False,
                        "escalation_triggered": True,
                        "top_distance": None,
                    },
                )
                increment_usage(
                    db,
                    user.organization_id,
                    conversations_count=1 if is_new_session else 0,
                    messages_count=2,
                    tokens_used=0,
                )
                await handoff_hub.broadcast(user.organization_id, {
                    "type": "handoff_request_created",
                    "chat_id": confirmed_handoff.chat_id,
                    "widget_id": confirmed_handoff.widget_id,
                    "session_id": confirmed_handoff.session_id,
                    "status": confirmed_handoff.status,
                    "handoff_reason": confirmed_handoff.handoff_reason,
                })
                return ChatResponse(
                    response=waiting_response,
                    session_id=message.session_id,
                    sources=[],
                    ui_action="open_human_handoff",
                    handoff_chat_id=confirmed_handoff.chat_id,
                    handoff_status=confirmed_handoff.status,
                )

        # ----------------------
        # Generate Response
        # ----------------------
        if use_shopify:
            # Shopify customer flow
            response_text = await handle_shopify_intent(
                db=db,
                shop_domain=message.shop_domain,
                customer_id=str(message.customer_id),
                user_message=message.message
            )
            return ChatResponse(
                response=response_text,
                session_id=message.session_id
            )
        else:
            intake_response = None
            if widget_config:
                intake_response = _handle_appointment_intake_flow(
                    db,
                    user,
                    widget_config,
                    message.session_id,
                    message.widget_id,
                    message.message,
                )

            if intake_response:
                active_after = _get_active_intake(
                    db,
                    message.session_id,
                    message.widget_id,
                    user.organization_id,
                )
                ui_action = "open_appointment_form" if active_after else None

                token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                persist_conversation(
                    db,
                    session_id=message.session_id,
                    widget_id=message.widget_id,
                    user_id=user_id,
                    organization_id=user.organization_id,
                    message=message.message,
                    response_text=intake_response,
                    token_usage=token_usage,
                    retrieval_trace={
                        "user_query": message.message,
                        "retrieval_query": None,
                        "query_variants": [],
                        "retrieved_chunks": [],
                        "selected_chunks": [],
                        "source_ids": [],
                        "has_context": False,
                        "escalation_triggered": False,
                        "top_distance": None,
                    },
                )

                increment_usage(
                    db,
                    user.organization_id,
                    conversations_count=1 if is_new_session else 0,
                    messages_count=2,
                    tokens_used=0,
                )

                return ChatResponse(
                    response=intake_response,
                    session_id=message.session_id,
                    sources=[],
                    ui_action=ui_action,
                )

            # Generate response with organization-scoped knowledge base
            response_text, sources, token_usage = generate_chat_response(
                message.message,
                message.session_id,
                message.widget_id,
                user_id,
                user.organization_id,
                db,
                language_code=message.language_code,
                language_label=message.language_label,
                retrieval_message=message.retrieval_message
            )

            if limits.get("human_handoff_enabled"):
                response_text = _ensure_handoff_offer_response(response_text, widget_config)

            increment_usage(
                db,
                user.organization_id,
                conversations_count=1 if is_new_session else 0,
                messages_count=2,
                tokens_used=token_usage.get("total_tokens", 0)
            )
            
            return ChatResponse(
                response=response_text,
                session_id=message.session_id,
                sources=sources,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(
    message: ChatMessage,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)    
):
    try:
        user_id = None
        widget_config = None
        if message.widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == message.widget_id
            ).first()
            if widget_config:
                user_id = widget_config.user_id
        elif current_user:
            user_id = current_user.id

        if user_id is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid widget_id or user not found. Please provide a valid widget_id or authenticate."
            )

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found for chat context")
        org_settings = get_org_settings(db, user.organization_id)

        limits = get_effective_limits(db, user.organization_id)
        subscription_usage = get_or_create_subscription_usage(db, user.organization_id)
        if not limits.get("subscription_active"):
            if settings.DEV_BYPASS_SUBSCRIPTION_CHECK:
                logger.warning(
                    "DEV_BYPASS_SUBSCRIPTION_CHECK enabled for org_id=%s; allowing streamed chat without active subscription",
                    user.organization_id,
                )
                limits = {
                    **limits,
                    "subscription_active": True,
                }
            else:
                raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        usage = subscription_usage or get_or_create_usage(db, user.organization_id)

        is_new_session = db.query(Conversation.id).filter(
            Conversation.organization_id == user.organization_id,
            Conversation.session_id == message.session_id,
            Conversation.widget_id == message.widget_id,
        ).first() is None

        # Self-heal historical overcounting from earlier conversation counter logic.
        actual_sessions_used = _get_subscription_session_count(db, user.organization_id, subscription_usage) if subscription_usage else _get_monthly_session_count(db, user.organization_id)
        if subscription_usage and usage.conversations_count and usage.conversations_count > actual_sessions_used:
            usage.conversations_count = actual_sessions_used
            db.commit()
            db.refresh(usage)

        if limits.get("human_handoff_enabled"):
            active_handoff = _route_user_message_to_handoff_if_active(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if active_handoff:
                handoff_session = active_handoff["session"]
                waiting_response = active_handoff["response_text"]
                ui_action = active_handoff.get("ui_action")

                def handoff_event_generator():
                    token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                    try:
                        yield "data: {\"type\": \"ready\"}\n\n"
                        if (waiting_response or "").strip():
                            yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(waiting_response)} }}\n\n"
                    finally:
                        persist_conversation(
                            db,
                            session_id=message.session_id,
                            widget_id=message.widget_id,
                            user_id=user_id,
                            organization_id=user.organization_id,
                            message=message.message,
                            response_text=waiting_response,
                            token_usage=token_usage,
                            retrieval_trace={
                                "user_query": message.message,
                                "retrieval_query": None,
                                "query_variants": [],
                                "retrieved_chunks": [],
                                "selected_chunks": [],
                                "source_ids": [],
                                "has_context": False,
                                "escalation_triggered": True,
                                "top_distance": None,
                            },
                        )
                        increment_usage(
                            db,
                            user.organization_id,
                            conversations_count=1 if is_new_session else 0,
                            messages_count=2,
                            tokens_used=0,
                        )
                        asyncio.create_task(handoff_hub.broadcast(user.organization_id, {
                            "type": "handoff_user_message",
                            "chat_id": handoff_session.chat_id,
                            "widget_id": handoff_session.widget_id,
                            "session_id": handoff_session.session_id,
                            "status": handoff_session.status,
                            "message": (message.message or "")[:500],
                        }))
                        done_payload = {
                            "type": "done",
                            "sources": [],
                            "handoff_chat_id": handoff_session.chat_id,
                            "handoff_status": handoff_session.status,
                        }
                        if ui_action:
                            done_payload["ui_action"] = ui_action
                        yield f"data: {json.dumps(done_payload)}\n\n"

                return StreamingResponse(handoff_event_generator(), media_type="text/event-stream")

            direct_lead_prompt = _handoff_lead_capture_prompt_for_direct_request(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if direct_lead_prompt:
                def direct_lead_prompt_event_generator():
                    token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                    try:
                        yield "data: {\"type\": \"ready\"}\n\n"
                        yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(direct_lead_prompt)} }}\n\n"
                    finally:
                        persist_conversation(
                            db,
                            session_id=message.session_id,
                            widget_id=message.widget_id,
                            user_id=user_id,
                            organization_id=user.organization_id,
                            message=message.message,
                            response_text=direct_lead_prompt,
                            token_usage=token_usage,
                            retrieval_trace={
                                "user_query": message.message,
                                "retrieval_query": None,
                                "query_variants": [],
                                "retrieved_chunks": [],
                                "selected_chunks": [],
                                "source_ids": [],
                                "has_context": False,
                                "escalation_triggered": True,
                                "top_distance": None,
                            },
                        )
                        increment_usage(
                            db,
                            user.organization_id,
                            conversations_count=1 if is_new_session else 0,
                            messages_count=2,
                            tokens_used=0,
                        )
                        yield "data: {\"type\": \"done\", \"sources\": [], \"ui_action\": \"open_lead_form\" }\n\n"

                return StreamingResponse(direct_lead_prompt_event_generator(), media_type="text/event-stream")

            direct_handoff = _create_direct_handoff_request(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if direct_handoff:
                waiting_response = settings.HUMAN_HANDOFF_WAITING_MESSAGE

                def direct_handoff_event_generator():
                    token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                    try:
                        yield "data: {\"type\": \"ready\"}\n\n"
                        if (waiting_response or "").strip():
                            yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(waiting_response)} }}\n\n"
                    finally:
                        persist_conversation(
                            db,
                            session_id=message.session_id,
                            widget_id=message.widget_id,
                            user_id=user_id,
                            organization_id=user.organization_id,
                            message=message.message,
                            response_text=waiting_response,
                            token_usage=token_usage,
                            retrieval_trace={
                                "user_query": message.message,
                                "retrieval_query": None,
                                "query_variants": [],
                                "retrieved_chunks": [],
                                "selected_chunks": [],
                                "source_ids": [],
                                "has_context": False,
                                "escalation_triggered": True,
                                "top_distance": None,
                            },
                        )
                        increment_usage(
                            db,
                            user.organization_id,
                            conversations_count=1 if is_new_session else 0,
                            messages_count=2,
                            tokens_used=0,
                        )
                        asyncio.create_task(handoff_hub.broadcast(user.organization_id, {
                            "type": "handoff_request_created",
                            "chat_id": direct_handoff.chat_id,
                            "widget_id": direct_handoff.widget_id,
                            "session_id": direct_handoff.session_id,
                            "status": direct_handoff.status,
                            "handoff_reason": direct_handoff.handoff_reason,
                        }))
                        done_payload = {
                            "type": "done",
                            "sources": [],
                            "ui_action": "open_human_handoff",
                            "handoff_chat_id": direct_handoff.chat_id,
                            "handoff_status": direct_handoff.status,
                        }
                        yield f"data: {json.dumps(done_payload)}\n\n"

                return StreamingResponse(direct_handoff_event_generator(), media_type="text/event-stream")

            lead_prompt = _handoff_lead_capture_prompt_if_needed(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if lead_prompt:
                def lead_prompt_event_generator():
                    token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                    try:
                        yield "data: {\"type\": \"ready\"}\n\n"
                        yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(lead_prompt)} }}\n\n"
                    finally:
                        persist_conversation(
                            db,
                            session_id=message.session_id,
                            widget_id=message.widget_id,
                            user_id=user_id,
                            organization_id=user.organization_id,
                            message=message.message,
                            response_text=lead_prompt,
                            token_usage=token_usage,
                            retrieval_trace={
                                "user_query": message.message,
                                "retrieval_query": None,
                                "query_variants": [],
                                "retrieved_chunks": [],
                                "selected_chunks": [],
                                "source_ids": [],
                                "has_context": False,
                                "escalation_triggered": True,
                                "top_distance": None,
                            },
                        )
                        increment_usage(
                            db,
                            user.organization_id,
                            conversations_count=1 if is_new_session else 0,
                            messages_count=2,
                            tokens_used=0,
                        )
                        yield "data: {\"type\": \"done\", \"sources\": [], \"ui_action\": \"open_lead_form\" }\n\n"

                return StreamingResponse(lead_prompt_event_generator(), media_type="text/event-stream")

            confirmed_handoff = _create_handoff_after_user_confirmation(
                db,
                user.organization_id,
                message.session_id,
                message.widget_id,
                message.message,
            )
            if confirmed_handoff:
                waiting_response = settings.HUMAN_HANDOFF_WAITING_MESSAGE

                def confirmed_handoff_event_generator():
                    token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                    try:
                        yield "data: {\"type\": \"ready\"}\n\n"
                        if (waiting_response or "").strip():
                            yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(waiting_response)} }}\n\n"
                    finally:
                        persist_conversation(
                            db,
                            session_id=message.session_id,
                            widget_id=message.widget_id,
                            user_id=user_id,
                            organization_id=user.organization_id,
                            message=message.message,
                            response_text=waiting_response,
                            token_usage=token_usage,
                            retrieval_trace={
                                "user_query": message.message,
                                "retrieval_query": None,
                                "query_variants": [],
                                "retrieved_chunks": [],
                                "selected_chunks": [],
                                "source_ids": [],
                                "has_context": False,
                                "escalation_triggered": True,
                                "top_distance": None,
                            },
                        )
                        increment_usage(
                            db,
                            user.organization_id,
                            conversations_count=1 if is_new_session else 0,
                            messages_count=2,
                            tokens_used=0,
                        )
                        asyncio.create_task(handoff_hub.broadcast(user.organization_id, {
                            "type": "handoff_request_created",
                            "chat_id": confirmed_handoff.chat_id,
                            "widget_id": confirmed_handoff.widget_id,
                            "session_id": confirmed_handoff.session_id,
                            "status": confirmed_handoff.status,
                            "handoff_reason": confirmed_handoff.handoff_reason,
                        }))
                        done_payload = {
                            "type": "done",
                            "sources": [],
                            "ui_action": "open_human_handoff",
                            "handoff_chat_id": confirmed_handoff.chat_id,
                            "handoff_status": confirmed_handoff.status,
                        }
                        yield f"data: {json.dumps(done_payload)}\n\n"

                return StreamingResponse(confirmed_handoff_event_generator(), media_type="text/event-stream")

        intake_response = None
        if widget_config:
            intake_response = _handle_appointment_intake_flow(
                db,
                user,
                widget_config,
                message.session_id,
                message.widget_id,
                message.message,
            )

        if intake_response:
            def appointment_event_generator():
                token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                try:
                    yield "data: {\"type\": \"ready\"}\n\n"
                    yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(intake_response)} }}\n\n"
                finally:
                    persist_conversation(
                        db,
                        session_id=message.session_id,
                        widget_id=message.widget_id,
                        user_id=user_id,
                        organization_id=user.organization_id,
                        message=message.message,
                        response_text=intake_response,
                        token_usage=token_usage,
                        retrieval_trace={
                            "user_query": message.message,
                            "retrieval_query": None,
                            "query_variants": [],
                            "retrieved_chunks": [],
                            "selected_chunks": [],
                            "source_ids": [],
                            "has_context": False,
                            "escalation_triggered": False,
                            "top_distance": None,
                        },
                    )
                    increment_usage(
                        db,
                        user.organization_id,
                        conversations_count=1 if is_new_session else 0,
                        messages_count=2,
                        tokens_used=0
                    )
                    yield "data: {\"type\": \"done\", \"sources\": [] }\n\n"

            return StreamingResponse(appointment_event_generator(), media_type="text/event-stream")

        is_first_turn = db.query(Conversation.id).filter(
            Conversation.session_id == message.session_id,
            Conversation.widget_id == message.widget_id,
        ).first() is None

        def event_generator():
            # Emit an immediate event so clients can mark the stream as alive
            # before retrieval/model latency is paid.
            yield "data: {\"type\": \"ready\"}\n\n"

            collected_parts = []
            usage_tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            sources = []
            retrieval_trace = {
                "user_query": message.message,
                "retrieval_query": None,
                "query_variants": [],
                "retrieved_chunks": [],
                "selected_chunks": [],
                "source_ids": [],
                "has_context": False,
                "escalation_triggered": False,
                "top_distance": None,
            }
            try:
                stream, sources, escalation_fallback_text, retrieval_trace = stream_chat_response(
                    message.message,
                    message.session_id,
                    message.widget_id,
                    user_id,
                    user.organization_id,
                    db,
                    language_code=message.language_code,
                    language_label=message.language_label,
                    retrieval_message=message.retrieval_message
                )

                if stream is None:
                    fallback_text = escalation_fallback_text or "Sorry—I don’t have a reliable answer for this right now."
                    if limits.get("human_handoff_enabled"):
                        fallback_text = _ensure_handoff_offer_response(fallback_text, widget_config)
                    collected_parts.append(fallback_text)
                    yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(fallback_text)} }}\n\n"
                else:
                    for chunk in stream:
                        if getattr(chunk, "usage", None):
                            usage = chunk.usage
                            usage_tokens = {
                                "prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
                                "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
                                "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
                            }
                        if not getattr(chunk, "choices", None):
                            continue
                        if not chunk.choices or not getattr(chunk.choices[0], "delta", None):
                            continue
                        delta = getattr(chunk.choices[0].delta, "content", None)
                        if delta:
                            collected_parts.append(delta)
                            yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(delta)} }}\n\n"
            except Exception as stream_error:
                logger.error("Error preparing chat stream: %s", str(stream_error))
                if not collected_parts:
                    fallback_text = "Sorry—I don’t have a reliable answer for this right now."
                    if limits.get("human_handoff_enabled"):
                        fallback_text = _ensure_handoff_offer_response(fallback_text, widget_config)
                    collected_parts.append(fallback_text)
                    yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(fallback_text)} }}\n\n"
            finally:
                full_text = "".join(collected_parts)
                final_text = append_appointment_cta_if_needed(full_text, is_first_turn)
                if final_text != full_text and final_text.startswith(full_text):
                    suffix = final_text[len(full_text):]
                    if suffix:
                        yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(suffix)} }}\n\n"
                full_text = final_text
                trace_payload = dict(retrieval_trace or {})
                trace_payload["escalation_triggered"] = bool(trace_payload.get("escalation_triggered"))
                persist_conversation(
                    db,
                    session_id=message.session_id,
                    widget_id=message.widget_id,
                    user_id=user_id,
                    organization_id=user.organization_id,
                    message=message.message,
                    response_text=full_text,
                    token_usage=usage_tokens,
                    retrieval_trace=trace_payload,
                )
                increment_usage(
                    db,
                    user.organization_id,
                    conversations_count=1 if is_new_session else 0,
                    messages_count=2,
                    tokens_used=usage_tokens.get("total_tokens", 0)
                )

                done_payload = {
                    "type": "done",
                    "sources": sources,
                }

                yield f"data: {json.dumps(done_payload)}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat stream endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/appointments", response_model=AppointmentBookingResponse)
async def book_appointment(
    request: AppointmentBookingRequest,
    db: Session = Depends(get_db),
):
    """Book an appointment for a chat session and widget."""
    widget_config = db.query(WidgetConfig).filter(
        WidgetConfig.widget_id == request.widget_id
    ).first()
    if not widget_config:
        raise HTTPException(status_code=400, detail="Invalid widget_id")

    appointment_time = request.appointment_at
    now = datetime.now(timezone.utc) if appointment_time.tzinfo else datetime.utcnow()
    if appointment_time <= now:
        raise HTTPException(status_code=400, detail="Appointment time must be in the future")

    canonical_tz = _canonical_timezone(request.timezone.strip()) if request.timezone else DEFAULT_APPOINTMENT_TIMEZONE

    appointment = Appointment(
        session_id=request.session_id,
        widget_id=request.widget_id,
        user_id=widget_config.user_id,
        organization_id=widget_config.organization_id,
        name=request.name.strip(),
        email=str(request.email) if request.email else None,
        phone=request.phone.strip() if request.phone else None,
        notes=request.notes.strip() if request.notes else None,
        timezone=canonical_tz,
        appointment_at=appointment_time,
        status="booked",
    )
    db.add(appointment)
    _sync_appointment_contact_to_agent_list(db, widget_config, appointment)
    db.commit()
    db.refresh(appointment)

    appointment_dt = appointment.appointment_at
    if appointment_dt.tzinfo is None:
        appointment_dt = appointment_dt.replace(tzinfo=timezone.utc)

    tz_label = canonical_tz or DEFAULT_APPOINTMENT_TIMEZONE
    try:
        target_tz = ZoneInfo(tz_label)
    except Exception:
        target_tz = timezone.utc
        tz_label = "UTC"

    local_dt = appointment_dt.astimezone(target_tz)
    time_label = local_dt.strftime("%d %b %Y, %I:%M %p")
    contact_line = appointment.email or appointment.phone or ""
    return AppointmentBookingResponse(
        id=appointment.id,
        session_id=appointment.session_id,
        widget_id=appointment.widget_id,
        appointment_at=appointment.appointment_at,
        message=_build_appointment_confirmation_message(
            time_label=time_label,
            tz_name=tz_label,
            name=appointment.name,
            contact=contact_line,
        ),
    )


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    request: TranslateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    try:
        organization_id = None
        if current_user:
            organization_id = current_user.organization_id
        elif request.widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == request.widget_id
            ).first()
            if widget_config:
                organization_id = widget_config.organization_id

        if organization_id is None:
            raise HTTPException(status_code=400, detail="Invalid widget_id or user not found")

        limits = get_effective_limits(db, organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")
        if not limits.get("multilingual_text_enabled", False):
            raise HTTPException(status_code=403, detail="Multilingual text support is disabled")

        translated = translate_text(
            request.text,
            target_language_code=request.target_language_code,
            target_language_label=request.target_language_label
        )
        return TranslateResponse(translated_text=translated)
    except Exception as e:
        logger.error(f"Error in translate endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/handoff/session")
async def get_handoff_session_status(
    session_id: str,
    widget_id: str,
    chat_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    widget_config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == widget_id).first()
    if not widget_config:
        raise HTTPException(status_code=404, detail="Invalid widget_id")

    if current_user and current_user.organization_id != widget_config.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized for this organization")

    limits = get_effective_limits(db, widget_config.organization_id)
    handoff_enabled = bool(limits.get("human_handoff_enabled"))

    query = db.query(HandoffSession).filter(
        HandoffSession.organization_id == widget_config.organization_id,
        HandoffSession.session_id == session_id,
        HandoffSession.widget_id == widget_id,
    )
    if chat_id:
        query = query.filter(HandoffSession.chat_id == chat_id)

    session = query.order_by(HandoffSession.id.desc()).first()
    if not session:
        return {
            "active": False,
            "chat_id": None,
            "status": None,
            "assigned_agent_id": None,
            "call_room_id": None,
            "call_status": "none",
            "call_mode": "video",
            "call_requested_at": None,
            "call_started_at": None,
            "call_ended_at": None,
            "updated_at": None,
            "wait_cycle": None,
            "waiting_expires_at": None,
            "waiting_timeout_notified": None,
            "wait_timeout_seconds": _handoff_wait_timeout_seconds(),
        }

    if handoff_enabled:
        _emit_handoff_timeout_prompt_if_needed(db, session)

    return {
        "active": session.status in {"waiting_for_agent", "assigned"},
        "chat_id": session.chat_id,
        "status": session.status,
        "assigned_agent_id": session.assigned_agent_id,
        "call_room_id": session.call_room_id,
        "call_status": session.call_status,
        "call_mode": session.call_mode,
        "call_requested_at": session.call_requested_at,
        "call_started_at": session.call_started_at,
        "call_ended_at": session.call_ended_at,
        "updated_at": session.updated_at,
        "wait_cycle": session.wait_cycle,
        "waiting_expires_at": session.waiting_expires_at,
        "waiting_timeout_notified": session.waiting_timeout_notified,
        "wait_timeout_seconds": _handoff_wait_timeout_seconds(),
    }


@router.get("/handoff/messages")
async def get_handoff_messages(
    chat_id: str,
    session_id: str,
    widget_id: str,
    after_id: int = 0,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    widget_config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == widget_id).first()
    if not widget_config:
        raise HTTPException(status_code=404, detail="Invalid widget_id")

    if current_user and current_user.organization_id != widget_config.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized for this organization")

    limits = get_effective_limits(db, widget_config.organization_id)
    handoff_enabled = bool(limits.get("human_handoff_enabled"))

    handoff_session = db.query(HandoffSession).filter(
        HandoffSession.chat_id == chat_id,
        HandoffSession.organization_id == widget_config.organization_id,
        HandoffSession.session_id == session_id,
        HandoffSession.widget_id == widget_id,
    ).first()
    if not handoff_session:
        return {
            "chat_id": chat_id,
            "status": None,
            "assigned_agent_id": None,
            "call_room_id": None,
            "call_status": "none",
            "call_mode": "video",
            "call_requested_at": None,
            "call_started_at": None,
            "call_ended_at": None,
            "wait_cycle": None,
            "waiting_expires_at": None,
            "waiting_timeout_notified": None,
            "wait_timeout_seconds": _handoff_wait_timeout_seconds(),
            "items": [],
        }

    if handoff_enabled:
        _emit_handoff_timeout_prompt_if_needed(db, handoff_session)

    rows = db.query(HandoffMessage).filter(
        HandoffMessage.handoff_session_id == handoff_session.id,
        HandoffMessage.id > max(0, int(after_id or 0)),
    ).order_by(HandoffMessage.id.asc()).all()

    return {
        "chat_id": handoff_session.chat_id,
        "status": handoff_session.status,
        "assigned_agent_id": handoff_session.assigned_agent_id,
        "call_room_id": handoff_session.call_room_id,
        "call_status": handoff_session.call_status,
        "call_mode": handoff_session.call_mode,
        "call_requested_at": handoff_session.call_requested_at,
        "call_started_at": handoff_session.call_started_at,
        "call_ended_at": handoff_session.call_ended_at,
        "wait_cycle": handoff_session.wait_cycle,
        "waiting_expires_at": handoff_session.waiting_expires_at,
        "waiting_timeout_notified": handoff_session.waiting_timeout_notified,
        "wait_timeout_seconds": _handoff_wait_timeout_seconds(),
        "items": [
            {
                "id": row.id,
                "sender_type": row.sender_type,
                "sender_user_id": row.sender_user_id,
                "message": row.message,
                "created_at": row.created_at,
            }
            for row in rows
            if row.sender_type != "system"
        ],
    }


@router.post("/handoff/request-video-call")
async def request_handoff_video_call(
    payload: HandoffVideoCallRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    widget_config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == payload.widget_id).first()
    if not widget_config:
        raise HTTPException(status_code=404, detail="Invalid widget_id")

    if current_user and current_user.organization_id != widget_config.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized for this organization")

    limits = get_effective_limits(db, widget_config.organization_id)
    if not bool(limits.get("human_handoff_enabled")):
        raise HTTPException(status_code=403, detail="Human handoff is disabled for this organization")

    handoff_session = _create_or_get_handoff_session(
        db,
        widget_config.organization_id,
        payload.session_id,
        payload.widget_id,
        "User requested video call",
        "User requested a live video call.",
        "video_call_request",
    )

    now = datetime.utcnow()
    if not (handoff_session.call_room_id or "").strip():
        handoff_session.call_room_id = f"ai-bot-{widget_config.organization_id}-{handoff_session.id}-{int(now.timestamp())}"
    handoff_session.call_mode = "video"
    handoff_session.call_status = "requested"
    handoff_session.call_requested_at = now
    handoff_session.call_started_at = None
    handoff_session.call_ended_at = None
    handoff_session.updated_at = now

    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="system",
        sender_user_id=None,
        message="Video call requested by user.",
    ))
    db.commit()
    db.refresh(handoff_session)

    await handoff_hub.broadcast(widget_config.organization_id, {
        "type": "handoff_video_call_requested",
        "chat_id": handoff_session.chat_id,
        "status": handoff_session.status,
        "call_status": handoff_session.call_status,
        "call_mode": handoff_session.call_mode,
        "call_room_id": handoff_session.call_room_id,
    })

    return {
        "chat_id": handoff_session.chat_id,
        "status": handoff_session.status,
        "assigned_agent_id": handoff_session.assigned_agent_id,
        "call_room_id": handoff_session.call_room_id,
        "call_status": handoff_session.call_status,
        "call_mode": handoff_session.call_mode,
        "call_requested_at": handoff_session.call_requested_at,
        "call_started_at": handoff_session.call_started_at,
        "call_ended_at": handoff_session.call_ended_at,
    }


@router.post("/handoff/call-mode")
async def set_handoff_call_mode(
    payload: HandoffCallModeRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    widget_config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == payload.widget_id).first()
    if not widget_config:
        raise HTTPException(status_code=404, detail="Invalid widget_id")

    if current_user and current_user.organization_id != widget_config.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized for this organization")

    handoff_session = _get_open_handoff_session(
        db,
        payload.session_id,
        payload.widget_id,
        widget_config.organization_id,
    )
    if not handoff_session:
        raise HTTPException(status_code=404, detail="No active handoff session found")

    requested_mode = (payload.mode or "").strip().lower()
    if requested_mode not in {"video", "audio"}:
        raise HTTPException(status_code=400, detail="mode must be video or audio")

    if handoff_session.call_status not in {"requested", "active"}:
        raise HTTPException(status_code=409, detail="No requested/active call found")

    handoff_session.call_mode = requested_mode
    handoff_session.updated_at = datetime.utcnow()

    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="system",
        sender_user_id=(current_user.id if current_user else None),
        message=f"Call switched to {requested_mode} mode.",
    ))
    db.commit()
    db.refresh(handoff_session)

    await handoff_hub.broadcast(widget_config.organization_id, {
        "type": "handoff_call_mode_changed",
        "chat_id": handoff_session.chat_id,
        "status": handoff_session.status,
        "call_status": handoff_session.call_status,
        "call_mode": handoff_session.call_mode,
        "call_room_id": handoff_session.call_room_id,
    })

    return {
        "chat_id": handoff_session.chat_id,
        "status": handoff_session.status,
        "assigned_agent_id": handoff_session.assigned_agent_id,
        "call_room_id": handoff_session.call_room_id,
        "call_status": handoff_session.call_status,
        "call_mode": handoff_session.call_mode,
        "call_requested_at": handoff_session.call_requested_at,
        "call_started_at": handoff_session.call_started_at,
        "call_ended_at": handoff_session.call_ended_at,
    }


@router.post("/handoff/end-call")
async def end_handoff_call_from_chat(
    payload: HandoffVideoCallRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    widget_config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == payload.widget_id).first()
    if not widget_config:
        raise HTTPException(status_code=404, detail="Invalid widget_id")

    if current_user and current_user.organization_id != widget_config.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized for this organization")

    handoff_session = _get_open_handoff_session(
        db,
        payload.session_id,
        payload.widget_id,
        widget_config.organization_id,
    )
    if not handoff_session:
        raise HTTPException(status_code=404, detail="No active handoff session found")

    handoff_session.call_status = "ended"
    handoff_session.call_ended_at = datetime.utcnow()
    handoff_session.updated_at = datetime.utcnow()

    db.add(HandoffMessage(
        handoff_session_id=handoff_session.id,
        sender_type="system",
        sender_user_id=(current_user.id if current_user else None),
        message="Live call ended.",
    ))
    db.commit()
    db.refresh(handoff_session)

    await handoff_hub.broadcast(widget_config.organization_id, {
        "type": "handoff_call_ended",
        "chat_id": handoff_session.chat_id,
        "status": handoff_session.status,
        "call_status": handoff_session.call_status,
        "call_mode": handoff_session.call_mode,
        "call_room_id": handoff_session.call_room_id,
    })

    return {
        "chat_id": handoff_session.chat_id,
        "status": handoff_session.status,
        "assigned_agent_id": handoff_session.assigned_agent_id,
        "call_room_id": handoff_session.call_room_id,
        "call_status": handoff_session.call_status,
        "call_mode": handoff_session.call_mode,
        "call_requested_at": handoff_session.call_requested_at,
        "call_started_at": handoff_session.call_started_at,
        "call_ended_at": handoff_session.call_ended_at,
    }


@router.get("/history/{session_id}", response_model=List[ConversationHistoryItem])
async def get_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    widget_id: str = None,
):
    """Get conversation history (scoped to user's organization)"""
    query = db.query(Conversation).filter(
        Conversation.session_id == session_id,
        Conversation.organization_id == current_user.organization_id
    )
    if widget_id:
        query = query.filter(Conversation.widget_id == widget_id)
    conversations = query.order_by(Conversation.created_at).all()
    
    return conversations


@router.get("/should-capture-lead/{session_id}")
async def check_lead_capture(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
    widget_id: str = None,
):
    """Check if lead should be captured (scoped to org + widget)"""
    org_id = None
    if widget_id:
        widget_owner = db.query(WidgetConfig).filter(WidgetConfig.widget_id == widget_id).first()
        if widget_owner:
            org_id = widget_owner.organization_id

    if org_id is None and current_user:
        org_id = current_user.organization_id

    if org_id is None:
        return {"should_capture": False}

    should_capture = should_capture_lead(session_id, org_id, widget_id, db)
    return {"should_capture": should_capture}


@router.post("/email-conversation")
async def email_conversation(
    request: EmailConversationRequest,
    db: Session = Depends(get_db),
    settings: OrganizationSettings = Depends(get_settings)
):
    """Send conversation transcript via email"""
    try:
        # Get conversation history
        query = db.query(Conversation).filter(
            Conversation.session_id == request.session_id
        )
        if request.widget_id:
            query = query.filter(Conversation.widget_id == request.widget_id)
        conversations = query.order_by(Conversation.created_at).all()
        
        if not conversations:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Format conversation data
        conversation_data = []
        for conv in conversations:
            if conv.role == "user":
                if conv.message:
                    conversation_data.append({
                        "role": "user",
                        "content": conv.message
                    })
                if conv.response:
                    conversation_data.append({
                        "role": "assistant",
                        "content": conv.response
                    })
            else:
                content = conv.response or conv.message
                if content:
                    conversation_data.append({
                        "role": conv.role,
                        "content": content
                    })
        
        # Send email
        success = send_conversation_email(request.email, conversation_data, settings)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send email")
        
        return {"message": "Email sent successfully", "email": request.email}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending conversation email: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

