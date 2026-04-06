from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from requests import Session
from sqlalchemy import case, func
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
    
    
def get_credit_summary(
    db: Session,
    organization_id: int,
):

    data = db.query(
        PriceMatrixItem.module,
        PriceMatrixItem.sub_module,
        OrganizationCreditAllocation.allocated_credits,

        func.coalesce(
            func.sum(
                case(
                    (OrganizationCreditUsage.status == "reserved",
                     OrganizationCreditUsage.credits_used),
                    else_=0
                )
            ),
            0
        ).label("reserved"),

        func.coalesce(
            func.sum(
                case(
                    (OrganizationCreditUsage.status == "consumed",
                     OrganizationCreditUsage.credits_used),
                    else_=0
                )
            ),
            0
        ).label("used")

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
            "reserved": row.reserved,
            "used": row.used,
            "remaining": row.allocated_credits - row.reserved - row.used
        }
        for row in data
    ]
    
def validate_credits(
    db,
    organization_id: int,
    feature_code: str,
    required_credits: float
):
    # Check credit profile
    profile = db.query(OrganizationCreditProfile).filter(
        OrganizationCreditProfile.organization_id == organization_id
    ).first()

    if not profile:
        return False, "No credit profile found"

    if profile.end_date and profile.end_date < datetime.now(timezone.utc):
        return False, "Credits expired"

    # Resolve PriceMatrixItem
    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.feature_code == feature_code,
        PriceMatrixItem.is_active == True
    ).first()

    if not item:
        return False, "Invalid feature"

    # Get allocation
    allocation = db.query(OrganizationCreditAllocation).filter(
        OrganizationCreditAllocation.organization_id == organization_id,
        OrganizationCreditAllocation.is_active == True
    ).first()

    if not allocation:
        return False, "No credit allocation found"

    # Get used credits
    used = db.query(
        func.coalesce(func.sum(OrganizationCreditUsage.credits_used), 0)
    ).filter(
        OrganizationCreditUsage.organization_id == organization_id,
        OrganizationCreditUsage.status == "consumed"
    ).scalar()

    remaining = allocation.allocated_credits - used

    # Validate remaining
    if remaining < required_credits:
        return False, "Insufficient credits"

    return True, remaining

def deduct_credits(
    db,
    organization_id: int,
    feature_code: str,
    quantity: float,
    reference_type: str | None = None,
    reference_id: int | None = None
):
  
    # 1️⃣ Resolve PriceMatrixItem
    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.feature_code == feature_code,
        PriceMatrixItem.is_active == True
    ).first()

    if not item:
        raise Exception("Invalid module/sub_module")

    # 2️⃣ Get allocation
    allocation = db.query(OrganizationCreditAllocation).filter(
        OrganizationCreditAllocation.organization_id == organization_id,
        OrganizationCreditAllocation.price_matrix_item_id == item.id,
        OrganizationCreditAllocation.is_active == True
    ).first()

    if not allocation:
        raise Exception("No credit allocation found")

    # 3️⃣ Compute credits required
    credits_required = quantity * item.credits_per_unit

    # 4️⃣ Validate remaining credits
    valid, remaining = validate_credits(
        db,
        organization_id,
        feature_code,
        credits_required
    )

    if not valid:
        raise Exception("Insufficient credits")

    # 5️⃣ Deduct usage
    usage = OrganizationCreditUsage(
        organization_id=organization_id,
        price_matrix_item_id=item.id,
        used_quantity=quantity,
        credits_used=credits_required,
        reference_type=reference_type,
        reference_id=reference_id
    )

    db.add(usage)
    db.commit()

    return True
    
def reserve_credits(
    db,
    organization_id,
    feature_code,
    quantity,
    reference_type=None,
    reference_id=None
):

    # Resolve item
    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.feature_code == feature_code,
        PriceMatrixItem.is_active == True
    ).first()

    credits_required = quantity * item.credits_per_unit

    valid, _ = validate_credits(
        db,
        organization_id,
        feature_code,
        credits_required
    )

    if not valid:
        raise Exception("Insufficient credits")

    usage = OrganizationCreditUsage(
        organization_id=organization_id,
        price_matrix_item_id=item.id,
        used_quantity=quantity,
        credits_used=credits_required,
        status="reserved",
        reference_type=reference_type,
        reference_id=reference_id
    )

    db.add(usage)
    db.commit()

    return usage.id

def consume_reserved_credits(
    db,
    reference_type,
    reference_id,
    actual_quantity
):

    usage = db.query(OrganizationCreditUsage).filter(
        OrganizationCreditUsage.reference_type == reference_type,
        OrganizationCreditUsage.reference_id == reference_id,
        OrganizationCreditUsage.status == "reserved"
    ).first()

    if not usage:
        raise Exception("Reserved credits not found")

    # adjust actual usage
    usage.used_quantity = actual_quantity

    # recompute credits
    allocation = db.query(OrganizationCreditAllocation).filter(
        OrganizationCreditAllocation.price_matrix_item_id == usage.price_matrix_item_id
    ).first()

    usage.credits_used = actual_quantity * allocation.credits_per_unit
    usage.status = "consumed"

    db.commit()