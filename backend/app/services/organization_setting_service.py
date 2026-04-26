from fastapi import Depends

from app.models.organization_settings import OrganizationSettings
from app.database import get_db
from sqlalchemy.orm import Session
from app.auth import get_current_user

def get_settings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return get_org_settings(db, current_user.organization_id)

def get_org_smtp_config(org_settings):
    return {
        "host": org_settings.smtp_host,
        "port": org_settings.smtp_port,
        "username": org_settings.smtp_username,
        "password": org_settings.smtp_password,
        "sender": org_settings.smtp_sender_email,
        "use_tls": org_settings.smtp_use_tls,
    }

def get_org_settings(db: Session, organization_id: int) -> OrganizationSettings:
    settings = (
        db.query(OrganizationSettings)
        .filter(OrganizationSettings.organization_id == organization_id)
        .first()
    )

    # Create default settings if not exists
    if not settings and organization_id:
        settings = OrganizationSettings(
            organization_id=organization_id
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings