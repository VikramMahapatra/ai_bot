from typing import Optional

from fastapi import Depends

from app.models.organization_settings import OrganizationSettings
from app.database import get_db
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.models.organization_email_settings import OrganizationEmailSetting


def get_settings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_org_settings(db, current_user.organization_id)


def get_org_smtp_config(org_email_setting: OrganizationEmailSetting):
    return {
        "host": org_email_setting.smtp_host,
        "port": org_email_setting.smtp_port,
        "username": org_email_setting.smtp_username,
        "password": org_email_setting.smtp_password,
        "sender": org_email_setting.sender_email,
        "use_tls": org_email_setting.use_tls,
    }


def get_org_settings(db: Session, organization_id: int) -> OrganizationSettings:
    settings = (
        db.query(OrganizationSettings)
        .filter(OrganizationSettings.organization_id == organization_id)
        .first()
    )

    # Create default settings if not exists
    if not settings and organization_id:
        settings = OrganizationSettings(organization_id=organization_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


def get_org_email_setting(
    db: Session,
    organization_id: int,
) -> Optional[OrganizationEmailSetting]:

    # Try default first
    email_setting = (
        db.query(OrganizationEmailSetting)
        .filter(
            OrganizationEmailSetting.organization_id == organization_id,
            OrganizationEmailSetting.is_active == True,
            OrganizationEmailSetting.is_default == True,
        )
        .first()
    )

    if email_setting:
        return email_setting

    # Fallback to first active configuration
    return (
        db.query(OrganizationEmailSetting)
        .filter(
            OrganizationEmailSetting.organization_id == organization_id,
            OrganizationEmailSetting.is_active == True,
        )
        .order_by(OrganizationEmailSetting.id)
        .first()
    )
