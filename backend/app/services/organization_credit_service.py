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
    
    from sqlalchemy import func, case


def get_credit_summary(
    db: Session,
    organization_id: int,
):

    # -------------------------
    # Feature Summary (Existing)
    # -------------------------

    feature_summary = db.query(
        PriceMatrixItem.module,
        PriceMatrixItem.sub_module,
        PriceMatrixItem.feature_code,
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
        PriceMatrixItem.feature_code,
        OrganizationCreditAllocation.allocated_credits
    ).all()


    # -------------------------
    # Monthly Summary
    # -------------------------

    current_month = func.date_trunc("month", func.now())

    # Allocated (always exists)
    allocated_summary = db.query(
        func.coalesce(
            func.sum(OrganizationCreditAllocation.allocated_credits),
            0
        )
    ).filter(
        OrganizationCreditAllocation.organization_id == organization_id,
        OrganizationCreditAllocation.is_active == True
    ).scalar()


    # Monthly Usage
    usage_summary = db.query(

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

    ).filter(

        OrganizationCreditUsage.organization_id == organization_id,

        func.date_trunc(
            "month",
            OrganizationCreditUsage.created_at
        ) == current_month

    ).first()
    
    price_matrix = db.query(
        PriceMatrixItem.id,
        PriceMatrixItem.category,
        PriceMatrixItem.module,
        PriceMatrixItem.sub_module,
        PriceMatrixItem.feature_code,
        PriceMatrixItem.min_reserved_credits,
        PriceMatrixItem.billing_unit,
        PriceMatrixItem.credits_per_unit,
        PriceMatrixItem.credit_formula,
        PriceMatrixItem.definition,
        PriceMatrixItem.overage_handling,
        PriceMatrixItem.sort_order
    ).filter(
        PriceMatrixItem.is_active == True
    ).order_by(
        PriceMatrixItem.sort_order.asc()
    ).all()

    return {
        "credits": [
            {
                "module": row.module,
                "sub_module": row.sub_module,
                "feature_code": row.feature_code,
                "allocated": row.allocated_credits,
                "reserved": row.reserved,
                "used": row.used,
                "remaining": row.allocated_credits - row.reserved - row.used
            }
            for row in feature_summary
        ],

        "monthly_summary": {
            "month": datetime.utcnow().strftime("%B %Y"),
            "allocated": allocated_summary,
            "reserved": usage_summary.reserved if usage_summary else 0,
            "used": usage_summary.used if usage_summary else 0,
            "remaining": (
                allocated_summary -
                (usage_summary.reserved if usage_summary else 0) -
                (usage_summary.used if usage_summary else 0)
            )
        },
        "price_matrix": [
            {
                "id": row.id,
                "category": row.category,
                "module": row.module,
                "sub_module": row.sub_module,
                "feature_code": row.feature_code,
                "min_reserved_credits": row.min_reserved_credits,
                "billing_unit": row.billing_unit,
                "credits_per_unit": row.credits_per_unit,
                "credit_formula": row.credit_formula,
                "definition": row.definition,
                "overage_handling": row.overage_handling,
                "sort_order": row.sort_order
            }
            for row in price_matrix
        ],
    }
    
def get_required_credits(
    db,
    feature_code: str,
    quantity: float
):
    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.feature_code == feature_code,
        PriceMatrixItem.is_active == True
    ).first()

    if not item:
        raise Exception("Invalid feature")

    return quantity * item.credits_per_unit

def validate_feature_usage(
    db,
    organization_id: int,
    feature_code: str,
    quantity: float
):
    # Resolve PriceMatrixItem
    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.feature_code == feature_code,
        PriceMatrixItem.is_active == True
    ).first()

    if not item:
        return False, "Invalid feature", 0

    # Compute credits required
    credits_required = quantity * item.credits_per_unit

    # Validate credits
    valid, remaining = validate_credits(
        db,
        organization_id,
        feature_code,
        credits_required
    )

    return valid
    
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
    allocated_credits = db.query(
        func.coalesce(
            func.sum(OrganizationCreditAllocation.allocated_credits),
            0
        )
    ).filter(
        OrganizationCreditAllocation.organization_id == organization_id,
        OrganizationCreditAllocation.is_active == True
    ).scalar()


    # Get used credits
    used = db.query(
        func.coalesce(func.sum(OrganizationCreditUsage.credits_used), 0)
    ).filter(
        OrganizationCreditUsage.organization_id == organization_id,
        OrganizationCreditUsage.status == "consumed"
    ).scalar()

    remaining = allocated_credits - used

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
        raise Exception("Insufficient credits. Please add more credits to continue.")

    # 5️⃣ Deduct usage
    usage = OrganizationCreditUsage(
        organization_id=organization_id,
        price_matrix_item_id=item.id,
        used_quantity=quantity,
        credits_used=credits_required,
        reference_type=reference_type,
        reference_id=reference_id,
        status="consumed"        
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
    
    
def release_reserved_credits(
    db,
    reference_type,
    reference_id
):

    usages = db.query(OrganizationCreditUsage).filter(
        OrganizationCreditUsage.reference_type == reference_type,
        OrganizationCreditUsage.reference_id == reference_id,
        OrganizationCreditUsage.status == "reserved"
    ).all()

    if not usages:
        return False

    for usage in usages:
        usage.status = "released"
        usage.used_quantity = 0
        usage.credits_used = 0

    db.commit()

    return True