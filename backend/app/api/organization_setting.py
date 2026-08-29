from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.organization_setting import (
    DailyEmailLimitUpdate,
    OrganizationEmailSettingResponse,
    OrganizationEmailSettingUpdate,
    OrganizationSettingsResponse,
    OrganizationSettingsUpdate,
)
from app.models.organization_settings import OrganizationSettings
from app.auth import get_current_user
from app.models.organization_email_settings import OrganizationEmailSetting

router = APIRouter(prefix="/api/organization-settings", tags=["Organization Settings"])


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
