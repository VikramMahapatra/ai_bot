from datetime import datetime
from io import StringIO
import csv
import json
import uuid
from io import BytesIO
from typing import Any, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header, Query, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
import pandas as pd

from app.auth import require_admin
from app.config import settings
from app.database import get_db
from app.models import User, Campaign, ContactList, Contact, CampaignLog, TwilioSmsChannel
from app.models.products import Product
from app.services.email_service import send_campaign_email
from app.services.campaign_email_ai_service import generate_email_variants_from_prompt, evaluate_email_spam_score
from app.services.twilio_sms_service import render_sms_template, send_twilio_sms


router = APIRouter(prefix="/api/admin/campaigns", tags=["campaigns"])

ALLOWED_CAMPAIGN_TYPES = {"email", "whatsapp", "sms"}
ALLOWED_CAMPAIGN_STATUSES = {"draft", "scheduled", "running", "completed", "paused", "failed"}
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
    message_template: str
    contact_list_id: int
    product_id: Optional[int] = None
    scheduled_time: Optional[datetime] = None
    status: Optional[str] = "draft"
    email_content_mode: Optional[str] = "manual"
    email_subject: Optional[str] = None
    email_prompt_context: Optional[str] = None
    email_subject_variants: Optional[List[str]] = None
    email_body_variants: Optional[List[str]] = None


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

    widget_id = raw[len(AUTO_AGENT_CONTACT_LIST_MARKER_PREFIX):].strip() or None
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
        raise HTTPException(status_code=400, detail="email_content_mode must be manual or prompt")

    default_subject = (payload.email_subject or campaign_name).strip() or campaign_name
    default_body = (message_template or "").strip()
    subjects = _normalize_text_list(payload.email_subject_variants)
    bodies = _normalize_text_list(payload.email_body_variants)

    if mode == "prompt":
        prompt_context = (payload.email_prompt_context or "").strip()
        if not prompt_context:
            raise HTTPException(status_code=400, detail="email_prompt_context is required for prompt mode")

        if len(subjects) < 5 or len(bodies) < 5:
            generated = generate_email_variants_from_prompt(campaign_name=campaign_name, prompt_context=prompt_context)
            subjects = _normalize_text_list(generated.get("subjects"), limit=5)
            bodies = _normalize_text_list(generated.get("bodies"), limit=5)

        if len(subjects) < 5 or len(bodies) < 5:
            raise HTTPException(status_code=500, detail="Unable to generate 5 email subjects and 5 email bodies")

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


def _resolve_email_payload_for_contact(campaign_name: str, template_blob: str, contact_index: int) -> tuple[str, str]:
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

    default_subject = str(parsed.get("default_subject") or fallback_subject).strip() or fallback_subject
    default_body = str(parsed.get("default_body") or "").strip()

    if not default_body:
        default_body = raw_template

    return default_subject, default_body


def _get_active_twilio_sms_config(db: Session, organization_id: int) -> Optional[TwilioSmsChannel]:
    return db.query(TwilioSmsChannel).filter(
        TwilioSmsChannel.organization_id == organization_id,
        TwilioSmsChannel.is_active == True,
    ).first()


