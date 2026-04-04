from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.organization_setting import (
    OrganizationSettingsResponse,
    OrganizationSettingsUpdate
)
from app.models.organization_settings import OrganizationSettings
from app.auth import get_current_user

router = APIRouter(prefix="/api/organization-settings", tags=["Organization Settings"])


@router.get("", response_model=OrganizationSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    settings = db.query(OrganizationSettings).filter(
        OrganizationSettings.organization_id == current_user.organization_id
    ).first()

    if not settings:
        settings = OrganizationSettings(
            organization_id=current_user.organization_id
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put("", response_model=OrganizationSettingsResponse)
def update_settings(
    payload: OrganizationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    settings = db.query(OrganizationSettings).filter(
        OrganizationSettings.organization_id == current_user.organization_id
    ).first()

    if not settings:
        settings = OrganizationSettings(
            organization_id=current_user.organization_id
        )
        db.add(settings)

    for key, value in payload.dict().items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)

    return settings