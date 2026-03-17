from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from app.database import get_db
from app.models import Conversation, WidgetConfig, User, Appointment, AppointmentIntake, ContactList, Contact
from app.schemas import ChatMessage, ChatResponse, ConversationHistoryItem, TranslateRequest, TranslateResponse, SuggestedQuestionsResponse
from app.services import generate_chat_response, should_capture_lead, translate_text, stream_chat_response, persist_conversation, get_suggested_questions, append_appointment_cta_if_needed
from app.services.limits_service import get_effective_limits, get_or_create_subscription_usage, get_or_create_usage, increment_usage
from app.services.email_service import send_conversation_email
from app.auth import get_current_user, get_current_user_optional
from app.config import settings
import logging
import json
import re

from app.services.shopify_service import handle_shopify_intent, verify_shopify_customer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


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
        "Sorry—I don’t have a reliable answer for this right now. "
        "If you’d like, I can connect you with our escalation contacts:\n"
        f"• Level 1: {level_1}\n"
        f"• Level 2: {level_2}\n"
        "Would you like me to help you reach them?"
    )


def _is_booking_intent(text: str) -> bool:
    lower = (text or "").lower()
    patterns = [
        "book appointment",
        "book an appointment",
        "schedule appointment",
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
    return has_appointment_word and has_action_word


def _is_affirmative(text: str) -> bool:
    tokens = set(re.findall(r"[a-zA-Z0-9]+", (text or "").lower()))
    return bool(tokens & {"yes", "yeah", "yep", "sure", "ok", "okay", "please", "book", "schedule", "connect"})


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


def _prompt_for_next_intake_field(next_field: str) -> str:
    if next_field == "name":
        return "Please share your full name to continue booking."
    if next_field == "appointment_at":
        return (
            "Please share your preferred appointment date and time. You can use:\n"
            "• 2026-03-20 15:30\n"
            "• 17 March 2026 4:00 PM\n"
            "• 17th March, at 4:00 PM"
        )
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
    now_local = datetime.now()

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
            return datetime.fromisoformat(candidate.replace("Z", "+00:00"))
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
    ))


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
        active.next_field = "appointment_at"
        db.commit()
        return (
            f"Thanks, {name}. Please share your preferred appointment date and time in this format: "
            "YYYY-MM-DD HH:MM (24-hour). Example: 2026-03-20 15:30"
        )

    if active.next_field == "appointment_at":
        dt_value = _parse_datetime_input(text)
        if not dt_value:
            return (
                "I could not parse the date/time. Please try one of these formats:\n"
                "• 2026-03-20 15:30\n"
                "• 17 March 2026 4:00 PM\n"
                "• 17th March, at 4:00 PM"
            )

        active.appointment_at = dt_value
        detected_timezone = _extract_timezone(text)
        if detected_timezone:
            active.timezone = detected_timezone
            active.next_field = "contact"
            db.commit()
            return (
                f"Got it. I will use timezone {detected_timezone}. "
                "Please share your email address or phone number so we can contact you (or type skip)."
            )

        active.next_field = "timezone"
        db.commit()
        return "Great. Please share your timezone (for example: Asia/Kolkata, IST, or UTC)."

    if active.next_field == "timezone":
        if _is_skip(text):
            active.timezone = "UTC"
            active.next_field = "contact"
            db.commit()
            return "No problem, I will use UTC. Please share your email address or phone number (or type skip)."

        timezone_name = _extract_timezone(text)
        if not timezone_name:
            return "Please provide a valid timezone, for example: Asia/Kolkata, IST, Europe/London, or UTC."
        active.timezone = timezone_name
        active.next_field = "contact"
        db.commit()
        return "Please share your email address or phone number so we can contact you (or type skip)."

    if active.next_field == "contact":
        if not _is_skip(text):
            email = _extract_email(text)
            phone = _extract_phone(text)
            if not email and not phone:
                return "Please share at least one contact detail (email or phone), or type skip."
            if email:
                active.email = email
            if phone:
                active.phone = phone
        active.next_field = "notes"
        db.commit()
        return "Any additional notes for the appointment? (Type skip if none)"

    if active.next_field == "notes":
        notes = None if _is_skip(text) else text[:1000]
        active.notes = notes

        dt_value = active.appointment_at
        if not dt_value:
            active.next_field = "appointment_at"
            db.commit()
            return "I am missing appointment time. Please provide: YYYY-MM-DD HH:MM"

        tz_name = _canonical_timezone(active.timezone or "UTC")
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
            return "That time is in the past. Please provide a future appointment datetime: YYYY-MM-DD HH:MM"

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

    return None