def _get_tracking_base_url() -> str:
    return (settings.CAMPAIGN_EMAIL_TRACKING_BASE_URL or "http://localhost:8000").strip().rstrip("/")


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

    if current_key in TERMINAL_TRACKING_STATUSES and next_key not in TERMINAL_TRACKING_STATUSES:
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
    return {
        "id": row.id,
        "campaign_id": row.campaign_id,
        "contact_id": row.contact_id,
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
        return send_campaign_email(
            recipient_email=contact.email or "",
            recipient_name=contact.name or "",
            campaign_name=campaign.campaign_name,
            message_template=body,
            subject=subject,
            tracking_token=tracking_token,
            tracking_base_url=_get_tracking_base_url(),
        )

    if campaign.campaign_type == "whatsapp":
        digits = "".join(ch for ch in (contact.phone or "") if ch.isdigit())
        if len(digits) < 8:
            return False, "Missing or invalid phone", None
        # Placeholder for real WhatsApp API integration.
        return True, None, None

    if campaign.campaign_type == "sms":
        if not twilio_sms_config:
            return False, "Twilio SMS is not configured or inactive", None

        rendered_message = render_sms_template(
            template=campaign.message_template,
            recipient_name=contact.name or "",
            campaign_name=campaign.campaign_name,
        )
        is_sent, error_message = send_twilio_sms(
            config=twilio_sms_config,
            to_number=contact.phone or "",
            message_text=rendered_message,
        )
        return is_sent, error_message, None

    return False, "Unsupported campaign type", None


def _execute_campaign_now(
    db: Session,
    campaign: Campaign,
    contacts: List[Contact],
    twilio_sms_config: Optional[TwilioSmsChannel] = None,
) -> dict:
    campaign.status = "running"
    campaign.number_sent = 0
    campaign.number_failed = 0
    db.commit()

    sent_count = 0
    failed_count = 0

    for contact in contacts:
        for_index = sent_count + failed_count
        tracking_token = uuid.uuid4().hex if campaign.campaign_type == "email" else None

        log = CampaignLog(
            campaign_id=campaign.id,
            contact_id=contact.id,
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

    campaign.number_sent = sent_count
    campaign.number_failed = failed_count
    campaign.status = "completed" if sent_count > 0 else "failed"
    db.commit()
    db.refresh(campaign)

    return {
        "campaign_id": campaign.id,
        "status": campaign.status,
        "number_sent": sent_count,
        "number_failed": failed_count,
        "total_contacts": len(contacts),
    }


@router.get("/public/email-track/open/{tracking_token}.gif")
async def campaign_email_open_pixel(
    tracking_token: str,
    db: Session = Depends(get_db),
):
    log = db.query(CampaignLog).filter(CampaignLog.tracking_token == tracking_token).first()
    if log:
        _apply_tracking_event(log, "opened")
        db.commit()
    return Response(content=TRACKING_PIXEL_GIF, media_type="image/gif", headers={"Cache-Control": "no-cache, no-store"})


@router.get("/public/email-track/click/{tracking_token}")
async def campaign_email_click_redirect(
    tracking_token: str,
    url: str = Query(...),
    db: Session = Depends(get_db),
):
    destination = (url or "").strip()
    if not _is_safe_redirect_url(destination):
        raise HTTPException(status_code=400, detail="Invalid redirect URL")

    log = db.query(CampaignLog).filter(CampaignLog.tracking_token == tracking_token).first()
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
    if configured_secret and (x_campaign_webhook_secret or "").strip() != configured_secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    event = _normalize_tracking_status(payload.event)
    if event not in ALLOWED_LOG_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported event")

    log = None
    if payload.tracking_token:
        log = db.query(CampaignLog).filter(CampaignLog.tracking_token == payload.tracking_token.strip()).first()
    if not log and payload.provider_message_id:
        log = db.query(CampaignLog).filter(CampaignLog.provider_message_id == payload.provider_message_id.strip()).first()

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
    current_user: User = Depends(require_admin),
):
    del current_user
    try:
        data = generate_email_variants_from_prompt(
            campaign_name=(payload.campaign_name or "Campaign").strip() or "Campaign",
            prompt_context=payload.prompt_context,
        )
        return {
            "subjects": data["subjects"],
            "bodies": data["bodies"],
            "combinations": len(data["subjects"]) * len(data["bodies"]),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate email variants: {str(exc)}")


@router.post("/email/spam-score")
async def score_email_variants_for_spam(
    payload: EmailSpamScoreRequest,
    current_user: User = Depends(require_admin),
):
    del current_user
    try:
        data = evaluate_email_spam_score(
            campaign_name=(payload.campaign_name or "Campaign").strip() or "Campaign",
            prompt_context=payload.prompt_context,
            subjects=payload.subjects,
            bodies=payload.bodies,
        )
        return data
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to score spam risk: {str(exc)}")


@router.get("/dashboard/stats")
async def campaign_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    org_id = current_user.organization_id

    totals = db.query(
        func.count(Campaign.id).label("campaign_count"),
        func.coalesce(func.sum(Campaign.number_sent), 0).label("total_sent"),
        func.coalesce(func.sum(Campaign.number_failed), 0).label("total_failed"),
    ).filter(Campaign.organization_id == org_id).first()

    status_rows = db.query(
        Campaign.status,
        func.count(Campaign.id).label("count"),
    ).filter(Campaign.organization_id == org_id).group_by(Campaign.status).all()

    recent_campaigns = db.query(Campaign).filter(
        Campaign.organization_id == org_id
    ).order_by(Campaign.created_at.desc()).limit(5).all()

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


@router.get("/contact-lists")
async def list_contact_lists(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 25,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limit = max(1, min(limit, 200))
    query = db.query(ContactList).filter(ContactList.organization_id == current_user.organization_id)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(ContactList.list_name.ilike(search_term))

    total = query.count()
    rows = query.order_by(ContactList.created_at.desc()).offset(skip).limit(limit).all()

    list_ids = [row.id for row in rows]
    counts = {}
    if list_ids:
        count_rows = db.query(
            Contact.contact_list_id,
            func.count(Contact.id),
        ).filter(Contact.contact_list_id.in_(list_ids)).group_by(Contact.contact_list_id).all()
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
    contact_list = db.query(ContactList).filter(
        ContactList.id == contact_list_id,
        ContactList.organization_id == current_user.organization_id,
    ).first()
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    has_campaigns = db.query(Campaign.id).filter(Campaign.contact_list_id == contact_list.id).first()
    if has_campaigns:
        raise HTTPException(status_code=400, detail="Cannot delete contact list linked to campaigns")

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

    contact_list = db.query(ContactList).filter(
        ContactList.id == contact_list_id,
        ContactList.organization_id == current_user.organization_id,
    ).first()
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    query = db.query(Contact).filter(Contact.contact_list_id == contact_list_id)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            Contact.name.ilike(search_term) |
            Contact.email.ilike(search_term) |
            Contact.phone.ilike(search_term) |
            Contact.company.ilike(search_term)
        )

    total = query.count()
    rows = query.order_by(Contact.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [
            {
                "id": row.id,
                "name": row.name,
                "email": row.email,
                "phone": row.phone,
                "company": row.company,
                "contact_list_id": row.contact_list_id,
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
    contact_list = db.query(ContactList).filter(
        ContactList.id == contact_list_id,
        ContactList.organization_id == current_user.organization_id,
    ).first()
    
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    if not payload.contacts:
        raise HTTPException(status_code=400, detail="contacts array is required")

    created = 0
    errors = []

    for index, item in enumerate(payload.contacts):
        try:
            name, email, phone, company = _validate_contact_payload(item.name, item.email, item.phone, item.company)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contact_list = db.query(ContactList).filter(
        ContactList.id == contact_list_id,
        ContactList.organization_id == current_user.organization_id,
    ).first()
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    filename = (file.filename or "").lower()
    rows_iter = []
    normalized_headers = set()

    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        try:
            dataframe = pd.read_excel(BytesIO(raw))
        except Exception:
            raise HTTPException(status_code=400, detail="Excel file is invalid or unsupported")

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

        normalized_headers = {header.strip().lower() for header in reader.fieldnames if header}
        rows_iter = [
            {str(key or "").strip().lower(): value for key, value in row.items()}
            for row in reader
        ]

    required_headers = {"name", "email", "phone"}
    if not (required_headers & normalized_headers):
        raise HTTPException(status_code=400, detail="File must include at least one of: name, email, phone")

    created = 0
    errors = []
    added_contacts = []

    for index, row in enumerate(rows_iter, start=2):
        try:
            name, email, phone, company = _validate_contact_payload(
                row.get("name"),
                row.get("email"),
                row.get("phone"),
                row.get("company"),
            )

            # 🔍 Check existing contact
            existing = None

            if phone:
                existing = db.query(Contact).filter(
                    Contact.contact_list_id == contact_list.id,
                    Contact.phone == phone
                ).first()

            elif email:
                existing = db.query(Contact).filter(
                    Contact.contact_list_id == contact_list.id,
                    Contact.email == email
                ).first()

            if existing:
                # ✏️ UPDATE
                existing.name = name or existing.name
                existing.email = email or existing.email
                existing.phone = phone or existing.phone
                existing.company = company or existing.company

                added_contacts.append({
                    "id": existing.id,
                    "label": f"{existing.name} ({existing.phone})",
                    "name": existing.name,
                    "email": existing.email,
                    "phone": existing.phone,
                    "company": existing.company,
                })

            else:
                # ➕ CREATE
                new_contact = Contact(
                    contact_list_id=contact_list.id,
                    name=name or None,
                    email=email or None,
                    phone=phone or None,
                    company=company or None,
                )
                db.add(new_contact)
                db.flush()  # get ID without commit

                added_contacts.append({
                    "id": new_contact.id,
                    "label": f"{new_contact.name} ({new_contact.phone})",
                    "name": new_contact.name,
                    "email": new_contact.email,
                    "phone": new_contact.phone,
                    "company": new_contact.company,
                })

        except ValueError as exc:
            errors.append({"row": index, "error": str(exc)})

    db.commit()

    return {
        "created": len(added_contacts),
        "failed": len(errors),
        "errors": errors,
        "contacts": added_contacts
    }


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    contact = db.query(Contact).join(ContactList, ContactList.id == Contact.contact_list_id).filter(
        Contact.id == contact_id,
        ContactList.organization_id == current_user.organization_id,
    ).first()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

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
        raise HTTPException(status_code=400, detail="campaign_type must be email, whatsapp, or sms")

    message_template = payload.message_template.strip()
    if not message_template and campaign_type != "email":
        raise HTTPException(status_code=400, detail="message_template is required")

    status_value = (payload.status or "draft").strip().lower()
    if status_value not in {"draft", "scheduled"}:
        raise HTTPException(status_code=400, detail="status must be draft or scheduled")

    contact_list = db.query(ContactList).filter(
        ContactList.id == payload.contact_list_id,
        ContactList.organization_id == current_user.organization_id,
    ).first()
    if not contact_list:
        raise HTTPException(status_code=404, detail="contact_list_id not found")

    if not payload.product_id:
        raise HTTPException(status_code=400, detail="product_id is required")

    if campaign_type == "email" and not (payload.email_subject or "").strip():
        raise HTTPException(status_code=400, detail="email_subject is required for email campaigns")

    if payload.scheduled_time:
        compare_now = datetime.utcnow()
        if payload.scheduled_time.tzinfo is not None:
            compare_now = datetime.now(payload.scheduled_time.tzinfo)
    else:
        compare_now = None

    if payload.scheduled_time and compare_now and payload.scheduled_time > compare_now and status_value == "draft":
        status_value = "scheduled"

    product_name = None
    if payload.product_id:
        product = db.query(Product).filter(
            Product.id == payload.product_id,
            Product.organization_id == current_user.organization_id,
            Product.is_deleted == False,
        ).first()
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
        message_template=message_template,
        contact_list_id=payload.contact_list_id,
        product_id=payload.product_id,
        scheduled_time=payload.scheduled_time,
        status=status_value,
        number_sent=0,
        number_failed=0,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

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

    query = db.query(Campaign).filter(Campaign.organization_id == current_user.organization_id)

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
            raise HTTPException(status_code=400, detail="Invalid contact_list_id filter")
        query = query.filter(Campaign.contact_list_id == contact_list_id)

    def _parse_iso_datetime(value: Optional[str], field_name: str) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid {field_name}; expected ISO datetime")

    created_from_dt = _parse_iso_datetime(created_from, "created_from")
    created_to_dt = _parse_iso_datetime(created_to, "created_to")
    scheduled_from_dt = _parse_iso_datetime(scheduled_from, "scheduled_from")
    scheduled_to_dt = _parse_iso_datetime(scheduled_to, "scheduled_to")

    if created_from_dt:
        query = query.filter(Campaign.created_at >= created_from_dt)
    if created_to_dt:
        query = query.filter(Campaign.created_at <= created_to_dt)

    if scheduled_from_dt:
        query = query.filter(Campaign.scheduled_time.isnot(None), Campaign.scheduled_time >= scheduled_from_dt)
    if scheduled_to_dt:
        query = query.filter(Campaign.scheduled_time.isnot(None), Campaign.scheduled_time <= scheduled_to_dt)

    total = query.count()
    rows = query.order_by(Campaign.created_at.desc()).offset(skip).limit(limit).all()

    contact_list_ids = [row.contact_list_id for row in rows]
    product_ids = [row.product_id for row in rows if row.product_id]
    contact_list_map = {}
    product_map = {}
    if contact_list_ids:
        contact_lists = db.query(ContactList).filter(ContactList.id.in_(contact_list_ids)).all()
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
    row = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.organization_id == current_user.organization_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    contact_list = db.query(ContactList).filter(ContactList.id == row.contact_list_id).first()
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
    row = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.organization_id == current_user.organization_id,
    ).first()
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
    row = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.organization_id == current_user.organization_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if row.status == "completed":
        raise HTTPException(status_code=400, detail="Completed campaigns cannot be paused")

    row.status = "paused"
    db.commit()
    db.refresh(row)

    return {"id": row.id, "status": row.status}


@router.post("/run-due")
async def run_due_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    now = datetime.utcnow()
    due_campaigns = db.query(Campaign).filter(
        Campaign.organization_id == current_user.organization_id,
        Campaign.status == "scheduled",
        Campaign.scheduled_time.isnot(None),
        Campaign.scheduled_time <= now,
    ).all()

    executed = []
    skipped = []

    for campaign in due_campaigns:
        contact_list = db.query(ContactList).filter(
            ContactList.id == campaign.contact_list_id,
            ContactList.organization_id == current_user.organization_id,
        ).first()

        if not contact_list:
            skipped.append({"campaign_id": campaign.id, "reason": "Contact list not found"})
            continue

        contacts = db.query(Contact).filter(Contact.contact_list_id == contact_list.id).all()
        if not contacts:
            skipped.append({"campaign_id": campaign.id, "reason": "No contacts in selected list"})
            continue

        twilio_sms_config = None
        if campaign.campaign_type == "sms":
            twilio_sms_config = _get_active_twilio_sms_config(db, current_user.organization_id)
            if not twilio_sms_config:
                skipped.append({"campaign_id": campaign.id, "reason": "Twilio SMS is not configured or inactive"})
                continue

        result = _execute_campaign_now(db, campaign, contacts, twilio_sms_config=twilio_sms_config)
        executed.append(result)

    return {
        "due_count": len(due_campaigns),
        "executed_count": len(executed),
        "skipped_count": len(skipped),
        "executed": executed,
        "skipped": skipped,
    }


@router.post("/{campaign_id}/run")
async def run_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.organization_id == current_user.organization_id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    contact_list = db.query(ContactList).filter(
        ContactList.id == campaign.contact_list_id,
        ContactList.organization_id == current_user.organization_id,
    ).first()
    if not contact_list:
        raise HTTPException(status_code=404, detail="Contact list not found")

    contacts = db.query(Contact).filter(Contact.contact_list_id == contact_list.id).all()
    if not contacts:
        raise HTTPException(status_code=400, detail="No contacts available in selected list")

    twilio_sms_config = None
    if campaign.campaign_type == "sms":
        twilio_sms_config = _get_active_twilio_sms_config(db, current_user.organization_id)
        if not twilio_sms_config:
            raise HTTPException(status_code=400, detail="Twilio SMS is not configured or inactive")

    return _execute_campaign_now(db, campaign, contacts, twilio_sms_config=twilio_sms_config)


@router.get("/{campaign_id}/logs")
async def get_campaign_logs(
    campaign_id: int,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limit = max(1, min(limit, 500))

    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.organization_id == current_user.organization_id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = db.query(CampaignLog).filter(CampaignLog.campaign_id == campaign_id)

    if status:
        status_value = status.strip().lower()
        if status_value not in ALLOWED_LOG_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid log status filter")
        query = query.filter(CampaignLog.status == status_value)

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
