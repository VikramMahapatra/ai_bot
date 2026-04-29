from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from requests import Session
from sqlalchemy import and_, case, func
from app.models.organization_credit_allocation import OrganizationCreditAllocation
from app.models.organization_credit_profile import OrganizationCreditProfile
from app.models.organization_credit_usages import OrganizationCreditUsage
from app.models.price_matrix_item import PriceMatrixItem
from app.models.org_credit_balance import OrgCreditBalance

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

    billing_period = datetime.now(timezone.utc).strftime("%Y-%m")

    # -------------------------
    # Get Balance (Monthly)
    # -------------------------

    balance = db.query(OrgCreditBalance).filter(
        OrgCreditBalance.organization_id == organization_id,
        OrgCreditBalance.billing_period == billing_period
    ).first()

    total_allocated = balance.total_credit if balance else 0
    total_used = balance.used_credit if balance else 0
    total_remaining = balance.remaining_credit if balance else 0


    # -------------------------
    # Reserved (From Usage Table)
    # -------------------------

    current_month = func.date_trunc("month", func.now())

    reserved = db.query(
        func.coalesce(
            func.sum(OrganizationCreditUsage.credits_used),
            0
        )
    ).filter(
        OrganizationCreditUsage.organization_id == organization_id,
        OrganizationCreditUsage.status == "reserved",
        func.date_trunc(
            "month",
            OrganizationCreditUsage.created_at
        ) == current_month
    ).scalar()


    # -------------------------
    # Feature Summary
    # -------------------------

    feature_summary = db.query(
        PriceMatrixItem.module,
        PriceMatrixItem.sub_module,
        PriceMatrixItem.feature_code,
        
        func.coalesce(
            func.sum(
                case(
                    (
                        OrganizationCreditUsage.status == "consumed",
                        1
                    ),
                    else_=0
                )
            ),
            0
        ).label("items_used"),

        # -------------------------
        # Reserved
        # -------------------------
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

        # -------------------------
        # Consumed (positive only)
        # -------------------------
        func.coalesce(
            func.sum(
                case(
                    (OrganizationCreditUsage.status == "consumed",
                    OrganizationCreditUsage.credits_used),
                    else_=0
                )
            ),
            0
        ).label("consumed"),

        # -------------------------
        # Refunded (convert to positive for UI)
        # -------------------------
        func.coalesce(
            func.sum(
                case(
                    (OrganizationCreditUsage.status == "refunded",
                    -OrganizationCreditUsage.credits_used),  
                    else_=0
                )
            ),
            0
        ).label("refunded"),

        # -------------------------
        # Net Used (ledger sum)
        # -------------------------
        func.coalesce(
            func.sum(
                case(
                    (OrganizationCreditUsage.status != "reserved",
                    OrganizationCreditUsage.credits_used),
                    else_=0
                )
            ),
            0
        ).label("used")

    ).outerjoin(
        OrganizationCreditUsage,
        and_(
            OrganizationCreditUsage.price_matrix_item_id == PriceMatrixItem.id,
            OrganizationCreditUsage.organization_id == organization_id  # ✅ move filter here
        )
    ).group_by(
        PriceMatrixItem.module,
        PriceMatrixItem.sub_module,
        PriceMatrixItem.feature_code
    ).all()


    # -------------------------
    # Price Matrix
    # -------------------------

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
                "reserved": row.reserved,
                "consumed": row.consumed,
                "refunded": row.refunded,
                "used": row.used,
                "items_used": row.items_used
            }
            for row in feature_summary
        ],
        "monthly_summary": {
            "month": datetime.utcnow().strftime("%B %Y"),
            "allocated": total_allocated,
            "reserved": reserved,
            "used": total_used,
            "remaining": total_remaining
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
    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.feature_code == feature_code,
        PriceMatrixItem.is_active == True
    ).first()

    if not item:
        return False, "Invalid feature"

    # Get current billing period
    billing_period = datetime.now(timezone.utc).strftime("%Y-%m")

    # Fetch balance
    balance = db.query(OrgCreditBalance).filter(
        OrgCreditBalance.organization_id == organization_id,
        OrgCreditBalance.billing_period == billing_period
    ).first()

    if not balance:
        return False, "No credit balance found"

    # Validate remaining credits
    if balance.remaining_credit < required_credits:
        return False, "Insufficient credits"

    return True, balance.remaining_credit

