from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func, insert, or_, select, text
from app.models.funnel_category import FunnelCategory, FunnelCategoryMaster


DEFAULT_FUNNEL_CATEGORIES = [
    {"name": "Lead Qualification", "key": "lead_qualification", "color": "#3f8bd7", "position": 1},
    {"name": "Initial Contact", "key": "initial_contact", "color": "#5199e0", "position": 2},
    {"name": "Needs Analysis", "key": "needs_analysis", "color": "#63a7e8", "position": 3},
    {"name": "Proposal Quote", "key": "proposal_quote", "color": "#74b4ef", "position": 4},
    {"name": "Negotiation", "key": "negotiation", "color": "#86c2f4", "position": 5},
    {"name": "Closed Won", "key": "closed_won", "color": "#3aa76d", "position": 6},
    {"name": "Closed Lost", "key": "closed_lost", "color": "#cc6d6d", "position": 7},
]

def _seed_funnel_categories_for_org(db, org_id: int):
    stmt = insert(FunnelCategory).from_select(
        [
            "organization_id",
            "name",
            "key",
            "color",
            "position",
            "is_active",
            "created_at",
            "updated_at",
        ],
        select(
            org_id,
            FunnelCategoryMaster.name,
            FunnelCategoryMaster.key,
            FunnelCategoryMaster.color,
            FunnelCategoryMaster.position,
            FunnelCategoryMaster.is_active,
            func.now(),
            func.now(),
        ).where(FunnelCategoryMaster.is_active == True)
    )

    db.execute(stmt)
    db.commit()

def ensure_default_funnel_categories(db: Session, organization_id: int) -> None:
    existing = db.query(FunnelCategory).filter(FunnelCategory.organization_id == organization_id).count()
    if existing > 0:
        return

    _seed_funnel_categories_for_org(db, organization_id)


def get_funnel_categories(db: Session, organization_id: int, include_inactive: bool = False) -> List[FunnelCategory]:
    ensure_default_funnel_categories(db, organization_id)
    query = db.query(FunnelCategory).filter(FunnelCategory.organization_id == organization_id)
    if not include_inactive:
        query = query.filter(FunnelCategory.is_active == True)
    return query.order_by(FunnelCategory.position.asc(), FunnelCategory.id.asc()).all()


def is_valid_funnel_stage(db: Session, organization_id: int, stage_key: str) -> bool:
    if not stage_key:
        return False
    categories = get_funnel_categories(db, organization_id, include_inactive=True)
    valid_keys = {category.key for category in categories}
    return stage_key in valid_keys
