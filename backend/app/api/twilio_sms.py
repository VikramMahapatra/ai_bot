from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.config import settings
from app.database import get_db
from app.models import TwilioSmsChannel, User
from app.services.twilio_sms_service import (
    normalize_twilio_account_sid,
    normalize_phone_number,
    send_twilio_sms,
    validate_twilio_account_sid,
)


router = APIRouter(tags=["twilio_sms"])


class TwilioSmsConfigUpsertRequest(BaseModel):
    account_sid: str
    auth_token: Optional[str] = None
    from_phone_number: str
    inbound_phone_number: Optional[str] = None
    location_label: Optional[str] = None
    voice_webhook_url: Optional[str] = None
    messaging_webhook_url: Optional[str] = None
    is_active: bool = True


class TwilioSmsTestMessageRequest(BaseModel):
    to_number: str
    message: str


@router.get("/api/admin/sms/twilio/config")
async def get_twilio_sms_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    config = db.query(TwilioSmsChannel).filter(
        TwilioSmsChannel.organization_id == current_user.organization_id
    ).first()

    if not config:
        return {
            "configured": False,
            "account_sid": settings.TWILIO_SMS_DEFAULT_ACCOUNT_SID or None,
            "from_phone_number": settings.TWILIO_SMS_DEFAULT_FROM_NUMBER or None,
            "inbound_phone_number": settings.TWILIO_SMS_DEFAULT_INBOUND_NUMBER or None,
            "location_label": settings.TWILIO_SMS_DEFAULT_LOCATION_LABEL or None,
            "voice_webhook_url": settings.TWILIO_SMS_DEFAULT_VOICE_WEBHOOK_URL or None,
            "messaging_webhook_url": settings.TWILIO_SMS_DEFAULT_MESSAGING_WEBHOOK_URL or None,
            "is_active": True,
            "has_auth_token": bool((settings.TWILIO_SMS_DEFAULT_AUTH_TOKEN or "").strip()),
        }

    return {
        "configured": True,
        "id": config.id,
        "account_sid": config.account_sid,
        "from_phone_number": config.from_phone_number,
        "inbound_phone_number": config.inbound_phone_number,
        "location_label": config.location_label,
        "voice_webhook_url": config.voice_webhook_url,
        "messaging_webhook_url": config.messaging_webhook_url,
        "is_active": config.is_active,
        "has_auth_token": bool((config.auth_token or "").strip()),
    }


@router.put("/api/admin/sms/twilio/config")
async def upsert_twilio_sms_config(
    payload: TwilioSmsConfigUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    account_sid_input = (payload.account_sid or "").strip()
    if not validate_twilio_account_sid(account_sid_input):
        raise HTTPException(status_code=400, detail="Invalid Twilio account SID")
    account_sid = normalize_twilio_account_sid(account_sid_input) or account_sid_input

    from_phone = normalize_phone_number(payload.from_phone_number or "")
    if not from_phone:
        raise HTTPException(status_code=400, detail="Invalid Twilio sender phone number")

    inbound_phone = (payload.inbound_phone_number or "").strip() or None
    location_label = (payload.location_label or "").strip() or None
    voice_webhook_url = (payload.voice_webhook_url or "").strip() or None
    messaging_webhook_url = (payload.messaging_webhook_url or "").strip() or None

    config = db.query(TwilioSmsChannel).filter(
        TwilioSmsChannel.organization_id == current_user.organization_id
    ).first()

    new_auth_token = (payload.auth_token or "").strip()
    if not config and not new_auth_token:
        raise HTTPException(status_code=400, detail="Twilio auth token is required")

    if not config:
        config = TwilioSmsChannel(
            organization_id=current_user.organization_id,
            account_sid=account_sid,
            auth_token=new_auth_token,
            from_phone_number=from_phone,
            inbound_phone_number=inbound_phone,
            location_label=location_label,
            voice_webhook_url=voice_webhook_url,
            messaging_webhook_url=messaging_webhook_url,
            is_active=payload.is_active,
        )
        db.add(config)
    else:
        config.account_sid = account_sid
        if new_auth_token:
            config.auth_token = new_auth_token
        config.from_phone_number = from_phone
        config.inbound_phone_number = inbound_phone
        config.location_label = location_label
        config.voice_webhook_url = voice_webhook_url
        config.messaging_webhook_url = messaging_webhook_url
        config.is_active = payload.is_active

    db.commit()
    db.refresh(config)

    return {
        "message": "Twilio SMS configuration saved",
        "configured": True,
        "id": config.id,
        "account_sid": config.account_sid,
        "from_phone_number": config.from_phone_number,
        "inbound_phone_number": config.inbound_phone_number,
        "location_label": config.location_label,
        "voice_webhook_url": config.voice_webhook_url,
        "messaging_webhook_url": config.messaging_webhook_url,
        "is_active": config.is_active,
        "has_auth_token": bool((config.auth_token or "").strip()),
    }


@router.post("/api/admin/sms/twilio/test-message")
async def send_twilio_sms_test_message(
    payload: TwilioSmsTestMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    config = db.query(TwilioSmsChannel).filter(
        TwilioSmsChannel.organization_id == current_user.organization_id,
        TwilioSmsChannel.is_active == True,
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Twilio SMS configuration not found or inactive")

    message_body = (payload.message or "").strip()
    if not message_body:
        raise HTTPException(status_code=400, detail="Message is required")

    is_sent, error = send_twilio_sms(config, payload.to_number, message_body)
    if not is_sent:
        raise HTTPException(status_code=400, detail=error or "Failed to send Twilio SMS")

    return {"message": "Twilio SMS test message sent"}