def deduct_credits(
    db,
    organization_id: int,
    feature_code: str,
    quantity: float,
    reference_type: str | None = None,
    reference_id: str | None = None
):

    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.feature_code == feature_code,
        PriceMatrixItem.is_active == True
    ).first()

    if not item:
        raise Exception("Invalid feature")

    credits_required = quantity * item.credits_per_unit

    valid, remaining = validate_credits(
        db,
        organization_id,
        feature_code,
        credits_required
    )

    if not valid:
        raise Exception("Insufficient credits. Please add more credits to continue.")

    usage = OrganizationCreditUsage(
        organization_id=organization_id,
        price_matrix_item_id=item.id,
        used_quantity=quantity,
        credits_used=credits_required,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else None,
        status="consumed"
    )

    db.add(usage)

    billing_period = datetime.now(timezone.utc).strftime("%Y-%m")

    balance = db.query(OrgCreditBalance).filter(
        OrgCreditBalance.organization_id == organization_id,
        OrgCreditBalance.billing_period == billing_period
    ).with_for_update().first()   # prevents race conditions

    if not balance:
        raise Exception("Credit balance not found")

    balance.used_credit += credits_required
    balance.remaining_credit = balance.total_credit - balance.used_credit

    db.flush()
    return True

def refund_credits(
    db,
    organization_id: int,
    feature_code: str,
    quantity: float,
    reference_type: str | None = None,
    reference_id: str | None = None
):
    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.feature_code == feature_code,
        PriceMatrixItem.is_active == True
    ).first()

    if not item:
        raise Exception("Invalid feature")

    credits_to_refund = quantity * item.credits_per_unit

    # -------------------------
    # Prevent over-refund
    # -------------------------
    consumed = db.query(
        func.coalesce(func.sum(OrganizationCreditUsage.credits_used), 0)
    ).filter(
        OrganizationCreditUsage.organization_id == organization_id,
        OrganizationCreditUsage.price_matrix_item_id == item.id,
        OrganizationCreditUsage.reference_id == str(reference_id),
        OrganizationCreditUsage.status == "consumed"
    ).scalar()

    refunded = db.query(
        func.coalesce(func.sum(OrganizationCreditUsage.credits_used), 0)
    ).filter(
        OrganizationCreditUsage.organization_id == organization_id,
        OrganizationCreditUsage.price_matrix_item_id == item.id,
        OrganizationCreditUsage.reference_id == str(reference_id),
        OrganizationCreditUsage.status == "refunded"
    ).scalar()

    # refunded will be negative if you follow ledger style
    net_consumed = consumed + refunded

    if credits_to_refund > net_consumed:
        raise Exception("Refund exceeds consumed credits")

    # -------------------------
    # Create refund entry (ledger style)
    # -------------------------
    usage = OrganizationCreditUsage(
        organization_id=organization_id,
        price_matrix_item_id=item.id,
        used_quantity=quantity,
        credits_used=-credits_to_refund,  
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else None,
        status="refunded"
    )

    db.add(usage)

    # -------------------------
    # Update balance
    # -------------------------
    billing_period = datetime.now(timezone.utc).strftime("%Y-%m")

    balance = db.query(OrgCreditBalance).filter(
        OrgCreditBalance.organization_id == organization_id,
        OrgCreditBalance.billing_period == billing_period
    ).with_for_update().first()

    if not balance:
        raise Exception("Credit balance not found")

    balance.used_credit -= credits_to_refund
    balance.remaining_credit = balance.total_credit - balance.used_credit

    db.flush()
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
        reference_id=str(reference_id) if reference_id else None
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
        OrganizationCreditUsage.reference_id == str(reference_id) if reference_id else None,
        OrganizationCreditUsage.status == "reserved"
    ).first()

    if not usage:
        raise Exception("Reserved credits not found")

    # adjust actual usage
    usage.used_quantity = actual_quantity

    # get price item
    item = db.query(PriceMatrixItem).filter(
        PriceMatrixItem.id == usage.price_matrix_item_id
    ).first()

    # recompute credits
    credits_required = actual_quantity * item.credits_per_unit

    usage.credits_used = credits_required
    usage.status = "consumed"
    
    # Update OrgCreditBalance
    billing_period = datetime.now(timezone.utc).strftime("%Y-%m")

    balance = db.query(OrgCreditBalance).filter(
        OrgCreditBalance.organization_id == usage.organization_id,
        OrgCreditBalance.billing_period == billing_period
    ).with_for_update().first()

    if not balance:
        raise Exception("Credit balance not found")

    balance.used_credit += credits_required
    balance.remaining_credit = balance.total_credit - balance.used_credit

    db.commit()
    
    
def release_reserved_credits(
    db,
    reference_type,
    reference_id
):

    usages = db.query(OrganizationCreditUsage).filter(
        OrganizationCreditUsage.reference_type == reference_type,
        OrganizationCreditUsage.reference_id == str(reference_id) if reference_id else None,
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