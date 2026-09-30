from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.services.qualification_engine_service import (
    QualificationEngineService,
)
from app.database import get_db
from app.auth import require_admin, require_superadmin
from app.models.user import Organization, User
from app.models.super_admin import SuperAdmin

router = APIRouter(
    prefix="/api/superadmin/qualification-engine",
    tags=["Qualification Engine"],
)

service = QualificationEngineService()


@router.get("/{organization_id:int}/status")
def get_qualification_engine_status(
    organization_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    data = service.get_status(
        db=db,
        organization_id=organization_id,
    )

    if not data:
        return {
            "enabled": False,
            "connected": False,
        }

    return {
        "enabled": data["enabled"],
        "connected": True,
        "tenant_id": data["tenant_id"],
        "created_at": data["created_at"],
        "updated_at": data["updated_at"],
    }


@router.post("/{organization_id:int}/connect")
async def connect_qualification_engine(
    organization_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    organization = (
        db.query(Organization).filter(Organization.id == organization_id).first()
    )

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found.",
        )

    return await service.connect(
        db=db,
        organization_id=organization.id,
        organization_name=organization.name,
    )


@router.get("/{organization_id:int}/test")
async def test_qualification_engine(
    organization_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return await service.test_connection(
        db=db,
        organization_id=organization_id,
    )


@router.post("/{organization_id:int}/disconnect")
def disconnect_qualification_engine(
    organization_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.disconnect(
        db=db,
        organization_id=organization_id,
    )
