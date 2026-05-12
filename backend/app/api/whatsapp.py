from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models import User, WidgetConfig, WhatsAppChannel
from app.services.chat_service import generate_chat_response
from app.services.limits_service import get_effective_limits, increment_usage
from app.services.whatsapp_service import (
    WhatsAppEmbeddedSignupError,
    exchange_meta_embedded_signup_code,
    fetch_phone_number_details,
    send_whatsapp_test_message,
    send_whatsapp_text_message,
    verify_meta_signature,
)
from app.config import settings
from app.models.message_templates import MessageTemplate

router = APIRouter(tags=["whatsapp"])


class WhatsAppConfigUpsertRequest(BaseModel):
    widget_id: str
    phone_number_id: str
    waba_id: Optional[str] = None
    access_token: Optional[str] = None
    verify_token: Optional[str] = None
    business_phone_number: Optional[str] = None
    is_active: bool = True


class WhatsAppTestMessageRequest(BaseModel):
    to_number: str
    template_id: int


class WhatsAppEmbeddedExchangeRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = None
    widget_id: Optional[str] = None
    access_token: Optional[str] = None
    verify_token: Optional[str] = None
    business_phone_number: Optional[str] = None
    is_active: bool = True
    auto_save: bool = False


class WhatsAppGlobalConfigRequest(BaseModel):
    phone_number_id: str
    waba_id: str
    access_token: Optional[str] = None
    verify_token: Optional[str] = None
    business_phone_number: Optional[str] = None
    is_active: bool = True


@router.get("/api/admin/whatsapp/config/{widget_id}")
async def get_whatsapp_config(
    widget_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    config = (
        db.query(WhatsAppChannel)
        .filter(
            WhatsAppChannel.organization_id == current_user.organization_id,
            WhatsAppChannel.widget_id == widget_id,
        )
        .first()
    )

    if not config:
        return {"configured": False}

    configured = bool(config.access_token and config.phone_number_id and config.waba_id)

    return {
        "configured": configured,
        "id": config.id,
        "widget_id": config.widget_id,
        "phone_number_id": config.phone_number_id,
        "waba_id": config.waba_id,
        "business_phone_number": config.business_phone_number,
        "is_active": config.is_active,
    }


@router.get("/api/admin/whatsapp/global-config")
async def get_whatsapp_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):

    config = (
        db.query(WhatsAppChannel)
        .filter(
            WhatsAppChannel.organization_id == current_user.organization_id,
            WhatsAppChannel.widget_id.is_(None),
        )
        .first()
    )

    if not config:
        return {"configured": False}

    configured = bool(config.access_token and config.phone_number_id and config.waba_id)

    return {
        "configured": configured,
        "id": config.id,
        "widget_id": config.widget_id,
        "phone_number_id": config.phone_number_id,
        "waba_id": config.waba_id,
        "business_phone_number": config.business_phone_number,
        "is_active": config.is_active,
    }


