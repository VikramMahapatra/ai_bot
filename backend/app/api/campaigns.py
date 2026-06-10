import asyncio
from datetime import datetime, timezone
from io import StringIO
import csv
import json
import logging
import random
from threading import Thread
import time
import uuid
from io import BytesIO
from typing import Any, List, Optional, Tuple
from urllib.parse import urlparse
import re

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    UploadFile,
    File,
    Header,
    Query,
    Response,
)
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
import pandas as pd

from app.auth import require_admin
from app.config import settings
from app.database import SessionLocal, get_db
from app.models import (
    User,
    Campaign,
    ContactList,
    Contact,
    CampaignLog,
    CampaignLeadRule,
    CampaignLeadConversion,
    TwilioSmsChannel,
)
from app.models.products import Product
from app.services.email_service import send_campaign_email
from app.services.campaign_email_ai_service import (
    generate_email_variants_from_prompt,
    evaluate_email_spam_score,
)
from app.services.campaign_to_lead_rule_engine import (
    get_or_create_active_rule,
    run_rule_engine,
    serialize_rule,
    update_rule,
)
from app.services.twilio_sms_service import render_sms_template, send_twilio_sms
from app.services.limits_service import get_effective_limits
from app.services.organization_setting_service import get_org_settings
from app.enums.credit_feature_codes import FeatureCodes
from app.services import organization_credit_service
from app.models.lead_contact_mapping import LeadContactMapping
from app.models.message_templates import MessageTemplate
from app.models.whatsapp_channel import WhatsAppChannel
from app.services.whatsapp_service import send_whatsapp_template_message
from app.services.conversation_outcome_service import (
    _seconds_until_next_interval,
)
from app.models.organization_settings import OrganizationSettings
from typing import Optional

from app.models.organization_email_settings import OrganizationEmailSetting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/campaigns", tags=["campaigns"])

ALLOWED_CAMPAIGN_TYPES = {"email", "whatsapp", "sms"}
ALLOWED_CAMPAIGN_STATUSES = {
    "draft",
    "scheduled",
    "running",
    "completed",
    "paused",
    "failed",
}
ALLOWED_LOG_STATUSES = {
    "pending",
    "sent",
    "delivered",
    "opened",
    "read",
    "clicked",
    "bounced",
    "complained",
    "unsubscribed",
    "failed",
}
AUTO_AGENT_CONTACT_LIST_MARKER_PREFIX = "AUTO_AGENT_APPOINTMENT_LIST::"

TRACKING_PIXEL_GIF = bytes.fromhex(
    "47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b"
)

TRACKING_STATUS_RANK = {
    "pending": 0,
    "sent": 1,
    "delivered": 2,
    "opened": 3,
    "read": 4,
    "clicked": 5,
    "failed": 90,
    "bounced": 91,
    "complained": 92,
    "unsubscribed": 93,
}

TERMINAL_TRACKING_STATUSES = {"failed", "bounced", "complained", "unsubscribed"}

TRACKING_EVENT_TO_STATUS = {
    "pending": "pending",
    "sent": "sent",
    "delivered": "delivered",
    "open": "opened",
    "opened": "opened",
    "read": "read",
    "click": "clicked",
    "clicked": "clicked",
    "bounce": "bounced",
    "bounced": "bounced",
    "complaint": "complained",
    "complained": "complained",
    "unsubscribe": "unsubscribed",
    "unsubscribed": "unsubscribed",
    "failed": "failed",
}


def _ensure_campaign_access(
    db: Session, organization_id: int, campaign_type: Optional[str] = None
) -> None:
    limits = get_effective_limits(db, organization_id)
    if not limits.get("subscription_active"):
        raise HTTPException(status_code=403, detail="Subscription inactive or expired")
    if not limits.get("module_campaigns_enabled", False):
        raise HTTPException(
            status_code=403, detail="Campaigns module is disabled for this organization"
        )

    channel = (campaign_type or "").strip().lower()
    if channel == "email":
        if not limits.get("email_campaign_enabled", False):
            raise HTTPException(
                status_code=403,
                detail="Email campaigns are disabled for this organization",
            )

        email_setting = (
            db.query(OrganizationEmailSetting)
            .filter(
                OrganizationEmailSetting.organization_id == organization_id,
                OrganizationEmailSetting.is_active == True,
            )
            .first()
        )

        if not email_setting:
            raise HTTPException(
                status_code=400,
                detail="No active email configuration found for this organization",
            )

    if channel == "sms":
        if not limits.get("sms_campaign_enabled", False):
            raise HTTPException(
                status_code=403,
                detail="SMS campaigns are disabled for this organization",
            )

        sms_channel = (
            db.query(TwilioSmsChannel)
            .filter(
                TwilioSmsChannel.organization_id == organization_id,
                TwilioSmsChannel.is_active == True,
            )
            .first()
        )

        if not sms_channel:
            raise HTTPException(
                status_code=400,
                detail="SMS channel is not configured for this organization",
            )

    if channel == "whatsapp":
        if not limits.get("whatsapp_enabled", False):
            raise HTTPException(
                status_code=403,
                detail="WhatsApp campaigns are disabled for this organization",
            )

        whatsapp_channel = (
            db.query(WhatsAppChannel)
            .filter(
                WhatsAppChannel.organization_id == organization_id,
                WhatsAppChannel.widget_id.is_(None),
            )
            .first()
        )

        if not whatsapp_channel:
            raise HTTPException(
                status_code=400,
                detail="WhatsApp channel is not configured for this organization",
            )


class ContactListCreateRequest(BaseModel):
    list_name: str
    description: Optional[str] = None


