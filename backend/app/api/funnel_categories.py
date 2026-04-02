from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.auth import require_admin
from app.database import get_db
from app.models import FunnelCategory, Lead, User
from app.schemas.funnel_category import (
    FunnelCategoryCreate,
    FunnelCategoryResponse,
    FunnelCategoryUpdate,
)
from app.services.funnel_category_service import get_funnel_categories


router = APIRouter(prefix="/api/admin/funnel-categories", tags=["funnel-categories"])


def _normalize_stage_key(raw: str) -> str:
    return raw.strip().lower().replace(" ", "_")


@router.get("", response_model=list[FunnelCategoryResponse])
async def list_funnel_categories(
    include_inactive: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    categories = get_funnel_categories(db, current_user.organization_id, include_inactive=include_inactive)
    return categories


@router.post("", response_model=FunnelCategoryResponse)
async def create_funnel_category(
    payload: FunnelCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    stage_key = _normalize_stage_key(payload.key)

    existing = db.query(FunnelCategory).filter(
        FunnelCategory.organization_id == current_user.organization_id,
        FunnelCategory.key == stage_key,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Funnel category key already exists")

    item = FunnelCategory(
        organization_id=current_user.organization_id,
        name=payload.name.strip(),
        key=stage_key,
        color=payload.color.strip(),
        position=payload.position,
        is_active=payload.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{category_id}", response_model=FunnelCategoryResponse)
async def update_funnel_category(
    category_id: int,
    payload: FunnelCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    category = db.query(FunnelCategory).filter(
        FunnelCategory.id == category_id,
        FunnelCategory.organization_id == current_user.organization_id,
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Funnel category not found")

    stage_key = _normalize_stage_key(payload.key)
    duplicate = db.query(FunnelCategory).filter(
        FunnelCategory.organization_id == current_user.organization_id,
        FunnelCategory.key == stage_key,
        FunnelCategory.id != category_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Funnel category key already exists")

    old_key = category.key
    category.name = payload.name.strip()
    category.key = stage_key
    category.color = payload.color.strip()
    category.position = payload.position
    category.is_active = payload.is_active

    if old_key != stage_key:
        db.query(Lead).filter(
            Lead.organization_id == current_user.organization_id,
            Lead.funnel_stage == old_key,
        ).update({"funnel_stage": stage_key}, synchronize_session=False)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
async def delete_funnel_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    category = db.query(FunnelCategory).filter(
        FunnelCategory.id == category_id,
        FunnelCategory.organization_id == current_user.organization_id,
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Funnel category not found")

    lead_count = db.query(Lead).filter(
        Lead.organization_id == current_user.organization_id,
        Lead.funnel_stage == category.key,
    ).count()
    if lead_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category in use by {lead_count} leads. Move those leads first.",
        )

    db.delete(category)
    db.commit()
    return {"message": "Funnel category deleted"}