def _get_subscription_session_count(db: Session, organization_id: int, usage) -> int:
    """Count distinct sessions in the active subscription window for accurate conversation limits."""
    if not usage:
        return 0

    query = db.query(func.count(func.distinct(Conversation.session_id))).filter(
        Conversation.organization_id == organization_id,
        Conversation.created_at >= usage.period_start,
        Conversation.created_at <= usage.period_end,
    )
    return int(query.scalar() or 0)


def _get_monthly_session_count(db: Session, organization_id: int) -> int:
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
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
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    timezone: Optional[str] = None


class AppointmentBookingResponse(BaseModel):
    id: int
    session_id: str
    widget_id: str
    appointment_at: datetime
    message: str


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
    current_user = Depends(get_current_user_optional)
):
    """Chat endpoint with RAG - uses user's knowledge base"""
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
            
        print(f"Shopify customer verified: {use_shopify}")
        
        # Resolve organization for scoping
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found for chat context")

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
                    "monthly_conversation_limit": None,
                    "monthly_token_limit": None,
                    "max_query_words": None,
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

        word_count = len(message.message.split())
        if limits.get("max_query_words") and word_count > limits["max_query_words"]:
            raise HTTPException(
                status_code=400,
                detail=f"Query exceeds max word limit of {limits['max_query_words']}",
            )

        if (
            limits.get("monthly_conversation_limit")
            and is_new_session
            and actual_sessions_used >= limits["monthly_conversation_limit"]
        ):
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Monthly conversation limit exceeded",
                    "conversations_used": actual_sessions_used,
                    "conversation_limit": limits["monthly_conversation_limit"],
                },
            )

        if limits.get("monthly_token_limit") and usage.tokens_used >= limits["monthly_token_limit"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Monthly token limit exceeded",
                    "tokens_used": usage.tokens_used,
                    "token_limit": limits["monthly_token_limit"],
                },
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
                sources=sources
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
                    "monthly_conversation_limit": None,
                    "monthly_token_limit": None,
                    "max_query_words": None,
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

        word_count = len(message.message.split())
        if limits.get("max_query_words") and word_count > limits["max_query_words"]:
            raise HTTPException(
                status_code=400,
                detail=f"Query exceeds max word limit of {limits['max_query_words']}",
            )

        if (
            limits.get("monthly_conversation_limit")
            and is_new_session
            and actual_sessions_used >= limits["monthly_conversation_limit"]
        ):
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Monthly conversation limit exceeded",
                    "conversations_used": actual_sessions_used,
                    "conversation_limit": limits["monthly_conversation_limit"],
                },
            )

        if limits.get("monthly_token_limit") and usage.tokens_used >= limits["monthly_token_limit"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Monthly token limit exceeded",
                    "tokens_used": usage.tokens_used,
                    "token_limit": limits["monthly_token_limit"],
                },
            )

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

        is_first_turn = db.query(Conversation.id).filter(
            Conversation.session_id == message.session_id,
            Conversation.widget_id == message.widget_id,
        ).first() is None

        def event_generator():
            collected_parts = []
            usage_tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            try:
                if stream is None:
                    fallback_text = escalation_fallback_text or "Sorry—I don’t have a reliable answer for this right now."
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
                yield f"data: {{\"type\": \"done\", \"sources\": {json.dumps(sources)} }}\n\n"

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

    canonical_tz = _canonical_timezone(request.timezone.strip()) if request.timezone else None

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

    tz_label = canonical_tz or "UTC"
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
    db: Session = Depends(get_db)
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
        success = send_conversation_email(request.email, conversation_data)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send email")
        
        return {"message": "Email sent successfully", "email": request.email}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending conversation email: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
