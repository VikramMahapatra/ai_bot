import hashlib
import hmac
from typing import Optional

from fastapi import HTTPException
import requests

from app.config import settings
from app.models.message_templates import MessageTemplate
from app.models.campaign import Contact


class WhatsAppSendError(Exception):
    pass


class WhatsAppEmbeddedSignupError(Exception):
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
        raise WhatsAppSendError(
            f"Meta send failed: {response.status_code} {response.text}"
        )
    return response.json()


def send_whatsapp_test_message(
    phone_number_id: str,
    access_token: str,
    to_number: str,
    template: MessageTemplate,
) -> dict:
    url = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template.whatsapp_template_name,
            "language": {"code": template.language or "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": mapping.get("sample", "Test")}
                        for _, mapping in sorted(
                            (template.variable_mappings or {}).items(),
                            key=lambda x: int(x[0]),
                        )
                    ],
                }
            ],
        },
    }

    response = requests.post(url, json=payload, headers=headers, timeout=20)

    print("META STATUS:", response.status_code)
    print("META RESPONSE:", response.text)

    data = response.json()

    if response.status_code >= 400:

        meta_error = data.get("error", {}).get("message") or response.text

        raise HTTPException(
            status_code=response.status_code,
            detail=meta_error,
        )

    return data


def send_whatsapp_template_message(
    phone_number_id: str,
    access_token: str,
    to_number: str,
    template: MessageTemplate,
    contact: Contact,
) -> dict:

    url = f"https://graph.facebook.com/{settings.WHATSAPP_GRAPH_VERSION}/{phone_number_id}/messages"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    variable_mappings = template.variable_mappings or {}

    parameters = []

    for var_index, mapping in sorted(
        variable_mappings.items(), key=lambda x: int(x[0])
    ):
        field_name = mapping.get("field")
        sample_fallback = mapping.get("sample", "Test")

        value = (
            getattr(contact, field_name, "")
            if field_name and getattr(contact, field_name, "") is not None
            else sample_fallback
        )

        parameters.append({"type": "text", "text": str(value)})

    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template.whatsapp_template_name,
            "language": {"code": template.language or "en"},
            "components": [{"type": "body", "parameters": parameters}],
        },
    }

    response = requests.post(url, json=payload, headers=headers, timeout=20)

    print("META STATUS:", response.status_code)
    print("META RESPONSE:", response.text)

    data = response.json()

    if response.status_code >= 400:
        meta_error = data.get("error", {}).get("message") or response.text

        raise HTTPException(
            status_code=response.status_code,
            detail=meta_error,
        )

    return data


def _graph_version() -> str:
    return (settings.WHATSAPP_GRAPH_VERSION or "v25.0").strip()


def _as_data_list(value) -> list:
    if isinstance(value, dict):
        data = value.get("data")
        if isinstance(data, list):
            return data
        return []
    if isinstance(value, list):
        return value
    return []


def _extract_whatsapp_ids_from_me_response(payload: dict) -> dict:
    businesses = _as_data_list(payload.get("businesses"))
    for business in businesses:
        owned_wabas = _as_data_list(business.get("owned_whatsapp_business_accounts"))
        for waba in owned_wabas:
            waba_id = str(waba.get("id") or "").strip() or None
            numbers = _as_data_list(waba.get("phone_numbers"))
            for number in numbers:
                phone_number_id = str(number.get("id") or "").strip() or None
                if phone_number_id:
                    return {
                        "waba_id": waba_id,
                        "phone_number_id": phone_number_id,
                        "business_phone_number": (
                            number.get("display_phone_number") or ""
                        ).strip()
                        or None,
                    }

    return {
        "waba_id": None,
        "phone_number_id": None,
        "business_phone_number": None,
    }


def fetch_phone_number_details(phone_number_id: str, access_token: str):
    version = _graph_version()
    url = f"https://graph.facebook.com/{version}/" f"{phone_number_id}"

    response = requests.get(
        url,
        params={
            "fields": "display_phone_number,verified_name",
            "access_token": access_token,
        },
        timeout=20,
    )

    data = response.json()

    if response.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=data,
        )

    return data


def _fetch_whatsapp_embedded_details(access_token: str) -> dict:
    version = _graph_version()
    me_url = f"https://graph.facebook.com/{version}/me"
    fields = "businesses{id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}}"

    response = requests.get(
        me_url,
        params={
            "fields": fields,
            "access_token": access_token,
        },
        timeout=20,
    )

    if response.status_code >= 400:
        raise WhatsAppEmbeddedSignupError(
            f"Failed to fetch WhatsApp account details: {response.status_code} {response.text}"
        )

    return _extract_whatsapp_ids_from_me_response(response.json() or {})


def generate_long_lived_token(short_token: str) -> dict:

    url = (
        f"https://graph.facebook.com/"
        f"{settings.WHATSAPP_GRAPH_VERSION}/oauth/access_token"
    )

    params = {
        "grant_type": "fb_exchange_token",
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "fb_exchange_token": short_token,
    }

    response = requests.get(
        url,
        params=params,
        timeout=20,
    )

    data = response.json()

    if response.status_code >= 400:

        error = data.get("error", {})

        raise WhatsAppEmbeddedSignupError(
            error.get("message") or "Failed to generate long-lived token"
        )

    return {
        "access_token": data.get("access_token"),
        "token_type": data.get("token_type"),
        "expires_in": data.get("expires_in"),
    }


def exchange_meta_embedded_signup_code(
    code: str, redirect_uri: Optional[str] = None
) -> dict:
    app_id = (settings.META_APP_ID or "").strip()
    app_secret = (settings.META_APP_SECRET or "").strip()
    version = _graph_version()

    if not app_id or not app_secret:
        raise WhatsAppEmbeddedSignupError(
            "META_APP_ID and META_APP_SECRET must be configured"
        )

    if not (code or "").strip():
        raise WhatsAppEmbeddedSignupError(
            "Missing authorization code from Meta embedded signup"
        )

    token_url = f"https://graph.facebook.com/{version}/oauth/access_token"
    params = {
        "client_id": app_id,
        "client_secret": app_secret,
        "code": code.strip(),
    }

    effective_redirect_uri = (
        redirect_uri or settings.META_EMBEDDED_REDIRECT_URI or ""
    ).strip()
    if effective_redirect_uri:
        params["redirect_uri"] = effective_redirect_uri

    token_response = requests.get(token_url, params=params, timeout=20)
    if token_response.status_code >= 400:
        raise WhatsAppEmbeddedSignupError(
            f"Meta code exchange failed: {token_response.status_code} {token_response.text}"
        )

    payload = token_response.json() or {}
    short_lived_token = (payload.get("access_token") or "").strip()

    if not short_lived_token:

        raise WhatsAppEmbeddedSignupError(
            "Meta code exchange succeeded " "but access_token was not returned"
        )

    long_lived = generate_long_lived_token(short_lived_token)

    return {
        "access_token": long_lived.get("access_token"),
        "token_type": long_lived.get("token_type"),
        "expires_in": long_lived.get("expires_in"),
    }