@router.put("/api/admin/whatsapp/global-config")
async def upsert_global_whatsapp_config(
    payload: WhatsAppGlobalConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limits = get_effective_limits(db, current_user.organization_id)
    if not limits.get("subscription_active"):
        raise HTTPException(status_code=403, detail="Subscription inactive or expired")
    if not limits.get("whatsapp_enabled"):
        raise HTTPException(
            status_code=403, detail="WhatsApp is not enabled in current plan"
        )

    config = (
        db.query(WhatsAppChannel)
        .filter(
            WhatsAppChannel.organization_id == current_user.organization_id,
            WhatsAppChannel.widget_id.is_(None),
        )
        .first()
    )

    if not config:
        config = WhatsAppChannel(
            organization_id=current_user.organization_id,
            widget_id=None,  # IMPORTANT
            phone_number_id=payload.phone_number_id,
            waba_id=payload.waba_id,
            is_active=payload.is_active,
            verify_token=settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
        )
        db.add(config)
    else:

        if config.access_token:
            phone_details = fetch_phone_number_details(
                payload.phone_number_id,
                config.access_token,
            )

            config.business_phone_number = phone_details.get("display_phone_number")

        config.phone_number_id = payload.phone_number_id
        config.waba_id = payload.waba_id
        config.is_active = payload.is_active

    db.commit()
    db.refresh(config)

    return {
        "message": "WhatsApp configuration saved",
        "id": config.id,
        "widget_id": config.widget_id,
        "phone_number_id": config.phone_number_id,
        "is_active": config.is_active,
    }


@router.put("/api/admin/whatsapp/config")
async def upsert_whatsapp_config(
    payload: WhatsAppConfigUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limits = get_effective_limits(db, current_user.organization_id)
    if not limits.get("subscription_active"):
        raise HTTPException(status_code=403, detail="Subscription inactive or expired")
    if not limits.get("whatsapp_enabled"):
        raise HTTPException(
            status_code=403, detail="WhatsApp is not enabled in current plan"
        )

    widget = (
        db.query(WidgetConfig)
        .filter(
            WidgetConfig.widget_id == payload.widget_id,
            WidgetConfig.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not widget:
        raise HTTPException(
            status_code=404, detail="Widget not found for this organization"
        )

    config = (
        db.query(WhatsAppChannel)
        .filter(
            WhatsAppChannel.organization_id == current_user.organization_id,
            WhatsAppChannel.widget_id == payload.widget_id,
        )
        .first()
    )

    if not config:
        config = WhatsAppChannel(
            organization_id=current_user.organization_id,
            widget_id=payload.widget_id,
            phone_number_id=payload.phone_number_id,
            waba_id=payload.waba_id,
            access_token=payload.access_token,
            verify_token=settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
            business_phone_number=payload.business_phone_number,
            is_active=payload.is_active,
        )
        db.add(config)
    else:
        config.widget_id = payload.widget_id
        config.phone_number_id = payload.phone_number_id
        config.waba_id = payload.waba_id
        config.access_token = payload.access_token
        config.verify_token = settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN
        config.business_phone_number = payload.business_phone_number
        config.is_active = payload.is_active

    db.commit()
    db.refresh(config)

    return {
        "message": "WhatsApp configuration saved",
        "id": config.id,
        "widget_id": config.widget_id,
        "phone_number_id": config.phone_number_id,
        "is_active": config.is_active,
    }


@router.post("/api/admin/whatsapp/test-message")
async def send_test_whatsapp_message(
    payload: WhatsAppTestMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limits = get_effective_limits(db, current_user.organization_id)
    if not limits.get("subscription_active"):
        raise HTTPException(status_code=403, detail="Subscription inactive or expired")
    if not limits.get("whatsapp_enabled"):
        raise HTTPException(
            status_code=403, detail="WhatsApp is not enabled in current plan"
        )

    config = (
        db.query(WhatsAppChannel)
        .filter(
            WhatsAppChannel.organization_id == current_user.organization_id,
            WhatsAppChannel.is_active == True,
        )
        .first()
    )
    if not config:
        raise HTTPException(
            status_code=404, detail="WhatsApp channel is not configured or inactive"
        )

    template = (
        db.query(MessageTemplate)
        .filter(
            MessageTemplate.id == payload.template_id,
            MessageTemplate.organization_id == current_user.organization_id,
            MessageTemplate.type == "whatsapp",
            MessageTemplate.meta_status == "APPROVED",
        )
        .first()
    )

    if not template:
        raise HTTPException(
            status_code=404,
            detail="Approved WhatsApp template not found",
        )

    result = send_whatsapp_test_message(
        phone_number_id=config.phone_number_id,
        access_token=config.access_token,
        to_number=payload.to_number,
        template=template,
    )
    return {"message": "Test message sent", "meta": result}


@router.post("/api/admin/whatsapp/embedded/exchange")
async def exchange_embedded_signup_code(
    payload: WhatsAppEmbeddedExchangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    limits = get_effective_limits(db, current_user.organization_id)
    if not limits.get("subscription_active"):
        raise HTTPException(status_code=403, detail="Subscription inactive or expired")
    if not limits.get("whatsapp_enabled"):
        raise HTTPException(
            status_code=403, detail="WhatsApp is not enabled in current plan"
        )

    try:
        exchange = exchange_meta_embedded_signup_code(
            payload.code, redirect_uri=payload.redirect_uri
        )
    except WhatsAppEmbeddedSignupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    expires_in = exchange.get("expires_in")
    token_created_at = datetime.now(timezone.utc)
    token_expires_at = None
    if expires_in:
        token_expires_at = token_created_at + timedelta(seconds=expires_in)

    access_token = exchange.get("access_token")

    response_payload = {
        "message": "Meta code exchanged successfully",
        "saved": False,
        "access_token": access_token,
        "token_type": exchange.get("token_type"),
        "expires_in": exchange.get("expires_in"),
    }

    if payload.auto_save:
        config_query = db.query(WhatsAppChannel).filter(
            WhatsAppChannel.organization_id == current_user.organization_id
        )

        if payload.widget_id:
            widget = (
                db.query(WidgetConfig)
                .filter(
                    WidgetConfig.widget_id == payload.widget_id,
                    WidgetConfig.organization_id == current_user.organization_id,
                )
                .first()
            )
            if not widget:
                raise HTTPException(
                    status_code=404, detail="Widget not found for this organization"
                )

            config_query = config_query.filter(
                WhatsAppChannel.widget_id == payload.widget_id
            )

        config = config_query.first()

        if not config:
            config = WhatsAppChannel(
                organization_id=current_user.organization_id,
                access_token=access_token,
                widget_id=payload.widget_id,
                is_active=payload.is_active,
                verify_token=settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
                token_type=exchange.get("token_type"),
                token_expires_in=expires_in,
                token_created_at=token_created_at,
                token_expires_at=token_expires_at,
            )
            db.add(config)
        else:

            phone_details = fetch_phone_number_details(
                config.phone_number_id,
                access_token,
            )

            business_phone_number = phone_details.get("display_phone_number")

            config.access_token = access_token
            config.widget_id = payload.widget_id
            config.business_phone_number = business_phone_number
            config.is_active = payload.is_active
            config.token_type = exchange.get("token_type")
            config.token_expires_in = expires_in
            config.token_created_at = token_created_at
            config.token_expires_at = token_expires_at

        db.commit()
        db.refresh(config)

        response_payload.update(
            {
                "saved": True,
                "id": config.id,
                "is_active": config.is_active,
            }
        )

    return response_payload


@router.delete("/api/admin/whatsapp/disconnect")
def disconnect_whatsapp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    channel = (
        db.query(WhatsAppChannel)
        .filter(
            WhatsAppChannel.organization_id == current_user.organization_id,
            WhatsAppChannel.widget_id
            == None,  # Only allow disconnect if not linked to a widget
        )
        .first()
    )

    if not channel:
        return {"success": False, "message": "No WhatsApp channel found"}

    db.delete(channel)
    db.commit()

    return {"success": True, "message": "WhatsApp disconnected"}


@router.get("/api/admin/whatsapp/embedded/callback", response_class=HTMLResponse)
async def embedded_signup_callback(
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    origin: Optional[str] = Query(default=None),
):
    target_origin = settings.PUBLIC_APP_URL
    if origin:
        try:
            parsed = urlparse(origin)
            if parsed.scheme in ("http", "https") and parsed.netloc:
                target_origin = f"{parsed.scheme}://{parsed.netloc}"
        except Exception:
            target_origin = "*"

    safe_code = (code or "").replace("\\", "\\\\").replace('"', '\\"')
    safe_error = (error or "").replace("\\", "\\\\").replace('"', '\\"')

    return f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset=\"utf-8\" />
        <title>Meta WhatsApp Setup</title>
      </head>
      <body style=\"font-family: Arial, sans-serif; padding: 24px;\">
        <h3>Completing WhatsApp setup...</h3>
        <p>You can close this window.</p>
        <script>
          (function () {{
            var payload = {{
              type: 'META_WHATSAPP_EMBEDDED_SIGNUP',
                            source: 'redirect',
              code: \"{safe_code}\" || null,
              error: \"{safe_error}\" || null
            }};
            if (window.opener) {{
              window.opener.postMessage(payload, \"{target_origin}\");
            }}
            window.close();
          }})();
        </script>
      </body>
    </html>
    """


@router.get("/api/channels/whatsapp/webhook", response_class=PlainTextResponse)
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
    db: Session = Depends(get_db),
):
    if hub_mode != "subscribe" or not hub_verify_token:
        raise HTTPException(
            status_code=400, detail="Invalid webhook verification payload"
        )

    is_verified = hub_verify_token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN

    if not is_verified:
        raise HTTPException(status_code=403, detail="Webhook verify token mismatch")

    return hub_challenge or ""


@router.post("/api/channels/whatsapp/webhook")
async def receive_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    if not verify_meta_signature(signature, raw_body):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()
    entries = payload.get("entry", [])

    processed = 0
    ignored = 0

    for entry in entries:
        for change in entry.get("changes", []):
            value = change.get("value", {})
            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id")

            if not phone_number_id:
                ignored += 1
                continue

            channel = (
                db.query(WhatsAppChannel)
                .filter(
                    WhatsAppChannel.phone_number_id == str(phone_number_id),
                    WhatsAppChannel.is_active == True,
                    WhatsAppChannel.widget_id.isnot(None),
                )
                .first()
            )
            if not channel:
                ignored += 1
                continue

            limits = get_effective_limits(db, channel.organization_id)
            if not limits.get("subscription_active") or not limits.get(
                "whatsapp_enabled"
            ):
                ignored += 1
                continue

            widget = (
                db.query(WidgetConfig)
                .filter(
                    WidgetConfig.widget_id == channel.widget_id,
                    WidgetConfig.organization_id == channel.organization_id,
                )
                .first()
            )
            if not widget:
                ignored += 1
                continue

            user = (
                db.query(User)
                .filter(
                    User.id == widget.user_id,
                    User.organization_id == channel.organization_id,
                )
                .first()
            )
            if not user:
                ignored += 1
                continue

            for incoming_message in value.get("messages", []):
                if incoming_message.get("type") != "text":
                    ignored += 1
                    continue

                from_number = incoming_message.get("from")
                text_body = (incoming_message.get("text") or {}).get("body", "").strip()
                if not from_number or not text_body:
                    ignored += 1
                    continue

                session_id = f"wa:{channel.organization_id}:{from_number}"

                response_text, _sources, token_usage = generate_chat_response(
                    text_body,
                    session_id,
                    channel.widget_id,
                    user.id,
                    channel.organization_id,
                    db,
                )

                increment_usage(
                    db,
                    channel.organization_id,
                    conversations_count=2,
                    messages_count=2,
                    tokens_used=token_usage.get("total_tokens", 0),
                )

                send_whatsapp_text_message(
                    phone_number_id=channel.phone_number_id,
                    access_token=channel.access_token,
                    to_number=from_number,
                    message_text=response_text,
                )
                processed += 1

    return {"status": "ok", "processed": processed, "ignored": ignored}
