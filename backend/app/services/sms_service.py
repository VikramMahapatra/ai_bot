from typing import Optional

from app.config import settings
from app.services.twilio_sms_service import send_twilio_sms_with_credentials


def send_sms(message: str, to_number: str) -> tuple[bool, Optional[str]]:
    """Send SMS using bootstrap Twilio configuration from env settings."""
    return send_twilio_sms_with_credentials(
        account_sid=settings.TWILIO_SMS_DEFAULT_ACCOUNT_SID,
        auth_token=settings.TWILIO_SMS_DEFAULT_AUTH_TOKEN,
        from_number=settings.TWILIO_SMS_DEFAULT_FROM_NUMBER,
        to_number=to_number,
        message_text=message,
        is_active=True,
    )


def send_bootstrap_test_sms(to_number: str) -> tuple[bool, Optional[str]]:
    message = "Hello from AI Bot SMS service test."
    return send_sms(message=message, to_number=to_number)
