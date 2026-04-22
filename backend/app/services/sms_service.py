from typing import Optional

from requests import Session

from app.config import settings
from app.services.twilio_sms_service import send_twilio_sms_with_credentials
from app.models.twilio_sms_channel import TwilioSmsChannel


def get_twilio_sms_config(
    db: Session,
    organization_id: int | None = None,
):
    config = db.query(TwilioSmsChannel).filter(
        TwilioSmsChannel.organization_id == organization_id
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


def send_sms(message: str, to_number: str, organization_id: int | None = None) -> tuple[bool, Optional[str]]:
    """Send SMS using bootstrap Twilio configuration from env settings."""
    twilio_config = get_twilio_sms_config(db=None, organization_id=organization_id)
    return send_twilio_sms_with_credentials(
        account_sid=twilio_config["account_sid"],
        auth_token=twilio_config["has_auth_token"],
        from_number=twilio_config["from_phone_number"],
        to_number=to_number,
        message_text=message,
        is_active=True,
    )
    
def send_sms_using_twilio(db:Session, message: str, to_number: str, organization_id: int | None = None) -> tuple[bool, Optional[str]]:
    """Send SMS using bootstrap Twilio configuration from env settings."""
    twilio_config = get_twilio_sms_config(db=db, organization_id=organization_id)
    return send_twilio_sms_with_credentials(
        account_sid=twilio_config["account_sid"],
        auth_token=twilio_config["has_auth_token"],
        from_number=twilio_config["from_phone_number"],
        to_number=to_number,
        message_text=message,
        is_active=True,
    )


def send_bootstrap_test_sms(to_number: str) -> tuple[bool, Optional[str]]:
    message = "Hello from AI Bot SMS service test."
    return send_sms(message=message, to_number=to_number, organization_id=None)
