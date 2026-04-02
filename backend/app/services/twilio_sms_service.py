import logging
import re
from typing import Optional

import requests

from app.models.twilio_sms_channel import TwilioSmsChannel

logger = logging.getLogger(__name__)
TWILIO_MESSAGES_URL_TEMPLATE = "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"


def normalize_twilio_account_sid(raw_value: str) -> Optional[str]:
    value = (raw_value or "").strip()
    if not value:
        return None

    # Accept exact SID or an input that contains a valid SID plus extra trailing chars.
    exact = re.fullmatch(r"AC[a-fA-F0-9]{32}", value)
    if exact:
        return value

    match = re.search(r"AC[a-fA-F0-9]{32}", value)
    if match:
        return match.group(0)

    return None


def normalize_phone_number(raw_value: str) -> Optional[str]:
    raw = (raw_value or "").strip()
    if not raw:
        return None

    has_plus = raw.startswith("+")
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None

    if has_plus:
        if 8 <= len(digits) <= 15:
            return f"+{digits}"
        return None

    if len(digits) == 10:
        return f"+1{digits}"

    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"

    if 8 <= len(digits) <= 15:
        return f"+{digits}"

    return None


def render_sms_template(template: str, recipient_name: str, campaign_name: str) -> str:
    safe_name = (recipient_name or "there").strip() or "there"
    first_name = safe_name.split()[0] if safe_name else "there"
    safe_campaign = (campaign_name or "Campaign Update").strip() or "Campaign Update"

    content = template or ""
    replacements = {
        "{{name}}": safe_name,
        "{{first_name}}": first_name,
        "{{campaign_name}}": safe_campaign,
    }
    for key, value in replacements.items():
        content = content.replace(key, value)

    return content.strip()


def send_twilio_sms_with_credentials(
    account_sid: str,
    auth_token: str,
    from_number: str,
    to_number: str,
    message_text: str,
    is_active: bool = True,
) -> tuple[bool, Optional[str]]:
    normalized_sid = normalize_twilio_account_sid(account_sid)
    normalized_from = normalize_phone_number(from_number)
    normalized_to = normalize_phone_number(to_number)
    token = (auth_token or "").strip()
    body = (message_text or "").strip()

    if not is_active:
        return False, "Twilio SMS channel is inactive"
    if not normalized_sid:
        return False, "Twilio account SID is missing or invalid"
    if not token:
        return False, "Twilio auth token is missing"
    if not normalized_from:
        return False, "Twilio sender number is invalid"
    if not normalized_to:
        return False, "Recipient phone number is missing or invalid"
    if not body:
        return False, "SMS message body is empty"

    url = TWILIO_MESSAGES_URL_TEMPLATE.format(account_sid=normalized_sid)
    try:
        response = requests.post(
            url,
            auth=(normalized_sid, token),
            data={"To": normalized_to, "From": normalized_from, "Body": body},
            timeout=20,
        )

        if response.status_code in (200, 201):
            return True, None

        detail = ""
        try:
            payload = response.json()
            detail = str(payload.get("message") or payload.get("detail") or "")
        except Exception:
            detail = ""

        fallback_error = f"Twilio API error ({response.status_code})"
        return False, f"{fallback_error}: {detail}" if detail else fallback_error
    except requests.RequestException as exc:
        logger.error("Twilio SMS send failed: %s", str(exc), exc_info=True)
        return False, str(exc)


def send_twilio_sms(config: TwilioSmsChannel, to_number: str, message_text: str) -> tuple[bool, Optional[str]]:
    return send_twilio_sms_with_credentials(
        account_sid=config.account_sid,
        auth_token=config.auth_token,
        from_number=config.from_phone_number,
        to_number=to_number,
        message_text=message_text,
        is_active=bool(config.is_active),
    )


def validate_twilio_account_sid(account_sid: str) -> bool:
    return normalize_twilio_account_sid(account_sid) is not None
