import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.organization_setting import (
    DailyEmailLimitUpdate,
    OrganizationEmailSettingResponse,
    OrganizationEmailSettingUpdate,
    OrganizationSettingsResponse,
    OrganizationSettingsUpdate,
    LeadAutomationSettingsRequest,
    ZohoConnectRequest,
)
from app.models.organization_settings import OrganizationSettings
from app.auth import get_current_user
from app.models.organization_email_settings import OrganizationEmailSetting
from app.models.organization_zoho_integrations import OrganizationZohoIntegration
from app.services.integration_hub_service import integration_hub_service
from app.models.organization_lead_automations import OrganizationLeadAutomation

router = APIRouter(prefix="/api/organization-settings", tags=["Organization Settings"])

logger = logging.getLogger(__name__)


@router.get("", response_model=OrganizationSettingsResponse)
def get_settings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    settings = (
        db.query(OrganizationSettings)
        .filter(OrganizationSettings.organization_id == current_user.organization_id)
        .first()
    )

    if not settings:
        settings = OrganizationSettings(organization_id=current_user.organization_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put("", response_model=OrganizationSettingsResponse)
def update_settings(
    payload: OrganizationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    settings = (
        db.query(OrganizationSettings)
        .filter(OrganizationSettings.organization_id == current_user.organization_id)
        .first()
    )

    if not settings:
        settings = OrganizationSettings(organization_id=current_user.organization_id)
        db.add(settings)

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)

    return settings


@router.put("/email-settings")
def save_email_setting(
    payload: OrganizationEmailSettingUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    existing = db.query(OrganizationEmailSetting).filter(
        OrganizationEmailSetting.organization_id == current_user.organization_id,
        OrganizationEmailSetting.sender_email == payload.sender_email,
    )

    if payload.id:
        existing = existing.filter(OrganizationEmailSetting.id != payload.id)

    if existing.first():
        raise HTTPException(
            status_code=400,
            detail="Sender email already exists",
        )

    if payload.id:
        email_setting = (
            db.query(OrganizationEmailSetting)
            .filter(
                OrganizationEmailSetting.id == payload.id,
                OrganizationEmailSetting.organization_id
                == current_user.organization_id,
            )
            .first()
        )

        if not email_setting:
            raise HTTPException(
                status_code=404,
                detail="Email setting not found",
            )
    else:
        email_setting = OrganizationEmailSetting(
            organization_id=current_user.organization_id
        )
        db.add(email_setting)

    # Only one default profile
    if payload.is_default:
        (
            db.query(OrganizationEmailSetting)
            .filter(
                OrganizationEmailSetting.organization_id == current_user.organization_id
            )
            .update({"is_default": False})
        )

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(email_setting, key, value)

    db.commit()
    db.refresh(email_setting)

    return email_setting


@router.get(
    "/email-settings",
    response_model=list[OrganizationEmailSettingResponse],
)
def get_email_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(OrganizationEmailSetting)
        .filter(
            OrganizationEmailSetting.organization_id == current_user.organization_id
        )
        .order_by(
            OrganizationEmailSetting.is_default.desc(),
            OrganizationEmailSetting.name.asc(),
        )
        .all()
    )


@router.get(
    "/email-settings/{email_setting_id}",
    response_model=OrganizationEmailSettingResponse,
)
def get_email_setting(
    email_setting_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    email_setting = (
        db.query(OrganizationEmailSetting)
        .filter(
            OrganizationEmailSetting.id == email_setting_id,
            OrganizationEmailSetting.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not email_setting:
        raise HTTPException(
            status_code=404,
            detail="Email setting not found",
        )

    return email_setting


@router.delete("/email-settings/{email_setting_id}")
def delete_email_setting(
    email_setting_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    email_setting = (
        db.query(OrganizationEmailSetting)
        .filter(
            OrganizationEmailSetting.id == email_setting_id,
            OrganizationEmailSetting.organization_id == current_user.organization_id,
        )
        .first()
    )

    if not email_setting:
        raise HTTPException(
            status_code=404,
            detail="Email setting not found",
        )

    db.delete(email_setting)
    db.commit()

    return {"message": "Email setting deleted successfully"}


@router.put("/daily-email-limit")
def update_email_daily_limit(
    payload: DailyEmailLimitUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    organization_id = current_user.organization_id

    settings = (
        db.query(OrganizationSettings)
        .filter(OrganizationSettings.organization_id == organization_id)
        .first()
    )

    if not settings:
        raise HTTPException(
            status_code=404,
            detail="Organization settings not found",
        )

    settings.daily_email_limit = payload.daily_email_limit

    db.commit()
    db.refresh(settings)

    return {
        "success": True,
        "message": "Daily email limit updated successfully",
        "daily_email_limit": settings.daily_email_limit,
    }


@router.get("/lead/automations")
def get_lead_automations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    organization_id = current_user.organization_id

    automation = (
        db.query(OrganizationLeadAutomation)
        .filter(OrganizationLeadAutomation.organization_id == organization_id)
        .first()
    )

    if not automation:
        return {
            "success": True,
            "data": {
                "auto_calling_enabled": False,
                "auto_calling_campaign_id": None,
                "auto_email_enabled": False,
                "auto_email_campaign_id": None,
                "auto_whatsapp_enabled": False,
                "auto_whatsapp_campaign_id": None,
            },
        }

    return {
        "success": True,
        "data": {
            "auto_calling_enabled": automation.auto_calling_enabled,
            "auto_calling_campaign_id": automation.auto_calling_campaign_id,
            "auto_email_enabled": automation.auto_email_enabled,
            "auto_email_campaign_id": automation.auto_email_campaign_id,
            "auto_whatsapp_enabled": automation.auto_whatsapp_enabled,
            "auto_whatsapp_campaign_id": automation.auto_whatsapp_campaign_id,
        },
    }


#### ZOHO CRM INTEGRATION ENDPOINTS ####


@router.get("/zoho/integration")
def get_zoho_integration(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    organization_id = current_user.organization_id

    integration = (
        db.query(OrganizationZohoIntegration)
        .filter(OrganizationZohoIntegration.organization_id == organization_id)
        .first()
    )

    if not integration:
        return {
            "success": True,
            "data": {
                "is_connected": False,
                "is_initialized": False,
                "integration_connection_id": None,
                "email": None,
            },
        }

    return {
        "success": True,
        "data": {
            "is_connected": integration.is_connected,
            "is_initialized": integration.is_initialized,
            "integration_connection_id": integration.integration_connection_id,
            "email": integration.zoho_email,
        },
    }


@router.put("/lead/save-automations")
def save_lead_automation_settings(
    payload: LeadAutomationSettingsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    organization_id = current_user.organization_id

    settings = (
        db.query(OrganizationLeadAutomation)
        .filter(OrganizationLeadAutomation.organization_id == organization_id)
        .first()
    )

    if not settings:
        settings = OrganizationLeadAutomation(
            organization_id=organization_id,
        )

        db.add(settings)

    # Calling
    settings.auto_calling_enabled = payload.auto_calling_enabled

    settings.auto_calling_campaign_id = (
        payload.auto_calling_campaign_id if payload.auto_calling_enabled else None
    )

    # Email
    settings.auto_email_enabled = payload.auto_email_enabled

    settings.auto_email_campaign_id = (
        payload.auto_email_campaign_id if payload.auto_email_enabled else None
    )

    # WhatsApp
    settings.auto_whatsapp_enabled = payload.auto_whatsapp_enabled

    settings.auto_whatsapp_campaign_id = (
        payload.auto_whatsapp_campaign_id if payload.auto_whatsapp_enabled else None
    )

    db.commit()
    db.refresh(settings)

    return {
        "success": True,
        "data": {
            "auto_calling_enabled": settings.auto_calling_enabled,
            "auto_calling_campaign_id": settings.auto_calling_campaign_id,
            "auto_email_enabled": settings.auto_email_enabled,
            "auto_email_campaign_id": settings.auto_email_campaign_id,
            "auto_whatsapp_enabled": settings.auto_whatsapp_enabled,
            "auto_whatsapp_campaign_id": settings.auto_whatsapp_campaign_id,
        },
    }


@router.post("/zoho/connect")
async def connect_zoho(
    payload: ZohoConnectRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    organization_id = current_user.organization_id

    try:
        # 1. Create connection in Integration Hub
        connection = await integration_hub_service.create_connection(
            tenant_id=organization_id,
            provider="zoho_crm",
            name=f"Zoho CRM - Organization {organization_id}",
            config={
                "client_id": payload.client_id,
                "client_secret": payload.client_secret,
                "domain": payload.domain,
                "dc": get_zoho_dc(payload.domain),
            },
        )

        connection_id = connection["id"]

        # 2. Get Zoho OAuth authorization URL
        oauth = await integration_hub_service.get_zoho_authorization_url(
            connection_id=connection_id
        )

        authorization_url = oauth.get("authorize_url")

        if not authorization_url:
            raise HTTPException(
                status_code=500,
                detail="Unable to generate Zoho authorization URL",
            )

        # 3. Save Integration Hub connection ID in AI Bot DB
        integration = (
            db.query(OrganizationZohoIntegration)
            .filter(OrganizationZohoIntegration.organization_id == organization_id)
            .first()
        )

        if not integration:
            integration = OrganizationZohoIntegration(organization_id=organization_id)
            db.add(integration)

        integration.integration_connection_id = connection_id
        integration.is_connected = False

        db.commit()
        db.refresh(integration)

        return {
            "success": True,
            "data": {
                "connection_id": connection_id,
                "authorization_url": authorization_url,
            },
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        # Avoid returning secrets or internal exception details to clients.
        logger.exception("Failed to initiate Zoho CRM connection")
        raise HTTPException(
            status_code=500,
            detail="Failed to initiate Zoho CRM connection",
        )


@router.get("/zoho/status")
async def get_zoho_status(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    organization_id = current_user.organization_id

    integration = (
        db.query(OrganizationZohoIntegration)
        .filter(OrganizationZohoIntegration.organization_id == organization_id)
        .first()
    )

    # ---------------------------------------------------------
    # No Zoho integration record
    # ---------------------------------------------------------

    if not integration:
        return {
            "success": True,
            "data": {
                "is_connected": False,
                "is_initialized": False,
                "integration_connection_id": None,
                "email": None,
                "status": None,
            },
        }

    # ---------------------------------------------------------
    # Integration exists but no Integration Hub connection
    # ---------------------------------------------------------

    if not integration.integration_connection_id:
        return {
            "success": True,
            "data": {
                "is_connected": False,
                "is_initialized": False,
                "integration_connection_id": None,
                "email": integration.zoho_email,
                "status": None,
            },
        }

    try:
        # -----------------------------------------------------
        # Check actual connection status in Integration Hub
        # -----------------------------------------------------

        connection = await integration_hub_service.get_connection(
            integration.integration_connection_id
        )

        is_connected = connection.get("status") == "active"

        # -----------------------------------------------------
        # Keep AI Bot DB synchronized
        #
        # If OAuth connection becomes inactive, initialization
        # should also no longer be considered valid.
        # -----------------------------------------------------

        changed = False

        if integration.is_connected != is_connected:
            integration.is_connected = is_connected
            changed = True

        if not is_connected and integration.is_initialized:
            integration.is_initialized = False
            changed = True

        if changed:
            db.commit()

        return {
            "success": True,
            "data": {
                "is_connected": is_connected,
                "is_initialized": integration.is_initialized,
                "integration_connection_id": (integration.integration_connection_id),
                "email": integration.zoho_email,
                "status": connection.get("status"),
            },
        }

    except Exception as e:
        logger.error(
            "Failed to check Zoho connection: "
            "organization_id=%s connection_id=%s error=%s",
            organization_id,
            integration.integration_connection_id,
            e,
            exc_info=True,
        )

        # -----------------------------------------------------
        # If Integration Hub cannot be reached, preserve the
        # last known state instead of changing it.
        # -----------------------------------------------------

        return {
            "success": True,
            "data": {
                "is_connected": integration.is_connected,
                "is_initialized": integration.is_initialized,
                "integration_connection_id": (integration.integration_connection_id),
                "email": integration.zoho_email,
                "status": None,
            },
        }


@router.delete("/zoho/disconnect")
async def disconnect_zoho(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    organization_id = current_user.organization_id

    integration = (
        db.query(OrganizationZohoIntegration)
        .filter(OrganizationZohoIntegration.organization_id == organization_id)
        .first()
    )

    if not integration:
        return {
            "success": True,
            "message": "Zoho CRM is already disconnected.",
        }

    connection_id = integration.integration_connection_id

    try:
        # Disconnect from Integration Hub
        if connection_id:
            await integration_hub_service.disconnect_connection(connection_id)

        # Update AI Bot DB
        integration.is_connected = False
        integration.is_initialized = False
        integration.integration_connection_id = None
        integration.zoho_email = None

        db.commit()

        return {
            "success": True,
            "message": "Zoho CRM disconnected successfully.",
        }

    except Exception as e:
        db.rollback()

        print(f"Failed to disconnect Zoho for organization " f"{organization_id}: {e}")

        raise HTTPException(
            status_code=500,
            detail="Failed to disconnect Zoho CRM.",
        )


@router.post("/zoho/initialize")
async def initialize_zoho(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logger.info(
        "Initializing Zoho CRM for organization %s", current_user.organization_id
    )

    organization_id = current_user.organization_id

    integration = (
        db.query(OrganizationZohoIntegration)
        .filter(OrganizationZohoIntegration.organization_id == organization_id)
        .first()
    )

    if not integration:
        raise HTTPException(
            status_code=404,
            detail="Zoho integration not found",
        )

    connection_id = integration.integration_connection_id

    if not connection_id:
        raise HTTPException(
            status_code=400,
            detail="Zoho connection not found",
        )

    # ---------------------------------------------------------
    # Already initialized
    # ---------------------------------------------------------

    if integration.is_initialized:
        return {
            "success": True,
            "message": "Zoho CRM is already initialized.",
            "data": {
                "connection_id": connection_id,
                "initialized": True,
            },
        }

    try:
        # -----------------------------------------------------
        # 1. Verify connection
        # -----------------------------------------------------

        await integration_hub_service.test_connection(connection_id)

        # -----------------------------------------------------
        # 2. Get contacts schema
        # -----------------------------------------------------

        schema = await integration_hub_service.get_schema(
            connection_id,
            "contacts",
        )

        # -----------------------------------------------------
        # 3. Enable contacts stream
        # -----------------------------------------------------

        stream_result = await integration_hub_service.configure_stream(
            connection_id=connection_id,
            stream="contacts",
            enabled=True,
            schedule_seconds=300,
        )

        # -----------------------------------------------------
        # 4. Initial sync
        # -----------------------------------------------------

        sync_result = await integration_hub_service.sync_stream(
            connection_id=connection_id,
            stream="contacts",
            full_refresh=True,
        )

        # -----------------------------------------------------
        # 5. Register webhook
        # -----------------------------------------------------

        webhook_result = await integration_hub_service.register_webhook(
            connection_id=connection_id,
            streams=["contacts"],
        )

        # -----------------------------------------------------
        # Everything succeeded
        # -----------------------------------------------------

        integration.is_connected = True
        integration.is_initialized = True

        db.commit()

        return {
            "success": True,
            "message": "Zoho CRM initialized successfully.",
            "data": {
                "connection_id": connection_id,
                "initialized": True,
                "schema": schema,
                "stream": stream_result,
                "sync": sync_result,
                "webhook": webhook_result,
            },
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()

        logger.error(
            "Failed to initialize Zoho CRM: "
            "organization_id=%s connection_id=%s error=%s",
            organization_id,
            connection_id,
            e,
            exc_info=True,
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize Zoho CRM: {str(e)}",
        ) from e


def get_zoho_dc(domain: str) -> str:
    domain_to_dc = {
        "https://www.zohoapis.in": "in",
        "https://www.zohoapis.com": "com",
        "https://www.zohoapis.eu": "eu",
        "https://www.zohoapis.com.au": "au",
        "https://www.zohoapis.jp": "jp",
        "https://www.zohoapis.ca": "ca",
    }

    normalized_domain = domain.rstrip("/").lower()

    if normalized_domain not in domain_to_dc:
        raise HTTPException(
            status_code=400,
            detail="Unsupported Zoho domain",
        )

    return domain_to_dc[normalized_domain]