class ContactManualEntry(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None


class ContactManualUploadRequest(BaseModel):
    contacts: List[ContactManualEntry]


class CampaignCreateRequest(BaseModel):
    campaign_name: str
    campaign_type: str
    message_template_id: Optional[int] = None
    message_template: str
    contact_list_id: int
    product_id: Optional[int] = None
    category: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    status: Optional[str] = "draft"
    email_content_mode: Optional[str] = "manual"
    email_subject: Optional[str] = None
    email_prompt_context: Optional[str] = None
    email_subject_variants: Optional[List[str]] = None
    email_body_variants: Optional[List[str]] = None
    open_tracking_enabled: Optional[bool] = None
    click_tracking_enabled: Optional[bool] = None
    footer_display_enabled: Optional[bool] = None


class EmailVariantGenerateRequest(BaseModel):
    campaign_name: Optional[str] = None
    prompt_context: str


class EmailSpamScoreRequest(BaseModel):
    campaign_name: Optional[str] = None
    prompt_context: str
    subjects: List[str]
    bodies: List[str]


class CampaignStatusRequest(BaseModel):
    status: str


class CampaignEmailTrackingWebhookRequest(BaseModel):
    event: str
    tracking_token: Optional[str] = None
    provider_message_id: Optional[str] = None
    event_at: Optional[datetime] = None
    details: Optional[dict[str, Any]] = None


class CampaignToLeadRuleUpdateRequest(BaseModel):
    rule_name: Optional[str] = None
    auto_convert_enabled: Optional[bool] = None
    min_score_threshold: Optional[int] = None
    dedupe_window_days: Optional[int] = None
    target_funnel_stage: Optional[str] = None
    include_statuses: Optional[List[str]] = None
    exclude_statuses: Optional[List[str]] = None
    score_config: Optional[dict[str, int]] = None
    source_multipliers: Optional[dict[str, float]] = None


class CampaignToLeadRunRequest(BaseModel):
    campaign_id: Optional[int] = None
    dry_run: Optional[bool] = True
    limit: Optional[int] = 500


def _validate_contact_payload(
    name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    company: Optional[str] = None,
) -> tuple[str, str, str, str]:
    cleaned_name = (name or "").strip()
    cleaned_email = (email or "").strip().lower()
    cleaned_phone = (phone or "").strip()
    cleaned_company = (company or "").strip()

    if not cleaned_email and not cleaned_phone:
        raise ValueError("Either email or phone is required")

    return cleaned_name, cleaned_email, cleaned_phone, cleaned_company


def _parse_auto_agent_marker(description: Optional[str]) -> tuple[bool, Optional[str]]:
    raw = (description or "").strip()
    if not raw.startswith(AUTO_AGENT_CONTACT_LIST_MARKER_PREFIX):
        return False, None

    widget_id = raw[len(AUTO_AGENT_CONTACT_LIST_MARKER_PREFIX) :].strip() or None
    return True, widget_id


def _serialize_campaign(
    campaign: Campaign,
    contact_list_name: Optional[str] = None,
    product_name: Optional[str] = None,
) -> dict:
    return {
        "id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "campaign_type": campaign.campaign_type,
        "message_template": campaign.message_template,
        "contact_list_id": campaign.contact_list_id,
        "contact_list_name": contact_list_name,
        "product_id": campaign.product_id,
        "product_name": product_name,
        "scheduled_time": campaign.scheduled_time,
        "status": campaign.status,
        "number_sent": campaign.number_sent,
        "number_failed": campaign.number_failed,
        "created_at": campaign.created_at,
    }


def _normalize_text_list(values: Optional[List[str]], limit: int = 5) -> List[str]:
    cleaned: List[str] = []
    for item in values or []:
        text = str(item or "").strip()
        if not text:
            continue
        if text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= limit:
            break
    return cleaned


def _build_email_template_payload(
    campaign_name: str,
    message_template: str,
    payload: CampaignCreateRequest,
) -> str:
    mode = (payload.email_content_mode or "manual").strip().lower()
    if mode not in {"manual", "prompt"}:
        raise HTTPException(
            status_code=400, detail="email_content_mode must be manual or prompt"
        )

    default_subject = (payload.email_subject or campaign_name).strip() or campaign_name
    default_body = (message_template or "").strip()
    subjects = _normalize_text_list(payload.email_subject_variants)
    bodies = _normalize_text_list(payload.email_body_variants)

    if mode == "prompt":
        prompt_context = (payload.email_prompt_context or "").strip()
        if not prompt_context:
            raise HTTPException(
                status_code=400,
                detail="email_prompt_context is required for prompt mode",
            )

        if len(subjects) < 5 or len(bodies) < 5:
            generated = generate_email_variants_from_prompt(
                campaign_name=campaign_name, prompt_context=prompt_context
            )
            subjects = _normalize_text_list(generated.get("subjects"), limit=5)
            bodies = _normalize_text_list(generated.get("bodies"), limit=5)

        if len(subjects) < 5 or len(bodies) < 5:
            raise HTTPException(
                status_code=500,
                detail="Unable to generate 5 email subjects and 5 email bodies",
            )

        default_subject = subjects[0]
        default_body = bodies[0]
    else:
        if not default_body:
            raise HTTPException(status_code=400, detail="message_template is required")
        if not subjects:
            subjects = [default_subject]
        if not bodies:
            bodies = [default_body]

    serialized = {
        "format": "email_v2",
        "mode": mode,
        "default_subject": default_subject,
        "default_body": default_body,
        "subjects": subjects,
        "bodies": bodies,
        "prompt_context": (payload.email_prompt_context or "").strip() or None,
    }
    return json.dumps(serialized, ensure_ascii=True)


def _resolve_email_payload_for_contact(
    campaign_name: str, template_blob: str, contact_index: int
) -> tuple[str, str]:
    raw_template = (template_blob or "").strip()
    fallback_subject = (campaign_name or "Campaign Update").strip() or "Campaign Update"

    if not raw_template:
        return fallback_subject, ""

    try:
        parsed = json.loads(raw_template)
    except Exception:
        return fallback_subject, raw_template

    if not isinstance(parsed, dict) or parsed.get("format") != "email_v2":
        return fallback_subject, raw_template

    subjects = _normalize_text_list(parsed.get("subjects"))
    bodies = _normalize_text_list(parsed.get("bodies"))

    if subjects and bodies:
        combos = [(subject, body) for subject in subjects for body in bodies]
        selected_subject, selected_body = combos[contact_index % len(combos)]
        return selected_subject, selected_body

    default_subject = (
        str(parsed.get("default_subject") or fallback_subject).strip()
        or fallback_subject
    )
    default_body = str(parsed.get("default_body") or "").strip()

    if not default_body:
        default_body = raw_template

    return default_subject, default_body


def _get_active_twilio_sms_config(
    db: Session, organization_id: int
) -> Optional[TwilioSmsChannel]:
    return (
        db.query(TwilioSmsChannel)
        .filter(
            TwilioSmsChannel.organization_id == organization_id,
            TwilioSmsChannel.is_active == True,
        )
        .first()
    )


def _get_tracking_base_url() -> str:
    return (
        (settings.CAMPAIGN_EMAIL_TRACKING_BASE_URL or "http://localhost:8000")
        .strip()
        .rstrip("/")
    )


def _is_safe_redirect_url(value: str) -> bool:
    parsed = urlparse((value or "").strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _normalize_tracking_status(value: Optional[str]) -> str:
    key = (value or "").strip().lower()
    return TRACKING_EVENT_TO_STATUS.get(key, key)


def _set_campaign_log_status(log: CampaignLog, next_status: str) -> None:
    next_key = _normalize_tracking_status(next_status)
    if next_key not in TRACKING_STATUS_RANK:
        return
    current_key = (log.status or "pending").strip().lower() or "pending"
    current_rank = TRACKING_STATUS_RANK.get(current_key, 0)
    next_rank = TRACKING_STATUS_RANK.get(next_key, 0)

    if (
        current_key in TERMINAL_TRACKING_STATUSES
        and next_key not in TERMINAL_TRACKING_STATUSES
    ):
        return
    if next_rank >= current_rank:
        log.status = next_key


def _apply_tracking_event(
    log: CampaignLog,
    event: str,
    event_at: Optional[datetime] = None,
    payload: Optional[dict[str, Any]] = None,
) -> None:
    at = event_at or datetime.utcnow()
    event_key = _normalize_tracking_status(event)

    if event_key in {"sent", "delivered"}:
        if not log.sent_at:
            log.sent_at = at
        if not log.delivered_at:
            log.delivered_at = at
    elif event_key == "opened":
        log.open_count = int(log.open_count or 0) + 1
        if not log.opened_at:
            log.opened_at = at
        if not log.read_at:
            # Heuristic fallback: first open approximates read when provider read signal is unavailable.
            log.read_at = at
    elif event_key == "read":
        if not log.opened_at:
            log.opened_at = at
        if not log.read_at:
            log.read_at = at
    elif event_key == "clicked":
        log.click_count = int(log.click_count or 0) + 1
        if not log.opened_at:
            log.opened_at = at
        if not log.read_at:
            log.read_at = at
        if not log.clicked_at:
            log.clicked_at = at
    elif event_key == "bounced":
        if not log.bounced_at:
            log.bounced_at = at
    elif event_key == "complained":
        if not log.complained_at:
            log.complained_at = at
    elif event_key == "unsubscribed":
        if not log.unsubscribed_at:
            log.unsubscribed_at = at
    elif event_key == "failed":
        if not log.error_message:
            log.error_message = "Delivery failed"

    _set_campaign_log_status(log, event_key)
    log.last_event_type = event_key
    log.last_event_at = at
    if payload:
        try:
            log.event_payload = json.dumps(payload, ensure_ascii=True)
        except Exception:
            pass


def _serialize_campaign_log(row: CampaignLog, contact: Optional[Contact]) -> dict:
    is_converted = bool(row.converted_lead_id)
    return {
        "id": row.id,
        "campaign_id": row.campaign_id,
        "contact_id": row.contact_id,
        "run_sequence": int(row.run_sequence or 1),
        "run_started_at": row.run_started_at,
        "converted_lead_id": row.converted_lead_id,
        "is_converted_to_lead": is_converted,
        "contact_name": contact.name if contact else None,
        "email": contact.email if contact else None,
        "phone": contact.phone if contact else None,
        "status": row.status,
        "sent_at": row.sent_at,
        "delivered_at": row.delivered_at,
        "opened_at": row.opened_at,
        "read_at": row.read_at,
        "clicked_at": row.clicked_at,
        "bounced_at": row.bounced_at,
        "complained_at": row.complained_at,
        "unsubscribed_at": row.unsubscribed_at,
        "open_count": int(row.open_count or 0),
        "click_count": int(row.click_count or 0),
        "provider_message_id": row.provider_message_id,
        "last_event_type": row.last_event_type,
        "last_event_at": row.last_event_at,
        "error_message": row.error_message,
        "created_at": row.created_at,
    }


def _send_campaign_message(
    campaign: Campaign,
    contact: Contact,
    contact_index: int,
    tracking_token: Optional[str] = None,
    twilio_sms_config: Optional[TwilioSmsChannel] = None,
    db: Session = None,
) -> tuple[bool, Optional[str], Optional[str]]:
    """Send campaign message for the selected channel.

    Email sends via SMTP, WhatsApp remains placeholder, SMS sends via Twilio.
    """
    if campaign.campaign_type == "email":
        subject, body = _resolve_email_payload_for_contact(
            campaign_name=campaign.campaign_name,
            template_blob=campaign.message_template,
            contact_index=contact_index,
        )

        subject = render_template(subject, contact)
        body = render_template(body, contact)

        # Round-robin using contact index to distribute across multiple SMTP configs if available
        smtp_profiles = (
            db.query(OrganizationEmailSetting)
            .filter(
                OrganizationEmailSetting.organization_id == campaign.organization_id,
                OrganizationEmailSetting.is_active == True,
            )
            .order_by(OrganizationEmailSetting.id)
            .all()
        )

        smtp_profile = smtp_profiles[contact_index % len(smtp_profiles)]

        return send_campaign_email(
            recipient_email=contact.email or "",
            recipient_name=contact.name or "",
            campaign_name=campaign.campaign_name,
            message_template=body,
            subject=subject,
            tracking_token=tracking_token,
            tracking_base_url=_get_tracking_base_url(),
            org_email_setting=smtp_profile,
            open_tracking_enabled=campaign.open_tracking_enabled,
            click_tracking_enabled=campaign.click_tracking_enabled,
            footer_display_enabled=campaign.footer_display_enabled,
        )

    if campaign.campaign_type == "whatsapp":
        digits = "".join(ch for ch in (contact.phone or "") if ch.isdigit())
        if len(digits) < 8:
            return False, "Missing or invalid phone", None

        config = (
            db.query(WhatsAppChannel)
            .filter(
                WhatsAppChannel.organization_id == campaign.organization_id,
                WhatsAppChannel.widget_id.is_(None),  # only org-level config
                WhatsAppChannel.is_active == True,
            )
            .first()
        )

        if not config:
            return False, "WhatsApp channel not found or inactive", None

        template = (
            db.query(MessageTemplate)
            .filter(
                MessageTemplate.id == campaign.message_template_id,
                MessageTemplate.organization_id == campaign.organization_id,
                MessageTemplate.type == "whatsapp",
                MessageTemplate.meta_status == "APPROVED",
                MessageTemplate.is_latest == True,
            )
            .first()
        )

        if not template:
            return False, "WhatsApp message template not found or not approved", None

        try:
            send_whatsapp_template_message(
                phone_number_id=config.phone_number_id,
                access_token=config.access_token,
                to_number=contact.phone,
                template=template,
                contact=contact,
            )
        except Exception as e:
            return False, str(e), None

        return True, None, None

    if campaign.campaign_type == "sms":
        if not twilio_sms_config:
            return False, "Twilio SMS is not configured or inactive", None

        template = (
            db.query(MessageTemplate)
            .filter(
                MessageTemplate.id == campaign.message_template_id,
                MessageTemplate.organization_id == campaign.organization_id,
                MessageTemplate.type == "sms",
            )
            .first()
        )

        if not template:
            return False, "SMS message template not found", None

        rendered_message = render_sms_template(
            template=campaign.message_template,
            recipient_name=contact.name or "",
            campaign_name=campaign.campaign_name,
        )

        rendered_message = render_template(rendered_message, contact)

        is_sent, error_message = send_twilio_sms(
            config=twilio_sms_config,
            to_number=contact.phone or "",
            message_text=rendered_message,
        )
        return is_sent, error_message, None

    return False, "Unsupported campaign type", None


def extract_placeholders(text):
    if not text:
        return set()
    return set(re.findall(r"\{\{(.*?)\}\}", text))


def render_template(template_body: str, contact):
    if not template_body:
        return ""

    placeholders = extract_placeholders(template_body)

    for key in placeholders:
        value = getattr(contact, key, "")

        # handle None safely + numeric types
        if value is None:
            value = ""
        else:
            value = str(value)

        template_body = template_body.replace(f"{{{{{key}}}}}", value)

    return template_body


def get_feature_code_for_campaign_type(campaign_type: str) -> str:
    if campaign_type == "email":
        return FeatureCodes.CMP_EMAIL_SEND
    elif campaign_type == "whatsapp":
        return FeatureCodes.CMP_WA_CONVERSATION
    elif campaign_type == "sms":
        return FeatureCodes.CMP_SMS_SEGMENT
    else:
        return FeatureCodes.CMP_EMAIL_SEND


def run_campaign_background(
    campaign_id: int,
    organization_id: int,
):
    db = SessionLocal()

    try:
        campaign = (
            db.query(Campaign)
            .filter(
                Campaign.id == campaign_id,
                Campaign.organization_id == organization_id,
            )
            .first()
        )

        if not campaign:
            return

        contact_list = (
            db.query(ContactList)
            .filter(ContactList.id == campaign.contact_list_id)
            .first()
        )

        if not contact_list:
            return

        contacts = (
            db.query(Contact).filter(Contact.contact_list_id == contact_list.id).all()
        )

        twilio_sms_config = None

        if campaign.campaign_type == "sms":
            twilio_sms_config = _get_active_twilio_sms_config(
                db,
                organization_id,
            )

        _execute_campaign_now(
            db,
            campaign,
            contacts,
            twilio_sms_config=twilio_sms_config,
        )

    finally:
        db.close()


def _execute_campaign_now(
    db: Session,
    campaign: Campaign,
    contacts: List[Contact],
    twilio_sms_config: Optional[TwilioSmsChannel] = None,
) -> dict:

    run_sequence = (
        int(
            db.query(func.coalesce(func.max(CampaignLog.run_sequence), 0))
            .filter(CampaignLog.campaign_id == campaign.id)
            .scalar()
            or 0
        )
        + 1
    )
    run_started_at = datetime.utcnow()

    campaign.status = "running"
    campaign.number_sent = 0
    campaign.number_failed = 0
    db.commit()

    sent_count = 0
    failed_count = 0
    next_break_after = get_next_break_after()

    for idx, contact in enumerate(contacts):
        for_index = sent_count + failed_count
        tracking_token = uuid.uuid4().hex if campaign.campaign_type == "email" else None

        log = CampaignLog(
            campaign_id=campaign.id,
            contact_id=contact.id,
            run_sequence=run_sequence,
            run_started_at=run_started_at,
            status="pending",
            tracking_token=tracking_token,
            open_count=0,
            click_count=0,
        )
        db.add(log)
        db.flush()

        is_sent, error_message, provider_message_id = _send_campaign_message(
            campaign,
            contact,
            contact_index=for_index,
            tracking_token=tracking_token,
            twilio_sms_config=twilio_sms_config,
            db=db,
        )

        log.provider_message_id = provider_message_id
        if is_sent:
            _apply_tracking_event(log, "delivered")
            log.error_message = None
        else:
            _apply_tracking_event(log, "failed")
            log.error_message = error_message

        if is_sent:
            sent_count += 1
        else:
            failed_count += 1

        db.commit()
        if idx < len(contacts) - 1:
            if campaign.campaign_type == "sms":
                base_interval = settings.SMS_CAMPAIGN_SEND_INTERVAL_SECONDS
            elif campaign.campaign_type == "whatsapp":
                base_interval = settings.WHATSAPP_CAMPAIGN_SEND_INTERVAL_SECONDS
            else:
                base_interval = settings.EMAIL_CAMPAIGN_SEND_INTERVAL_SECONDS

            if campaign.campaign_type == "email":
                delay, next_break_after = get_email_send_interval(
                    base_interval=base_interval,
                    emails_sent=idx + 1,
                    next_break_after=next_break_after,
                )

                logger.info(
                    "Waiting %s seconds before next email (base=%s)",
                    delay,
                    base_interval,
                )

                time.sleep(delay)
            else:
                time.sleep(
                    base_interval
                )  # wait according to settings before next contact

    campaign.number_sent = sent_count
    campaign.number_failed = failed_count
    campaign.status = "completed" if sent_count > 0 else "failed"
    db.flush()

    organization_credit_service.consume_reserved_credits(
        db=db,
        reference_type="campaign",
        reference_id=str(campaign.id),
        actual_quantity=sent_count,
    )

    db.commit()
    db.refresh(campaign)

    # Optional post-send automation: convert qualified campaign contacts to leads.
    try:
        active_rule = get_or_create_active_rule(db, campaign.organization_id)
        if bool(active_rule.auto_convert_enabled):
            run_rule_engine(
                db=db,
                organization_id=campaign.organization_id,
                rule=active_rule,
                campaign_id=campaign.id,
                dry_run=False,
                limit=max(100, len(contacts) * 2),
            )
    except Exception:
        # Never fail campaign execution because of rule-engine post-processing.
        pass

    return {
        "campaign_id": campaign.id,
        "run_sequence": run_sequence,
        "run_started_at": run_started_at,
        "status": campaign.status,
        "number_sent": sent_count,
        "number_failed": failed_count,
        "total_contacts": len(contacts),
    }


@router.get("/c2l/rules/current")
async def get_campaign_to_lead_rule(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    rule = get_or_create_active_rule(db, current_user.organization_id)
    return serialize_rule(rule)


@router.put("/c2l/rules/current")
async def update_campaign_to_lead_rule(
    payload: CampaignToLeadRuleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    rule = get_or_create_active_rule(db, current_user.organization_id)
    updated = update_rule(db, rule, payload.dict(exclude_unset=True))
    return serialize_rule(updated)


@router.post("/c2l/run")
async def run_campaign_to_lead_rule_engine(
    payload: CampaignToLeadRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.campaign_id:
        exists = (
            db.query(Campaign.id)
            .filter(
                Campaign.id == payload.campaign_id,
                Campaign.organization_id == current_user.organization_id,
            )
            .first()
        )
        if not exists:
            raise HTTPException(status_code=404, detail="Campaign not found")

    rule = get_or_create_active_rule(db, current_user.organization_id)
    result = run_rule_engine(
        db=db,
        organization_id=current_user.organization_id,
        rule=rule,
        campaign_id=payload.campaign_id,
        dry_run=bool(payload.dry_run),
        limit=max(1, min(int(payload.limit or 500), 5000)),
    )
    return result


@router.get("/c2l/conversions")
async def list_campaign_to_lead_conversions(
    campaign_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limit = max(1, min(limit, 500))

    campaign_ids_query = db.query(Campaign.id).filter(
        Campaign.organization_id == current_user.organization_id
    )
    if campaign_id:
        campaign_ids_query = campaign_ids_query.filter(Campaign.id == campaign_id)
    org_campaign_ids = [row.id for row in campaign_ids_query.all()]

    if not org_campaign_ids:
        return {"items": [], "pagination": {"total": 0, "skip": skip, "limit": limit}}

    query = db.query(CampaignLeadConversion).filter(
        CampaignLeadConversion.campaign_id.in_(org_campaign_ids)
    )
    if status:
        query = query.filter(CampaignLeadConversion.status == status.strip().lower())

    total = query.count()
    rows = (
        query.order_by(CampaignLeadConversion.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": row.id,
                "campaign_id": row.campaign_id,
                "campaign_log_id": row.campaign_log_id,
                "contact_id": row.contact_id,
                "lead_id": row.lead_id,
                "rule_id": row.rule_id,
                "score": row.score,
                "status": row.status,
                "reason": row.reason,
                "details": row.details,
                "created_at": row.created_at,
            }
            for row in rows
        ],
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
        },
    }


@router.get("/reports/summary")
async def get_campaign_reports_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    window_days = max(1, min(days, 365))
    window_start = datetime.utcnow() - pd.Timedelta(days=window_days)

    campaign_rows = (
        db.query(Campaign.id, Campaign.campaign_name, Campaign.campaign_type)
        .filter(Campaign.organization_id == current_user.organization_id)
        .all()
    )
    campaign_meta = {
        row.id: {
            "campaign_name": row.campaign_name,
            "campaign_type": (row.campaign_type or "").lower(),
        }
        for row in campaign_rows
    }
    campaign_ids = list(campaign_meta.keys())

    if not campaign_ids:
        return {
            "generated_at": datetime.utcnow(),
            "window_days": window_days,
            "overview": {
                "campaign_count": 0,
                "run_count": 0,
                "message_count": 0,
                "sent_count": 0,
                "failed_count": 0,
                "success_rate": 0.0,
            },
            "channel_breakdown": {
                "email": {
                    "runs": 0,
                    "messages": 0,
                    "sent": 0,
                    "failed": 0,
                    "success_rate": 0.0,
                },
                "sms": {
                    "runs": 0,
                    "messages": 0,
                    "sent": 0,
                    "failed": 0,
                    "success_rate": 0.0,
                },
                "whatsapp": {
                    "runs": 0,
                    "messages": 0,
                    "sent": 0,
                    "failed": 0,
                    "success_rate": 0.0,
                },
            },
            "email_analytics": {
                "delivered": 0,
                "opened": 0,
                "read": 0,
                "clicked": 0,
                "bounced": 0,
                "complained": 0,
                "unsubscribed": 0,
                "total_open_events": 0,
                "total_click_events": 0,
                "delivery_rate": 0.0,
                "open_rate": 0.0,
                "read_rate": 0.0,
                "click_rate": 0.0,
                "click_to_open_rate": 0.0,
                "bounce_rate": 0.0,
                "complaint_rate": 0.0,
                "unsubscribe_rate": 0.0,
            },
            "top_campaigns": [],
            "daily_trend": [],
        }

    logs = (
        db.query(CampaignLog)
        .filter(
            CampaignLog.campaign_id.in_(campaign_ids),
            CampaignLog.created_at >= window_start,
        )
        .all()
    )

    def _pct(numerator: int, denominator: int) -> float:
        if denominator <= 0:
            return 0.0
        return round((numerator * 100.0) / denominator, 2)

    channel_stats = {
        "email": {"runs": set(), "messages": 0, "sent": 0, "failed": 0},
        "sms": {"runs": set(), "messages": 0, "sent": 0, "failed": 0},
        "whatsapp": {"runs": set(), "messages": 0, "sent": 0, "failed": 0},
    }

    top_campaigns: dict[int, dict[str, Any]] = {}
    run_set: set[tuple[int, int]] = set()
    sent_count = 0
    failed_count = 0

    email_delivered = 0
    email_opened = 0
    email_read = 0
    email_clicked = 0
    email_bounced = 0
    email_complained = 0
    email_unsubscribed = 0
    total_open_events = 0
    total_click_events = 0

    daily_rollup: dict[str, dict[str, int]] = {}

    for log in logs:
        meta = campaign_meta.get(log.campaign_id)
        if not meta:
            continue

        channel = meta.get("campaign_type") or ""
        if channel not in channel_stats:
            continue

        status_key = (log.status or "").lower()
        run_key = (log.campaign_id, int(log.run_sequence or 1))
        run_set.add(run_key)

        channel_stats[channel]["messages"] += 1
        channel_stats[channel]["runs"].add(run_key)

        is_failed = status_key in {"failed", "bounced", "complained", "unsubscribed"}
        if is_failed:
            channel_stats[channel]["failed"] += 1
            failed_count += 1
        else:
            channel_stats[channel]["sent"] += 1
            sent_count += 1

        campaign_entry = top_campaigns.setdefault(
            log.campaign_id,
            {
                "campaign_id": log.campaign_id,
                "campaign_name": meta.get("campaign_name")
                or f"Campaign #{log.campaign_id}",
                "campaign_type": channel,
                "messages": 0,
                "sent": 0,
                "failed": 0,
                "opened": 0,
                "clicked": 0,
                "runs": set(),
                "last_event_at": None,
            },
        )
        campaign_entry["messages"] += 1
        campaign_entry["runs"].add(run_key)
        if is_failed:
            campaign_entry["failed"] += 1
        else:
            campaign_entry["sent"] += 1

        if channel == "email":
            if log.delivered_at:
                email_delivered += 1
            if log.opened_at:
                email_opened += 1
                campaign_entry["opened"] += 1
            if log.read_at:
                email_read += 1
            if log.clicked_at:
                email_clicked += 1
                campaign_entry["clicked"] += 1
            if log.bounced_at:
                email_bounced += 1
            if log.complained_at:
                email_complained += 1
            if log.unsubscribed_at:
                email_unsubscribed += 1
            total_open_events += int(log.open_count or 0)
            total_click_events += int(log.click_count or 0)

        event_time = log.last_event_at or log.created_at
        if event_time:
            if (
                not campaign_entry["last_event_at"]
                or event_time > campaign_entry["last_event_at"]
            ):
                campaign_entry["last_event_at"] = event_time

            day_key = event_time.date().isoformat()
            day_bucket = daily_rollup.setdefault(
                day_key,
                {
                    "email_sent": 0,
                    "email_opened": 0,
                    "email_clicked": 0,
                    "sms_sent": 0,
                    "whatsapp_sent": 0,
                    "failed": 0,
                },
            )
            if is_failed:
                day_bucket["failed"] += 1
            else:
                if channel == "email":
                    day_bucket["email_sent"] += 1
                elif channel == "sms":
                    day_bucket["sms_sent"] += 1
                elif channel == "whatsapp":
                    day_bucket["whatsapp_sent"] += 1

                if channel == "email" and log.opened_at:
                    day_bucket["email_opened"] += 1
                if channel == "email" and log.clicked_at:
                    day_bucket["email_clicked"] += 1

    channel_breakdown = {}
    for channel_name, stats in channel_stats.items():
        messages = int(stats["messages"])
        sent = int(stats["sent"])
        failed = int(stats["failed"])
        channel_breakdown[channel_name] = {
            "runs": len(stats["runs"]),
            "messages": messages,
            "sent": sent,
            "failed": failed,
            "success_rate": _pct(sent, messages),
        }

    top_campaign_rows = []
    for entry in top_campaigns.values():
        messages = int(entry["messages"])
        sent = int(entry["sent"])
        opened = int(entry["opened"])
        clicked = int(entry["clicked"])
        top_campaign_rows.append(
            {
                "campaign_id": entry["campaign_id"],
                "campaign_name": entry["campaign_name"],
                "campaign_type": entry["campaign_type"],
                "runs": len(entry["runs"]),
                "messages": messages,
                "sent": sent,
                "failed": int(entry["failed"]),
                "open_rate": _pct(opened, sent),
                "click_rate": _pct(clicked, sent),
                "last_event_at": entry["last_event_at"],
            }
        )

    top_campaign_rows.sort(key=lambda item: item.get("messages", 0), reverse=True)

    daily_trend = [
        {
            "date": date_key,
            **bucket,
        }
        for date_key, bucket in sorted(daily_rollup.items())
    ]

    email_sent = int(channel_stats["email"]["sent"])

    return {
        "generated_at": datetime.utcnow(),
        "window_days": window_days,
        "overview": {
            "campaign_count": len(campaign_ids),
            "run_count": len(run_set),
            "message_count": len(logs),
            "sent_count": sent_count,
            "failed_count": failed_count,
            "success_rate": _pct(sent_count, len(logs)),
        },
        "channel_breakdown": channel_breakdown,
        "email_analytics": {
            "delivered": email_delivered,
            "opened": email_opened,
            "read": email_read,
            "clicked": email_clicked,
            "bounced": email_bounced,
            "complained": email_complained,
            "unsubscribed": email_unsubscribed,
            "total_open_events": total_open_events,
            "total_click_events": total_click_events,
            "delivery_rate": _pct(email_delivered, email_sent),
            "open_rate": _pct(email_opened, email_sent),
            "read_rate": _pct(email_read, email_sent),
            "click_rate": _pct(email_clicked, email_sent),
            "click_to_open_rate": _pct(email_clicked, email_opened),
            "bounce_rate": _pct(email_bounced, email_sent),
            "complaint_rate": _pct(email_complained, email_sent),
            "unsubscribe_rate": _pct(email_unsubscribed, email_sent),
        },
        "top_campaigns": top_campaign_rows[:10],
        "daily_trend": daily_trend,
    }


@router.get("/public/email-track/open/{tracking_token}.gif")
async def campaign_email_open_pixel(
    tracking_token: str,
    db: Session = Depends(get_db),
):
    log = (
        db.query(CampaignLog)
        .filter(CampaignLog.tracking_token == tracking_token)
        .first()
    )
    if log:
        _apply_tracking_event(log, "opened")
        db.commit()
    return Response(
        content=TRACKING_PIXEL_GIF,
        media_type="image/gif",
        headers={"Cache-Control": "no-cache, no-store"},
    )


@router.get("/public/email-track/click/{tracking_token}")
async def campaign_email_click_redirect(
    tracking_token: str,
    url: str = Query(...),
    db: Session = Depends(get_db),
):
    destination = (url or "").strip()
    if not _is_safe_redirect_url(destination):
        raise HTTPException(status_code=400, detail="Invalid redirect URL")

    log = (
        db.query(CampaignLog)
        .filter(CampaignLog.tracking_token == tracking_token)
        .first()
    )
    if log:
        _apply_tracking_event(log, "clicked", payload={"redirect_url": destination})
        db.commit()

    return RedirectResponse(url=destination, status_code=307)


@router.post("/public/email-track/webhook")
async def campaign_email_tracking_webhook(
    payload: CampaignEmailTrackingWebhookRequest,
    db: Session = Depends(get_db),
    x_campaign_webhook_secret: Optional[str] = Header(default=None),
):
    configured_secret = (settings.CAMPAIGN_EMAIL_WEBHOOK_SECRET or "").strip()
    if (
        configured_secret
        and (x_campaign_webhook_secret or "").strip() != configured_secret
    ):
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    event = _normalize_tracking_status(payload.event)
    if event not in ALLOWED_LOG_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported event")

    log = None
    if payload.tracking_token:
        log = (
            db.query(CampaignLog)
            .filter(CampaignLog.tracking_token == payload.tracking_token.strip())
            .first()
        )
    if not log and payload.provider_message_id:
        log = (
            db.query(CampaignLog)
            .filter(
                CampaignLog.provider_message_id == payload.provider_message_id.strip()
            )
            .first()
        )

    if not log:
        raise HTTPException(status_code=404, detail="Campaign log not found")

    _apply_tracking_event(
        log,
        event,
        event_at=payload.event_at,
        payload=payload.details,
    )
    db.commit()
    db.refresh(log)

    return {"ok": True, "log_id": log.id, "status": log.status}


@router.post("/email/generate-variants")
async def generate_email_variants(
    payload: EmailVariantGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:

        valid = organization_credit_service.validate_feature_usage(
            db, current_user.organization_id, FeatureCodes.CMP_AI_CONTENT_GEN, 1
        )

        if not valid:
            raise HTTPException(
                status_code=400,
                detail="Insufficient credits. Please add more credits to continue.",
            )

        db.close()

        data = generate_email_variants_from_prompt(
            campaign_name=(payload.campaign_name or "Campaign").strip() or "Campaign",
            prompt_context=payload.prompt_context,
        )

        # get fresh session
        db = SessionLocal()

        organization_credit_service.deduct_credits(
            db=db,
            organization_id=current_user.organization_id,
            feature_code=FeatureCodes.CMP_AI_CONTENT_GEN,
            quantity=1,
            reference_type="campaign_email_variant_generation",
        )

        db.commit()

        return {
            "subjects": data["subjects"],
            "bodies": data["bodies"],
            "combinations": len(data["subjects"]) * len(data["bodies"]),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate email variants: {str(exc)}"
        )


@router.post("/email/spam-score")
async def score_email_variants_for_spam(
    payload: EmailSpamScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        valid = organization_credit_service.validate_feature_usage(
            db, current_user.organization_id, FeatureCodes.CMP_AI_SPAM_CHECK, 1
        )

        if not valid:
            raise HTTPException(
                status_code=400,
                detail="Insufficient credits. Please add more credits to continue.",
            )

        db.close()

        data = evaluate_email_spam_score(
            campaign_name=(payload.campaign_name or "Campaign").strip() or "Campaign",
            prompt_context=payload.prompt_context,
            subjects=payload.subjects,
            bodies=payload.bodies,
        )

        # get fresh session
        db = SessionLocal()

        organization_credit_service.deduct_credits(
            db=db,
            organization_id=current_user.organization_id,
            feature_code=FeatureCodes.CMP_AI_SPAM_CHECK,
            quantity=1,
            reference_type="campaign_email_spam_score",
        )

        db.commit()
        return data
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to score spam risk: {str(exc)}"
        )


@router.get("/dashboard/stats")
async def campaign_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    org_id = current_user.organization_id

    totals = (
        db.query(
            func.count(Campaign.id).label("campaign_count"),
            func.coalesce(func.sum(Campaign.number_sent), 0).label("total_sent"),
            func.coalesce(func.sum(Campaign.number_failed), 0).label("total_failed"),
        )
        .filter(Campaign.organization_id == org_id)
        .first()
    )

    status_rows = (
        db.query(
            Campaign.status,
            func.count(Campaign.id).label("count"),
        )
        .filter(Campaign.organization_id == org_id)
        .group_by(Campaign.status)
        .all()
    )

    recent_campaigns = (
        db.query(Campaign)
        .filter(Campaign.organization_id == org_id)
        .order_by(Campaign.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "campaign_count": int(getattr(totals, "campaign_count", 0) or 0),
        "total_sent": int(getattr(totals, "total_sent", 0) or 0),
        "total_failed": int(getattr(totals, "total_failed", 0) or 0),
        "status_counts": {row.status: row.count for row in status_rows},
        "recent_campaigns": [_serialize_campaign(item) for item in recent_campaigns],
    }


@router.post("/contact-lists")
async def create_contact_list(
    payload: ContactListCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    list_name = payload.list_name.strip()
    if not list_name:
        raise HTTPException(status_code=400, detail="list_name is required")

    contact_list = ContactList(
        organization_id=current_user.organization_id,
        list_name=list_name,
        description=(payload.description or "").strip() or None,
    )
    db.add(contact_list)
    db.commit()
    db.refresh(contact_list)

    return {
        "id": contact_list.id,
        "list_name": contact_list.list_name,
        "description": contact_list.description,
        "is_agent_auto_list": False,
        "agent_widget_id": None,
        "created_at": contact_list.created_at,
    }


@router.put("/contact-lists/{contact_list_id}")
async def update_contact_list(
    contact_list_id: int,
    payload: ContactListCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    list_name = payload.list_name.strip()
    if not list_name:
        raise HTTPException(status_code=400, detail="list_name is required")

    contact_list = (
        db.query(ContactList)
        .filter(
            ContactList.id == contact_list_id,
            ContactList.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    contact_list.list_name = list_name
    contact_list.description = (payload.description or "").strip() or None
    db.add(contact_list)
    db.commit()
    db.refresh(contact_list)

    return {
        "id": contact_list.id,
        "list_name": contact_list.list_name,
        "description": contact_list.description,
        "is_agent_auto_list": False,
        "agent_widget_id": None,
        "created_at": contact_list.created_at,
    }


@router.get("/contact-lists")
async def list_contact_lists(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 25,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limit = max(1, min(limit, 200))
    query = db.query(ContactList).filter(
        ContactList.organization_id == current_user.organization_id
    )

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(ContactList.list_name.ilike(search_term))

    total = query.count()
    rows = query.order_by(ContactList.created_at.desc()).offset(skip).limit(limit).all()

    list_ids = [row.id for row in rows]
    counts = {}
    if list_ids:
        count_rows = (
            db.query(
                Contact.contact_list_id,
                func.count(Contact.id),
            )
            .filter(Contact.contact_list_id.in_(list_ids))
            .group_by(Contact.contact_list_id)
            .all()
        )
        counts = {contact_list_id: count for contact_list_id, count in count_rows}

    return {
        "items": [
            {
                "id": row.id,
                "list_name": row.list_name,
                "description": (None if is_auto else row.description),
                "created_at": row.created_at,
                "contact_count": int(counts.get(row.id, 0)),
                "is_agent_auto_list": is_auto,
                "agent_widget_id": widget_id,
            }
            for row in rows
            for is_auto, widget_id in [_parse_auto_agent_marker(row.description)]
        ],
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
        },
    }


@router.delete("/contact-lists/{contact_list_id}")
async def delete_contact_list(
    contact_list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contact_list = (
        db.query(ContactList)
        .filter(
            ContactList.id == contact_list_id,
            ContactList.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    has_campaigns = (
        db.query(Campaign.id)
        .filter(Campaign.contact_list_id == contact_list.id)
        .first()
    )
    if has_campaigns:
        raise HTTPException(
            status_code=400, detail="Cannot delete contact list linked to campaigns"
        )

    db.query(Contact).filter(Contact.contact_list_id == contact_list.id).delete()
    db.delete(contact_list)
    db.commit()

    return {"message": "Contact list deleted"}


@router.get("/contact-lists/{contact_list_id}/contacts")
async def list_contacts(
    contact_list_id: int,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limit = max(1, min(limit, 500))

    # Fetch contact list
    contact_list = (
        db.query(ContactList)
        .filter(
            ContactList.id == contact_list_id,
            ContactList.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    # Build query
    query = db.query(Contact).filter(Contact.contact_list_id == contact_list_id)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            Contact.name.ilike(search_term)
            | Contact.email.ilike(search_term)
            | Contact.phone.ilike(search_term)
            | Contact.company.ilike(search_term)
            | Contact.whatsapp_number.ilike(search_term)
            | Contact.designation.ilike(search_term)
            | Contact.item_name.ilike(search_term)
            | Contact.item_category.ilike(search_term)
        )

    total = query.count()
    rows = query.order_by(Contact.created_at.desc()).offset(skip).limit(limit).all()

    # Return all fields
    return {
        "items": [
            {
                "id": row.id,
                "contact_list_id": row.contact_list_id,
                "label": f"{row.name} ({row.phone})",
                "name": row.name,
                "email": row.email,
                "phone": row.phone,
                "whatsapp_number": row.whatsapp_number,
                "gender": row.gender,
                "company": row.company,
                "designation": row.designation,
                "item_name": row.item_name,
                "item_type": row.item_type,
                "interest_stage": row.interest_stage,
                "item_category": row.item_category,
                "amount": row.amount,
                "offer_value": row.offer_value,
                "city": row.city,
                "state": row.state,
                "country": row.country,
                "source": row.source,
                "lifecycle_stage": row.lifecycle_stage,
                "tags": row.tags,
                "created_at": row.created_at,
            }
            for row in rows
        ],
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
        },
    }


@router.post("/contact-lists/{contact_list_id}/contacts/manual")
async def upload_contacts_manual(
    contact_list_id: int,
    payload: ContactManualUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contact_list = (
        db.query(ContactList)
        .filter(
            ContactList.id == contact_list_id,
            ContactList.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    if not payload.contacts:
        raise HTTPException(status_code=400, detail="contacts array is required")

    created = 0
    errors = []

    for index, item in enumerate(payload.contacts):
        try:
            existing = (
                db.query(Contact)
                .filter(
                    Contact.contact_list_id == contact_list_id,
                    or_(Contact.phone == item.phone, Contact.email == item.email),
                )
                .first()
            )

            if existing:
                errors.append(
                    {
                        "row": index + 1,
                        "error": f"Contact with phone {item.phone} or email {item.email} already exists in this list",
                    }
                )
                continue

            name, email, phone, company = _validate_contact_payload(
                item.name, item.email, item.phone, item.company
            )
            contact = Contact(
                contact_list_id=contact_list.id,
                name=name or None,
                email=email or None,
                phone=phone or None,
                company=company or None,
            )
            db.add(contact)
            created += 1
        except ValueError as exc:
            errors.append({"row": index + 1, "error": str(exc)})

    db.commit()

    return {
        "created": created,
        "failed": len(errors),
        "errors": errors,
    }


@router.post("/contact-lists/{contact_list_id}/contacts/csv")
async def upload_contacts_csv(
    contact_list_id: int,
    file: UploadFile = File(...),
    country_code: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contact_list = (
        db.query(ContactList)
        .filter(
            ContactList.id == contact_list_id,
            ContactList.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    filename = (file.filename or "").lower()
    rows_iter = []
    normalized_headers = set()

    # -------------------------
    # File Parsing
    # -------------------------
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        try:
            dataframe = pd.read_excel(BytesIO(raw))
        except Exception:
            raise HTTPException(
                status_code=400, detail="Excel file is invalid or unsupported"
            )

        dataframe.columns = [str(col).strip().lower() for col in dataframe.columns]
        normalized_headers = set(dataframe.columns)
        rows_iter = dataframe.fillna("").to_dict(orient="records")

    else:
        try:
            content = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")

        reader = csv.DictReader(StringIO(content))

        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV headers are missing")

        normalized_headers = {
            header.strip().lower() for header in reader.fieldnames if header
        }

        rows_iter = [
            {str(key or "").strip().lower(): value for key, value in row.items()}
            for row in reader
        ]

    required_headers = {"name", "email", "phone"}

    if not (required_headers & normalized_headers):
        raise HTTPException(
            status_code=400,
            detail="File must include at least one of: name, email, phone",
        )

    created = 0
    errors = []
    added_contacts = []
    updated_contacts = []

    # -------------------------
    # Process Rows
    # -------------------------
    for index, row in enumerate(rows_iter, start=2):

        if not any(str(v).strip() for v in row.values() if v):
            continue

        try:
            phone = format_phone_number(row.get("phone"), country_code)

            name, email, phone, company = _validate_contact_payload(
                row.get("name"),
                row.get("email"),
                phone,
                row.get("company"),
            )

            # -------------------------
            # Additional Fields
            # -------------------------

            whatsapp_number = format_phone_number(
                row.get("whatsapp_number"), country_code
            )

            gender = row.get("gender")
            designation = row.get("designation")

            item_name = row.get("item_name")
            item_type = row.get("item_type")
            interest_stage = row.get("interest_stage")
            item_category = row.get("item_category")

            amount = row.get("amount")
            amount = float(amount) if amount else None

            offer_value = row.get("offer_value")

            city = row.get("city")
            state = row.get("state")
            country = row.get("country")

            source = row.get("source")
            lifecycle_stage = row.get("lifecycle_stage")
            tags = row.get("tags")

            # -------------------------
            # Check Existing Contact
            # -------------------------

            existing = None

            if phone:
                existing = (
                    db.query(Contact)
                    .filter(
                        Contact.contact_list_id == contact_list.id,
                        Contact.phone == phone,
                    )
                    .first()
                )

            if not existing and email:
                existing = (
                    db.query(Contact)
                    .filter(
                        Contact.contact_list_id == contact_list.id,
                        Contact.email == email,
                    )
                    .first()
                )

            # -------------------------
            # UPDATE
            # -------------------------

            if existing:
                existing.name = name or existing.name
                existing.email = email or existing.email
                existing.phone = phone or existing.phone
                existing.company = company or existing.company

                existing.whatsapp_number = whatsapp_number or existing.whatsapp_number
                existing.gender = gender or existing.gender
                existing.designation = designation or existing.designation

                existing.item_name = item_name or existing.item_name
                existing.item_type = item_type or existing.item_type
                existing.interest_stage = interest_stage or existing.interest_stage
                existing.item_category = item_category or existing.item_category

                existing.amount = amount if amount is not None else existing.amount
                existing.offer_value = offer_value or existing.offer_value

                existing.city = city or existing.city
                existing.state = state or existing.state
                existing.country = country or existing.country

                existing.source = source or existing.source
                existing.lifecycle_stage = lifecycle_stage or existing.lifecycle_stage
                existing.tags = tags or existing.tags

                updated_contacts.append(
                    {"id": existing.id, "label": f"{existing.name} ({existing.phone})"}
                )

            # -------------------------
            # CREATE
            # -------------------------

            else:
                new_contact = Contact(
                    contact_list_id=contact_list.id,
                    name=name or None,
                    email=email or None,
                    phone=phone or None,
                    company=company or None,
                    whatsapp_number=whatsapp_number,
                    gender=gender,
                    designation=designation,
                    item_name=item_name,
                    item_type=item_type,
                    interest_stage=interest_stage,
                    item_category=item_category,
                    amount=amount,
                    offer_value=offer_value,
                    city=city,
                    state=state,
                    country=country,
                    source=source,
                    lifecycle_stage=lifecycle_stage,
                    tags=tags,
                )

                db.add(new_contact)
                db.flush()

                added_contacts.append(
                    {
                        "id": new_contact.id,
                        "label": f"{new_contact.name} ({new_contact.phone})",
                    }
                )

        except ValueError as exc:
            errors.append({"row": index, "error": str(exc)})

    db.commit()

    return {
        "created": len(added_contacts),
        "updated": len(updated_contacts),
        "failed": len(errors),
        "errors": errors,
    }


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contact = (
        db.query(Contact)
        .join(ContactList, ContactList.id == Contact.contact_list_id)
        .filter(
            Contact.id == contact_id,
            ContactList.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    mapping_exists = (
        db.query(LeadContactMapping.id)
        .filter(LeadContactMapping.contact_id == contact_id)
        .first()
    )

    if mapping_exists:
        raise HTTPException(
            status_code=400, detail="Cannot delete contact: linked to existing lead"
        )

    db.delete(contact)
    db.commit()

    return {"message": "Contact deleted"}


@router.post("")
async def create_campaign(
    payload: CampaignCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    campaign_name = payload.campaign_name.strip()
    if not campaign_name:
        raise HTTPException(status_code=400, detail="campaign_name is required")

    campaign_type = payload.campaign_type.strip().lower()
    if campaign_type not in ALLOWED_CAMPAIGN_TYPES:
        raise HTTPException(
            status_code=400, detail="campaign_type must be email, whatsapp, or sms"
        )

    _ensure_campaign_access(db, current_user.organization_id, campaign_type)

    message_template = payload.message_template.strip()
    if not message_template and campaign_type != "email":
        raise HTTPException(status_code=400, detail="message_template is required")

    status_value = (payload.status or "draft").strip().lower()
    if status_value not in {"draft", "scheduled"}:
        raise HTTPException(status_code=400, detail="status must be draft or scheduled")

    contact_list = (
        db.query(ContactList)
        .filter(
            ContactList.id == payload.contact_list_id,
            ContactList.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not contact_list:
        raise HTTPException(status_code=404, detail="contact_list_id not found")

    # if not payload.product_id:
    #     raise HTTPException(status_code=400, detail="product_id is required")

    if campaign_type == "email" and not (payload.email_subject or "").strip():
        raise HTTPException(
            status_code=400, detail="email_subject is required for email campaigns"
        )

    contacts = (
        db.query(Contact).filter(Contact.contact_list_id == contact_list.id).all()
    )

    valid = organization_credit_service.validate_feature_usage(
        db,
        current_user.organization_id,
        get_feature_code_for_campaign_type(payload.campaign_type),
        len(contacts),
    )

    if not valid:
        raise HTTPException(
            status_code=400,
            detail="Insufficient credits. Please add more credits to continue.",
        )

    if payload.scheduled_time:
        compare_now = datetime.utcnow()
        if payload.scheduled_time.tzinfo is not None:
            compare_now = datetime.now(payload.scheduled_time.tzinfo)
    else:
        compare_now = None

    if (
        payload.scheduled_time
        and compare_now
        and payload.scheduled_time > compare_now
        and status_value == "draft"
    ):
        status_value = "scheduled"

    product_name = None
    if payload.product_id:
        product = (
            db.query(Product)
            .filter(
                Product.id == payload.product_id,
                Product.organization_id == current_user.organization_id,
                Product.is_deleted == False,
            )
            .first()
        )
        if not product:
            raise HTTPException(status_code=404, detail="product_id not found")
        product_name = product.name

    if campaign_type == "email":
        message_template = _build_email_template_payload(
            campaign_name=campaign_name,
            message_template=message_template,
            payload=payload,
        )

    campaign = Campaign(
        organization_id=current_user.organization_id,
        campaign_name=campaign_name,
        campaign_type=campaign_type,
        message_template_id=payload.message_template_id,
        message_template=message_template,
        contact_list_id=payload.contact_list_id,
        product_id=payload.product_id,
        category=payload.category,
        scheduled_time=payload.scheduled_time,
        open_tracking_enabled=payload.open_tracking_enabled,
        click_tracking_enabled=payload.click_tracking_enabled,
        footer_display_enabled=payload.footer_display_enabled,
        status=status_value,
        number_sent=0,
        number_failed=0,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    organization_credit_service.reserve_credits(
        db=db,
        organization_id=current_user.organization_id,
        feature_code=get_feature_code_for_campaign_type(payload.campaign_type),
        quantity=len(contacts),
        reference_type="campaign",
        reference_id=str(campaign.id),
    )

    return _serialize_campaign(
        campaign,
        contact_list_name=contact_list.list_name,
        product_name=product_name,
    )


@router.get("")
async def list_campaigns(
    search: Optional[str] = None,
    campaign_type: Optional[str] = None,
    status: Optional[str] = None,
    product_id: Optional[int] = None,
    contact_list_id: Optional[int] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    scheduled_from: Optional[str] = None,
    scheduled_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 25,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limit = max(1, min(limit, 200))

    query = db.query(Campaign).filter(
        Campaign.organization_id == current_user.organization_id
    )

    if search:
        query = query.filter(Campaign.campaign_name.ilike(f"%{search.strip()}%"))

    if campaign_type:
        ct = campaign_type.strip().lower()
        if ct not in ALLOWED_CAMPAIGN_TYPES:
            raise HTTPException(status_code=400, detail="Invalid campaign_type filter")
        query = query.filter(Campaign.campaign_type == ct)

    if status:
        status_value = status.strip().lower()
        if status_value not in ALLOWED_CAMPAIGN_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Campaign.status == status_value)

    if product_id is not None:
        if product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product_id filter")
        query = query.filter(Campaign.product_id == product_id)

    if contact_list_id is not None:
        if contact_list_id <= 0:
            raise HTTPException(
                status_code=400, detail="Invalid contact_list_id filter"
            )
        query = query.filter(Campaign.contact_list_id == contact_list_id)

    def _parse_iso_datetime(
        value: Optional[str], field_name: str
    ) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid {field_name}; expected ISO datetime"
            )

    created_from_dt = _parse_iso_datetime(created_from, "created_from")
    created_to_dt = _parse_iso_datetime(created_to, "created_to")
    scheduled_from_dt = _parse_iso_datetime(scheduled_from, "scheduled_from")
    scheduled_to_dt = _parse_iso_datetime(scheduled_to, "scheduled_to")

    if created_from_dt:
        query = query.filter(Campaign.created_at >= created_from_dt)
    if created_to_dt:
        query = query.filter(Campaign.created_at <= created_to_dt)

    if scheduled_from_dt:
        query = query.filter(
            Campaign.scheduled_time.isnot(None),
            Campaign.scheduled_time >= scheduled_from_dt,
        )
    if scheduled_to_dt:
        query = query.filter(
            Campaign.scheduled_time.isnot(None),
            Campaign.scheduled_time <= scheduled_to_dt,
        )

    total = query.count()
    rows = query.order_by(Campaign.created_at.desc()).offset(skip).limit(limit).all()

    contact_list_ids = [row.contact_list_id for row in rows]
    product_ids = [row.product_id for row in rows if row.product_id]
    contact_list_map = {}
    product_map = {}
    if contact_list_ids:
        contact_lists = (
            db.query(ContactList).filter(ContactList.id.in_(contact_list_ids)).all()
        )
        contact_list_map = {item.id: item.list_name for item in contact_lists}
    if product_ids:
        products = db.query(Product).filter(Product.id.in_(product_ids)).all()
        product_map = {item.id: item.name for item in products}

    return {
        "items": [
            _serialize_campaign(
                row,
                contact_list_map.get(row.contact_list_id),
                product_map.get(row.product_id),
            )
            for row in rows
        ],
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
        },
    }


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = (
        db.query(Campaign)
        .filter(
            Campaign.id == campaign_id,
            Campaign.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    contact_list = (
        db.query(ContactList).filter(ContactList.id == row.contact_list_id).first()
    )
    product_name = None
    if row.product_id:
        product = db.query(Product).filter(Product.id == row.product_id).first()
        product_name = product.name if product else None

    return _serialize_campaign(
        row,
        contact_list_name=contact_list.list_name if contact_list else None,
        product_name=product_name,
    )


@router.post("/{campaign_id}/status")
async def update_campaign_status(
    campaign_id: int,
    payload: CampaignStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = (
        db.query(Campaign)
        .filter(
            Campaign.id == campaign_id,
            Campaign.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    status_value = payload.status.strip().lower()
    if status_value not in ALLOWED_CAMPAIGN_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid campaign status")

    row.status = status_value
    db.commit()
    db.refresh(row)

    return {"id": row.id, "status": row.status}


@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = (
        db.query(Campaign)
        .filter(
            Campaign.id == campaign_id,
            Campaign.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if row.status == "completed":
        raise HTTPException(
            status_code=400, detail="Completed campaigns cannot be paused"
        )

    row.status = "paused"
    db.commit()
    db.refresh(row)

    return {"id": row.id, "status": row.status}


@router.post("/run-due")
async def run_due_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):

    processed, failed, skipped, _ = process_due_campaigns(
        db=db,
        batch_size=100,
        organization_id=current_user.organization_id,
    )

    return {
        "executed_count": processed,
        "failed_count": failed,
        "skipped_count": skipped,
    }


@router.post("/{campaign_id}/run")
async def run_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    campaign = (
        db.query(Campaign)
        .filter(
            Campaign.id == campaign_id,
            Campaign.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    _ensure_campaign_access(db, current_user.organization_id, campaign.campaign_type)

    contact_list = (
        db.query(ContactList)
        .filter(
            ContactList.id == campaign.contact_list_id,
            ContactList.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    contacts = (
        db.query(Contact).filter(Contact.contact_list_id == contact_list.id).all()
    )
    if not contacts:
        raise HTTPException(
            status_code=400, detail="No contacts available in selected list"
        )

    twilio_sms_config = None
    if campaign.campaign_type == "sms":
        twilio_sms_config = _get_active_twilio_sms_config(
            db, current_user.organization_id
        )
        if not twilio_sms_config:
            raise HTTPException(
                status_code=400, detail="Twilio SMS is not configured or inactive"
            )

    thread = Thread(
        target=run_campaign_background,
        args=(campaign.id, current_user.organization_id),
        daemon=True,
    )

    thread.start()

    return {
        "message": "Campaign started successfully",
        "campaign_id": campaign.id,
    }


@router.get("/{campaign_id}/logs")
async def get_campaign_logs(
    campaign_id: int,
    status: Optional[str] = None,
    run_sequence: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limit = max(1, min(limit, 500))

    campaign = (
        db.query(Campaign)
        .filter(
            Campaign.id == campaign_id,
            Campaign.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = db.query(CampaignLog).filter(CampaignLog.campaign_id == campaign_id)

    if status:
        status_value = status.strip().lower()
        if status_value not in ALLOWED_LOG_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid log status filter")
        query = query.filter(CampaignLog.status == status_value)

    if run_sequence is not None:
        if run_sequence <= 0:
            raise HTTPException(
                status_code=400, detail="run_sequence must be greater than 0"
            )
        query = query.filter(CampaignLog.run_sequence == run_sequence)

    total = query.count()
    rows = query.order_by(CampaignLog.created_at.desc()).offset(skip).limit(limit).all()

    contact_ids = [row.contact_id for row in rows]
    contact_map = {}
    if contact_ids:
        contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
        contact_map = {item.id: item for item in contacts}

    return {
        "items": [
            _serialize_campaign_log(row, contact_map.get(row.contact_id))
            for row in rows
        ],
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
        },
    }


def format_phone_number(
    phone_raw: Optional[str], country_code: Optional[str] = None
) -> Optional[str]:
    """
    Format phone number to E.164 format using country code.

    Handles:
    - +91XXXXXXXXXX
    - 91XXXXXXXXXX
    - XXXXXXXXXX (with country)
    - International formats

    Returns:
        Formatted phone (+XXXXXXXXXXXX) or None
    """

    if not phone_raw:
        return None

    phone_raw = str(phone_raw).strip()

    try:
        # If already has + prefix
        if phone_raw.startswith("+"):
            parsed = phonenumbers.parse(phone_raw, None)
        else:
            parsed = phonenumbers.parse(
                phone_raw, country_code.upper() if country_code else None
            )

        # Validate number
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError("Invalid phone number")

        # Format to E.164
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

    except Exception:
        print(
            f"Failed to parse phone number: {phone_raw} with country code: {country_code}"
        )
        raise ValueError(f"Invalid phone number: {phone_raw}")


def process_due_campaigns(
    db,
    batch_size: int,
    organization_id: Optional[int] = None,
    last_id: Optional[int] = None,
) -> Tuple[int, int, int, Optional[int]]:

    processed = 0
    failed = 0
    skipped = 0

    now = datetime.utcnow()

    query = db.query(Campaign).filter(
        Campaign.status == "scheduled",
        Campaign.scheduled_time.isnot(None),
        Campaign.scheduled_time <= now,
    )

    if organization_id is not None:
        query = query.filter(Campaign.organization_id == organization_id)

    # IMPORTANT for batching
    if last_id is not None:
        query = query.filter(Campaign.id > last_id)

    campaigns = query.order_by(Campaign.id.asc()).limit(batch_size).all()

    new_last_id = last_id

    for campaign in campaigns:

        try:
            new_last_id = campaign.id

            # access check
            _ensure_campaign_access(
                db,
                campaign.organization_id,
                campaign.campaign_type,
            )

            thread = Thread(
                target=run_campaign_background,
                args=(campaign.id, campaign.organization_id),
                daemon=True,
            )

            thread.start()
            processed += 1

        except Exception as e:

            failed += 1

            logger.exception(
                f"Campaign execution failed for campaign {campaign.id}: {str(e)}"
            )

            db.rollback()

    return processed, failed, skipped, new_last_id


async def run_daily_due_campaign_daemon(stop_event: asyncio.Event) -> None:
    """Text campaign daemon with non-blocking execution"""

    initial_delay = max(settings.OUTCOME_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = await asyncio.to_thread(
            run_due_campaign_batches,
            batch_size=settings.DUE_CAMPAIGN_DAEMON_INITIAL_DELAY_SECONDS,
            max_batches=settings.DUE_CAMPAIGN_DAEMON_MAX_BATCHES,
        )

        logger.info(
            "Initial due campaign(text) processing completed: %s %s",
            processed,
            failed,
        )

    except Exception as exc:
        logger.error(
            "Initial due campaign(text) processing failed: %s",
            exc,
            exc_info=True,
        )

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_interval(
            settings.DUE_CAMPAIGN_DAEMON_INTERVAL_SECONDS
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = await asyncio.to_thread(
                run_due_campaign_batches,
                batch_size=settings.DUE_CAMPAIGN_DAEMON_BATCH_SIZE,
                max_batches=settings.DUE_CAMPAIGN_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Scheduled due campaign(text) processing completed: %s %s",
                processed,
                failed,
            )

        except Exception as exc:
            logger.error(
                "Scheduled due campaign(text) processing failed: %s",
                exc,
                exc_info=True,
            )


def run_due_campaign_batches(
    batch_size: int,
    max_batches: int,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:

    total_processed = 0
    total_failed = 0
    total_skipped = 0

    db = SessionLocal()

    try:

        last_id = None

        for _ in range(max_batches):

            processed, failed, skipped, last_id = process_due_campaigns(
                db=db,
                batch_size=batch_size,
                organization_id=organization_id,
                last_id=last_id,
            )

            total_processed += processed
            total_failed += failed
            total_skipped += skipped

            # nothing left
            if processed == 0 and failed == 0 and skipped == 0:
                break

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    return total_processed, total_failed


def get_email_send_interval(
    base_interval: int,
    emails_sent: int,
    next_break_after: int,
) -> tuple[int, int]:
    variation = int(base_interval * 0.30)

    delay = random.randint(
        max(1, base_interval - variation),
        base_interval + variation,
    )

    if emails_sent >= next_break_after:
        delay += get_break_duration_seconds()

        # Schedule next break 20-30 emails later
        next_break_after = emails_sent + get_next_break_after()

    return delay, next_break_after


def get_next_break_after() -> int:
    return random.randint(
        settings.EMAIL_CAMPAIGN_BREAK_MIN_EMAILS,
        settings.EMAIL_CAMPAIGN_BREAK_MAX_EMAILS,
    )


def get_break_duration_seconds() -> int:
    return (
        random.randint(
            settings.EMAIL_CAMPAIGN_BREAK_MIN_MINUTES,
            settings.EMAIL_CAMPAIGN_BREAK_MAX_MINUTES,
        )
        * 60
    )
