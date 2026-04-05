from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from requests import Session
from sqlalchemy import func
from app.models.organization_credit_allocation import OrganizationCreditAllocation
from app.models.organization_credit_profile import OrganizationCreditProfile
from app.models.organization_credit_usages import OrganizationCreditUsage
from app.models.price_matrix_item import PriceMatrixItem


   
def get_price_item(
    db,
    category,
    module,
    sub_module=None
):
    return db.query(PriceMatrixItem).filter(
        PriceMatrixItem.category == category,
        PriceMatrixItem.module == module,
        PriceMatrixItem.sub_module == sub_module,
        PriceMatrixItem.is_active == True
    ).first()
    
    
def validate_credits(
    db,
    organization_id: int,
    price_matrix_item_id: int,
    required_credits: float
):

    # 1. Check Credit Profile Expiry
    profile = db.query(OrganizationCreditProfile).filter(
        OrganizationCreditProfile.organization_id == organization_id
    ).first()

    if not profile:
        return False, "No credit profile found"

    if profile.end_date and profile.end_date < datetime.now(timezone.utc):
        return False, "Credits expired"


    # 2. Get Allocation
    allocation = db.query(OrganizationCreditAllocation).filter(
        OrganizationCreditAllocation.organization_id == organization_id,
        OrganizationCreditAllocation.price_matrix_item_id == price_matrix_item_id,
        OrganizationCreditAllocation.is_active == True
    ).first()

    if not allocation:
        return False, "No credit allocation found"


    # 3. Get Used Credits
    used = db.query(
        func.coalesce(func.sum(OrganizationCreditUsage.credits_used), 0)
    ).filter(
        OrganizationCreditUsage.organization_id == organization_id,
        OrganizationCreditUsage.price_matrix_item_id == price_matrix_item_id
    ).scalar()


    remaining = allocation.allocated_credits - used


    # 4. Validate Remaining Credits
    if remaining < required_credits:
        return False, "Insufficient credits"

    return True, remaining


def deduct_credits(
    db,
    organization_id,
    price_matrix_item_id,
    quantity,
    reference_type=None,
    reference_id=None
):
    
    allocation = db.query(OrganizationCreditAllocation).filter(
        OrganizationCreditAllocation.organization_id == organization_id,
        OrganizationCreditAllocation.price_matrix_item_id == price_matrix_item_id
    ).first()

    credits_required = quantity * allocation.credits_per_unit

    valid, _ = validate_credits(
        db,
        organization_id,
        price_matrix_item_id,
        credits_required
    )

    if not valid:
        raise Exception("Insufficient credits")

    usage = OrganizationCreditUsage(
        organization_id=organization_id,
        price_matrix_item_id=price_matrix_item_id,
        used_quantity=quantity,
        credits_used=credits_required,
        reference_type=reference_type,
        reference_id=reference_id
    )

    db.add(usage)
    db.commit()

    return True


def get_credit_summary(
    db: Session,
    organization_id: int,
):
    data = db.query(
        PriceMatrixItem.module,
        PriceMatrixItem.sub_module,
        OrganizationCreditAllocation.allocated_credits,
        func.coalesce(func.sum(OrganizationCreditUsage.credits_used), 0).label("used")
    ).join(
        OrganizationCreditAllocation,
        OrganizationCreditAllocation.price_matrix_item_id == PriceMatrixItem.id
    ).outerjoin(
        OrganizationCreditUsage,
        OrganizationCreditUsage.price_matrix_item_id == PriceMatrixItem.id
    ).filter(
        OrganizationCreditAllocation.organization_id == organization_id,
        OrganizationCreditAllocation.is_active == True
    ).group_by(
        PriceMatrixItem.module,
        PriceMatrixItem.sub_module,
        OrganizationCreditAllocation.allocated_credits
    ).all()


    return [
        {
            "module": row.module,
            "sub_module": row.sub_module,
            "allocated": row.allocated_credits,
            "used": row.used,
            "remaining": row.allocated_credits - row.used
        }
        for row in data
    ]