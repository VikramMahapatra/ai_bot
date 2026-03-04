import hashlib
import hmac
from typing import Optional

import requests

from app.config import settings


class WhatsAppSendError(Exception):
    pass


def verify_meta_signature(signature_header: Optional[str], body: bytes) -> bool:
    """Verify Meta webhook signature when META_APP_SECRET is configured.

    If app secret is not configured, returns True.
    """
    app_secret = (settings.META_APP_SECRET or "").strip()
    if not app_secret:
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    sent_signature = signature_header.split("=", 1)[1]
    expected = hmac.new(
        app_secret.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(sent_signature, expected)


def send_whatsapp_text_message(
    phone_number_id: str,
    access_token: str,
    to_number: str,
    message_text: str,
) -> dict:
    url = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": message_text[:4096]},
    }

    response = requests.post(url, json=payload, headers=headers, timeout=20)
    if response.status_code >= 400:
        raise WhatsAppSendError(f"Meta send failed: {response.status_code} {response.text}")
    return response.json()
