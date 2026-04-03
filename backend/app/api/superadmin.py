from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import math
import json
from datetime import datetime, timedelta, timezone
import re
import secrets
from app.database import get_db
from app.auth import get_password_hash, verify_password, create_access_token, require_superadmin
from app.models import (
    Organization,
    User,
    UserRole,
    SuperAdmin,
    OrganizationLimits,
    OrganizationSubscriptionUsage,
    Plan,
    PriceMatrixItem,
    CreditEstimatorShare,
)
from app.schemas.superadmin import (
    CallingNumberCreate,
    CallingNumberUpdate,
    SuperAdminLoginRequest,
    SuperAdminLoginResponse,
    SuperAdminBootstrapRequest,
    SuperAdminCreateOrganizationRequest,
    SuperAdminUpdateOrganizationRequest,
    SuperAdminOrganizationResponse,
    OrganizationLimitsUpdate,
    OrganizationLimitsResponse,
    SuperAdminOverviewResponse,
    PlanCreate,
    PlanUpdate,
    PlanResponse,
    SubscriptionCreate,
    SubscriptionResponse,
    PriceMatrixItemCreate,
    PriceMatrixItemUpdate,
    PriceMatrixItemResponse,
    PriceMatrixEstimateRequest,
    PriceMatrixEstimateResponse,
    PriceMatrixEstimateBreakdownLine,
    CreditEstimatorShareCreateRequest,
    CreditEstimatorShareExtendRequest,
    CreditEstimatorShareUpdateRequest,
    CreditEstimatorShareCreateResponse,
    CreditEstimatorShareListItemResponse,
    CreditEstimatorSharePublicResponse,
    CreditEstimatorShareEmailRequest,
)
from app.services.limits_service import (
    get_or_create_limits,
    update_limits,
    create_or_renew_subscription,
    get_active_subscription,
    get_subscription_days_left,
)
from sqlalchemy import func, text
from app.config import settings
from app.services.conversation_outcome_service import run_outcome_processing_batches
from app.services.email_service import send_widget_test_link_email
import logging
from sqlalchemy.exc import IntegrityError

from app.models.organization_subscription import OrganizationSubscription
from app.models.organization_calling_numbers import OrganizationCallingNumber

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])

ORG_DELETE_BLOCKING_TABLES = [
    "widget_configs",
    "knowledge_sources",
    "conversations",
    "leads",
    "campaigns",
    "contact_lists",
    "campaign_lead_rules",
    "campaign_lead_conversions",
    "call_campaigns",
    "call_logs",
    "calling_agents",
    "appointments",
    "appointment_intakes",
    "handoff_sessions",
    "products",
    "message_feedback",
    "conversation_metrics",
    "retrieval_traces",
    "funnel_categories",
]

ORG_DELETE_CLEANUP_TABLES = [
    "organization_calling_numbers",
    "organization_limits",
    "organization_subscription_usage",
    "organization_subscriptions",
    "organization_usage",
    "twilio_sms_channels",
    "whatsapp_channels",
    "users",
]


def _build_org_domain(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-") or "org"
    return f"{base}-{secrets.token_hex(3)}"


def _build_org_response(db: Session, org: Organization, admin_user: Optional[User] = None) -> SuperAdminOrganizationResponse:
    if not admin_user:
        admin_user = db.query(User).filter(
            User.organization_id == org.id,
            User.role == UserRole.ADMIN,
        ).first()
    limits = get_or_create_limits(db, org.id)
    subscription = get_active_subscription(db, org.id)
    plan = db.query(Plan).filter(Plan.id == limits.plan_id).first() if limits.plan_id else None

    return SuperAdminOrganizationResponse(
        id=org.id,
        name=org.name,
        description=org.description,
        admin_username=admin_user.username if admin_user else None,
        admin_email=admin_user.email if admin_user else None,
        limits=limits,
        plan=plan,
        subscription={
            "id": subscription.id,
            "organization_id": subscription.organization_id,
            "plan_id": subscription.plan_id,
            "status": subscription.status,
            "billing_cycle": subscription.billing_cycle,
            "start_date": subscription.start_date,
            "end_date": subscription.end_date,
            "trial_end": subscription.trial_end,
            "is_active": subscription.is_active,
            "days_left": get_subscription_days_left(subscription),
        } if subscription else None,
    )


def _table_exists(db: Session, table_name: str) -> bool:
    try:
        db.execute(text(f"SELECT 1 FROM {table_name} LIMIT 1"))
        return True
    except Exception:
        return False


def _to_utc(dt_value: datetime) -> datetime:
    if dt_value.tzinfo is None:
        return dt_value.replace(tzinfo=timezone.utc)
    return dt_value.astimezone(timezone.utc)


def _calculate_price_matrix_estimate(
    db: Session,
    payload: PriceMatrixEstimateRequest,
) -> PriceMatrixEstimateResponse:
    if not payload.lines:
        return PriceMatrixEstimateResponse(
            subtotal_credits=0,
            buffer_percent=payload.buffer_percent,
            buffer_credits=0,
            discount_percent=payload.discount_percent,
            discount_credits=0,
            final_recommended_credits=0,
            final_recommended_credits_ceiling=0,
            recommended_credits=0,
            recommended_credits_ceiling=0,
            breakdown=[],
        )

    requested_ids = {line.price_matrix_item_id for line in payload.lines}
    items = db.query(PriceMatrixItem).filter(PriceMatrixItem.id.in_(requested_ids)).all()
    item_by_id = {item.id: item for item in items}

    missing_ids = sorted(requested_ids - set(item_by_id.keys()))
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Price matrix item(s) not found: {', '.join(map(str, missing_ids))}",
        )

    breakdown: List[PriceMatrixEstimateBreakdownLine] = []
    subtotal_credits = 0.0

    for line in payload.lines:
        item = item_by_id[line.price_matrix_item_id]
        if item.credits_per_unit is None:
            raise HTTPException(
                status_code=400,
                detail=f"Item '{item.category} / {item.module} / {item.sub_module or '-'}' has no numeric credits_per_unit",
            )

        line_credits = float(item.credits_per_unit) * float(line.quantity)
        subtotal_credits += line_credits

        breakdown.append(
            PriceMatrixEstimateBreakdownLine(
                price_matrix_item_id=item.id,
                category=item.category,
                module=item.module,
                sub_module=item.sub_module,
                billing_unit=item.billing_unit,
                credits_per_unit=float(item.credits_per_unit),
                quantity=float(line.quantity),
                estimated_credits=round(line_credits, 2),
            )
        )

    buffer_credits = subtotal_credits * (payload.buffer_percent / 100)
    recommended_credits = subtotal_credits + buffer_credits
    discount_credits = recommended_credits * (payload.discount_percent / 100)
    final_recommended_credits = max(0.0, recommended_credits - discount_credits)

    return PriceMatrixEstimateResponse(
        subtotal_credits=round(subtotal_credits, 2),
        buffer_percent=payload.buffer_percent,
        buffer_credits=round(buffer_credits, 2),
        discount_percent=payload.discount_percent,
        discount_credits=round(discount_credits, 2),
        final_recommended_credits=round(final_recommended_credits, 2),
        final_recommended_credits_ceiling=int(math.ceil(final_recommended_credits)),
        recommended_credits=round(recommended_credits, 2),
        recommended_credits_ceiling=int(math.ceil(recommended_credits)),
        breakdown=breakdown,
    )


def _build_credit_estimate_share_path(token: str) -> str:
    return f"/credit-estimator/share/{token}"


def _load_credit_estimate_share(
    db: Session,
    token: str,
    enforce_active: bool = True,
    enforce_not_expired: bool = True,
) -> CreditEstimatorShare:
    share = db.query(CreditEstimatorShare).filter(CreditEstimatorShare.token == token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Shared estimate not found")

    if enforce_active and not share.is_active:
        raise HTTPException(status_code=404, detail="Shared estimate not found")

    if enforce_not_expired:
        now = datetime.now(timezone.utc)
        expires_at = _to_utc(share.expires_at)
        if expires_at <= now:
            raise HTTPException(status_code=401, detail="Shared estimate link has expired")

    return share


def _parse_estimate_payload(raw_value: Optional[str]) -> PriceMatrixEstimateResponse:
    try:
        estimate_payload = json.loads(raw_value or "{}")
    except Exception:
        estimate_payload = {}
    return PriceMatrixEstimateResponse.model_validate(estimate_payload)


def _parse_input_payload(raw_value: Optional[str]) -> PriceMatrixEstimateRequest:
    try:
        input_payload = json.loads(raw_value or "{}")
    except Exception:
        input_payload = {}
    return PriceMatrixEstimateRequest.model_validate(input_payload)


def _build_credit_share_create_response(
    share: CreditEstimatorShare,
    estimate: PriceMatrixEstimateResponse,
    expires_in_hours: int,
) -> CreditEstimatorShareCreateResponse:
    return CreditEstimatorShareCreateResponse(
        id=share.id,
        company_name=share.company_name,
        token=share.token,
        share_path=_build_credit_estimate_share_path(share.token),
        expires_at=_to_utc(share.expires_at),
        expires_in_hours=expires_in_hours,
        estimate=estimate,
    )


def _build_credit_share_list_item_response(share: CreditEstimatorShare) -> CreditEstimatorShareListItemResponse:
    created_at = _to_utc(share.created_at) if share.created_at else datetime.now(timezone.utc)
    expires_at = _to_utc(share.expires_at)
    estimate = _parse_estimate_payload(share.estimate_json)
    estimator_input = _parse_input_payload(share.input_json)
    is_expired = expires_at <= datetime.now(timezone.utc)
    return CreditEstimatorShareListItemResponse(
        id=share.id,
        company_name=share.company_name,
        token=share.token,
        share_path=_build_credit_estimate_share_path(share.token),
        expires_at=expires_at,
        created_at=created_at,
        is_active=bool(share.is_active),
        is_expired=is_expired,
        estimator_input=estimator_input,
        estimate=estimate,
    )


@router.post("/bootstrap", status_code=status.HTTP_201_CREATED)
async def bootstrap_superadmin(
    request: SuperAdminBootstrapRequest,
    db: Session = Depends(get_db)
):
    """Create the first superadmin (only if none exists)."""
    existing = db.query(SuperAdmin).first()
    if existing:
        raise HTTPException(status_code=400, detail="Superadmin already exists")

    superadmin = SuperAdmin(
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        is_active=True,
    )
    db.add(superadmin)
    db.commit()
    db.refresh(superadmin)

    return {"message": "Superadmin created", "superadmin_id": superadmin.id}


@router.post("/login", response_model=SuperAdminLoginResponse)
async def superadmin_login(
    request: SuperAdminLoginRequest,
    db: Session = Depends(get_db)
):
    superadmin = db.query(SuperAdmin).filter(
        SuperAdmin.username == request.username
    ).first()

    if not superadmin or not verify_password(request.password, superadmin.hashed_password) or not superadmin.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials or inactive superadmin")

    access_token = create_access_token(data={"sa": superadmin.id, "role": "SUPERADMIN"})
    return SuperAdminLoginResponse(
        access_token=access_token,
        superadmin_id=superadmin.id,
    )


@router.post("/organizations", response_model=SuperAdminOrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization_with_admin(
    request: SuperAdminCreateOrganizationRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    org_name = (request.organization_name or "").strip()
    admin_username = (request.admin_username or "").strip()

    if not org_name:
        raise HTTPException(status_code=400, detail="Organization name is required")
    if not admin_username:
        raise HTTPException(status_code=400, detail="Admin username is required")

    existing_org = db.query(Organization).filter(func.lower(Organization.name) == org_name.lower()).first()
    if existing_org:
        raise HTTPException(status_code=400, detail="Organization already exists")

    plan = db.query(Plan).filter(Plan.id == request.plan_id, Plan.is_active == True).first()
    if not plan:
        raise HTTPException(status_code=400, detail="Selected plan is invalid or inactive")

    org = Organization(
        name=org_name,
        description=request.description,
        org_domain=_build_org_domain(org_name),
        access_token=secrets.token_urlsafe(32),
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    try:
        admin_user = User(
            username=admin_username,
            email=request.admin_email,
            hashed_password=get_password_hash(request.admin_password),
            role=UserRole.ADMIN,
            organization_id=org.id,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    except IntegrityError:
        db.rollback()
        db.delete(org)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Admin username or email already exists in this organization",
        )

    limits_payload = request.limits.dict(exclude_unset=True) if request.limits else {}
    
    limits = update_limits(db, org.id, limits_payload)
    limits.plan_id = request.plan_id
    db.commit()
    db.refresh(limits)

    subscription = create_or_renew_subscription(
        db,
        organization_id=org.id,
        plan_id=request.plan_id,
        billing_cycle=request.billing_cycle,
        trial_days=request.trial_days,
    )

    return SuperAdminOrganizationResponse(
        id=org.id,
        name=org.name,
        description=org.description,
        admin_username=admin_user.username,
        admin_email=admin_user.email,
        limits=limits,
        plan=plan,
        subscription={
            "id": subscription.id,
            "organization_id": subscription.organization_id,
            "plan_id": subscription.plan_id,
            "status": subscription.status,
            "billing_cycle": subscription.billing_cycle,
            "start_date": subscription.start_date,
            "end_date": subscription.end_date,
            "trial_end": subscription.trial_end,
            "is_active": subscription.is_active,
            "days_left": get_subscription_days_left(subscription),
        },
    )


@router.get("/organizations", response_model=List[SuperAdminOrganizationResponse])
async def list_organizations(
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    orgs = db.query(Organization).all()
    return [_build_org_response(db, org) for org in orgs]


@router.put("/organizations/{org_id}", response_model=SuperAdminOrganizationResponse)
async def update_organization_with_admin(
    org_id: int,
    request: SuperAdminUpdateOrganizationRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    admin_user = db.query(User).filter(
        User.organization_id == org.id,
        User.role == UserRole.ADMIN,
    ).first()

    if request.organization_name is not None:
        org_name = request.organization_name.strip()
        if not org_name:
            raise HTTPException(status_code=400, detail="Organization name is required")
        duplicate_org = db.query(Organization).filter(
            func.lower(Organization.name) == org_name.lower(),
            Organization.id != org.id,
        ).first()
        if duplicate_org:
            raise HTTPException(status_code=400, detail="Organization already exists")
        org.name = org_name

    if request.description is not None:
        org.description = request.description

    admin_username = request.admin_username.strip() if request.admin_username is not None else None
    admin_email = str(request.admin_email).strip() if request.admin_email is not None else None
    admin_password = request.admin_password.strip() if request.admin_password is not None else None

    if not admin_user:
        if not admin_username:
            raise HTTPException(status_code=400, detail="Admin username is required to create missing admin")
        if not admin_email:
            raise HTTPException(status_code=400, detail="Admin email is required to create missing admin")
        if not admin_password:
            raise HTTPException(status_code=400, detail="Admin password is required to create missing admin")

        existing_username = db.query(User).filter(
            User.organization_id == org.id,
            func.lower(User.username) == admin_username.lower(),
        ).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Admin username already exists in this organization")

        existing_email = db.query(User).filter(
            User.organization_id == org.id,
            func.lower(User.email) == admin_email.lower(),
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Admin email already exists in this organization")

        admin_user = User(
            username=admin_username,
            email=admin_email,
            hashed_password=get_password_hash(admin_password),
            role=UserRole.ADMIN,
            organization_id=org.id,
            is_active=True,
        )
        db.add(admin_user)
    else:
        if (request.admin_email is not None or request.admin_password is not None) and request.admin_username is None:
            raise HTTPException(status_code=400, detail="Admin username is required when updating admin credentials")

        if request.admin_username is not None:
            if not admin_username:
                raise HTTPException(status_code=400, detail="Admin username is required")
            existing_username = db.query(User).filter(
                User.organization_id == org.id,
                func.lower(User.username) == admin_username.lower(),
                User.id != admin_user.id,
            ).first()
            if existing_username:
                raise HTTPException(status_code=400, detail="Admin username already exists in this organization")
            admin_user.username = admin_username

        if request.admin_email is not None:
            if not admin_email:
                raise HTTPException(status_code=400, detail="Admin email is required")
            existing_email = db.query(User).filter(
                User.organization_id == org.id,
                func.lower(User.email) == admin_email.lower(),
                User.id != admin_user.id,
            ).first()
            if existing_email:
                raise HTTPException(status_code=400, detail="Admin email already exists in this organization")
            admin_user.email = admin_email

        if request.admin_password is not None:
            if not admin_password:
                raise HTTPException(status_code=400, detail="Admin password cannot be empty")
            admin_user.hashed_password = get_password_hash(admin_password)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update organization details due to duplicate data")

    db.refresh(org)
    db.refresh(admin_user)
    return _build_org_response(db, org, admin_user)


@router.get("/organizations/{org_id}/limits", response_model=OrganizationLimitsResponse)
async def get_organization_limits(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    limits = get_or_create_limits(db, org_id)
    return limits


@router.put("/organizations/{org_id}/limits", response_model=OrganizationLimitsResponse)
async def update_organization_limits(
    org_id: int,
    updates: OrganizationLimitsUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    update_data = updates.dict(exclude_unset=True)   
    limits = update_limits(db, org_id, update_data)
    return limits


@router.post("/organizations/{org_id}/subscription", response_model=SubscriptionResponse)
async def assign_subscription(
    org_id: int,
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    sub = create_or_renew_subscription(
        db,
        organization_id=org_id,
        plan_id=payload.plan_id,
        billing_cycle=payload.billing_cycle,
        trial_days=payload.trial_days,
    )

    limits = get_or_create_limits(db, org_id)
    limits.plan_id = payload.plan_id
        
    db.commit()

    return SubscriptionResponse(
        id=sub.id,
        organization_id=sub.organization_id,
        plan_id=sub.plan_id,
        status=sub.status,
        billing_cycle=sub.billing_cycle,
        start_date=sub.start_date,
        end_date=sub.end_date,
        trial_end=sub.trial_end,
        is_active=sub.is_active,
        days_left=get_subscription_days_left(sub),
    )


@router.get("/organizations/{org_id}/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    sub = get_active_subscription(db, org_id)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")
    return SubscriptionResponse(
        id=sub.id,
        organization_id=sub.organization_id,
        plan_id=sub.plan_id,
        status=sub.status,
        billing_cycle=sub.billing_cycle,
        start_date=sub.start_date,
        end_date=sub.end_date,
        trial_end=sub.trial_end,
        is_active=sub.is_active,
        days_left=get_subscription_days_left(sub),
    )


@router.post("/plans", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    existing = db.query(Plan).filter(Plan.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Plan name already exists")

    plan = Plan(**payload.dict())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/plans", response_model=List[PlanResponse])
async def list_plans(
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    return db.query(Plan).all()


@router.put("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    for key, value in payload.dict(exclude_unset=True).items():
        if hasattr(plan, key):
            setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    limits_usage = db.query(OrganizationLimits).filter(OrganizationLimits.plan_id == plan_id).count()
    subscription_usage = db.query(OrganizationSubscription).filter(OrganizationSubscription.plan_id == plan_id).count()
    if limits_usage > 0 or subscription_usage > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete plan because it is used by one or more organizations",
        )

    db.delete(plan)
    db.commit()
    return {"success": True, "deleted_plan_id": plan_id}


@router.get("/price-matrix", response_model=List[PriceMatrixItemResponse])
async def list_price_matrix_items(
    active_only: bool = False,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    query = db.query(PriceMatrixItem)
    if active_only:
        query = query.filter(PriceMatrixItem.is_active == True)

    return query.order_by(
        PriceMatrixItem.sort_order.asc(),
        PriceMatrixItem.category.asc(),
        PriceMatrixItem.module.asc(),
        PriceMatrixItem.id.asc(),
    ).all()


@router.post("/price-matrix", response_model=PriceMatrixItemResponse, status_code=status.HTTP_201_CREATED)
async def create_price_matrix_item(
    payload: PriceMatrixItemCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    item = PriceMatrixItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/price-matrix/item/{item_id}", response_model=PriceMatrixItemResponse)
async def update_price_matrix_item(
    item_id: int,
    payload: PriceMatrixItemUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    item = db.query(PriceMatrixItem).filter(PriceMatrixItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Price matrix item not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(item, key):
            setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/price-matrix/item/{item_id}")
async def delete_price_matrix_item(
    item_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    item = db.query(PriceMatrixItem).filter(PriceMatrixItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Price matrix item not found")

    db.delete(item)
    db.commit()
    return {"success": True, "deleted_item_id": item_id}


@router.post("/price-matrix/estimate", response_model=PriceMatrixEstimateResponse)
async def estimate_price_matrix_credits(
    payload: PriceMatrixEstimateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return _calculate_price_matrix_estimate(db, payload)


@router.post("/credit-estimator/share", response_model=CreditEstimatorShareCreateResponse)
async def create_credit_estimator_share(
    payload: CreditEstimatorShareCreateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    estimate = _calculate_price_matrix_estimate(
        db,
        PriceMatrixEstimateRequest(
            lines=payload.lines,
            buffer_percent=payload.buffer_percent,
            discount_percent=payload.discount_percent,
        ),
    )

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=payload.valid_for_hours)
    token = secrets.token_urlsafe(32)

    share = CreditEstimatorShare(
        token=token,
        company_name=payload.company_name.strip(),
        created_by_superadmin_id=superadmin.id,
        input_json=json.dumps(
            {
                "lines": [line.model_dump() for line in payload.lines],
                "buffer_percent": payload.buffer_percent,
                "discount_percent": payload.discount_percent,
            }
        ),
        estimate_json=json.dumps(estimate.model_dump()),
        expires_at=expires_at,
        is_active=True,
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    return _build_credit_share_create_response(share, estimate, payload.valid_for_hours)


@router.get("/credit-estimator/results", response_model=List[CreditEstimatorShareListItemResponse])
async def list_credit_estimator_results(
    company_name: Optional[str] = None,
    status_filter: str = "all",
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    query = db.query(CreditEstimatorShare).order_by(CreditEstimatorShare.created_at.desc(), CreditEstimatorShare.id.desc())

    if company_name and company_name.strip():
        query = query.filter(CreditEstimatorShare.company_name.ilike(f"%{company_name.strip()}%"))

    rows = query.all()
    now = datetime.now(timezone.utc)

    if status_filter == "active":
        rows = [row for row in rows if _to_utc(row.expires_at) > now and row.is_active]
    elif status_filter == "expired":
        rows = [row for row in rows if _to_utc(row.expires_at) <= now or not row.is_active]

    return [_build_credit_share_list_item_response(row) for row in rows]


@router.get("/credit-estimator/results/{result_id}", response_model=CreditEstimatorShareListItemResponse)
async def get_credit_estimator_result(
    result_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = db.query(CreditEstimatorShare).filter(CreditEstimatorShare.id == result_id).first()
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    return _build_credit_share_list_item_response(share)


@router.put("/credit-estimator/results/{result_id}", response_model=CreditEstimatorShareCreateResponse)
async def update_credit_estimator_result(
    result_id: int,
    payload: CreditEstimatorShareUpdateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = db.query(CreditEstimatorShare).filter(CreditEstimatorShare.id == result_id).first()
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    existing_input = _parse_input_payload(share.input_json)
    next_lines = payload.lines if payload.lines is not None else existing_input.lines
    next_buffer = payload.buffer_percent if payload.buffer_percent is not None else existing_input.buffer_percent
    next_discount = payload.discount_percent if payload.discount_percent is not None else existing_input.discount_percent
    next_company = payload.company_name.strip() if payload.company_name is not None else share.company_name

    recompute_payload = PriceMatrixEstimateRequest(
        lines=next_lines,
        buffer_percent=next_buffer,
        discount_percent=next_discount,
    )
    estimate = _calculate_price_matrix_estimate(db, recompute_payload)

    share.company_name = next_company
    share.input_json = json.dumps(
        {
            "lines": [line.model_dump() for line in recompute_payload.lines],
            "buffer_percent": recompute_payload.buffer_percent,
            "discount_percent": recompute_payload.discount_percent,
        }
    )
    share.estimate_json = json.dumps(estimate.model_dump())
    if payload.valid_for_hours is not None:
        share.expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.valid_for_hours)
        expires_in_hours = payload.valid_for_hours
    else:
        expires_in_hours = max(1, int((_to_utc(share.expires_at) - datetime.now(timezone.utc)).total_seconds() // 3600))

    db.commit()
    db.refresh(share)
    return _build_credit_share_create_response(share, estimate, expires_in_hours)


@router.post("/credit-estimator/share/{token}/extend", response_model=CreditEstimatorShareCreateResponse)
async def extend_credit_estimator_share(
    token: str,
    payload: CreditEstimatorShareExtendRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = _load_credit_estimate_share(db, token, enforce_active=True, enforce_not_expired=False)
    now = datetime.now(timezone.utc)
    current_expiry = _to_utc(share.expires_at)
    baseline = current_expiry if current_expiry > now else now
    share.expires_at = baseline + timedelta(hours=payload.extra_hours)
    db.commit()
    db.refresh(share)

    estimate = _parse_estimate_payload(share.estimate_json)
    return _build_credit_share_create_response(share, estimate, payload.extra_hours)


@router.post("/credit-estimator/results/{result_id}/extend", response_model=CreditEstimatorShareCreateResponse)
async def extend_credit_estimator_result(
    result_id: int,
    payload: CreditEstimatorShareExtendRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = db.query(CreditEstimatorShare).filter(CreditEstimatorShare.id == result_id).first()
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    now = datetime.now(timezone.utc)
    current_expiry = _to_utc(share.expires_at)
    baseline = current_expiry if current_expiry > now else now
    share.expires_at = baseline + timedelta(hours=payload.extra_hours)
    db.commit()
    db.refresh(share)
    estimate = _parse_estimate_payload(share.estimate_json)
    return _build_credit_share_create_response(share, estimate, payload.extra_hours)


@router.get("/credit-estimator/share/{token}", response_model=CreditEstimatorSharePublicResponse)
async def get_shared_credit_estimator_result(
    token: str,
    db: Session = Depends(get_db),
):
    share = _load_credit_estimate_share(db, token, enforce_active=True, enforce_not_expired=True)
    estimate = _parse_estimate_payload(share.estimate_json)
    created_at = _to_utc(share.created_at) if share.created_at else datetime.now(timezone.utc)
    return CreditEstimatorSharePublicResponse(
        id=share.id,
        company_name=share.company_name,
        token=share.token,
        estimate=estimate,
        created_at=created_at,
        expires_at=_to_utc(share.expires_at),
    )


@router.post("/credit-estimator/share/{token}/email")
async def send_credit_estimator_share_via_email(
    token: str,
    payload: CreditEstimatorShareEmailRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    _load_credit_estimate_share(db, token, enforce_active=True, enforce_not_expired=True)
    body = (payload.body or "").strip()
    subject = (payload.subject or "").strip() or "Credit Estimate from Zentrixel"
    if not body:
        raise HTTPException(status_code=400, detail="Email body cannot be empty")

    success, error_message = send_widget_test_link_email(
        recipient_email=str(payload.to_email),
        subject=subject,
        message_body=body,
    )
    if not success:
        raise HTTPException(status_code=400, detail=error_message or "Failed to send email")

    return {"message": "Credit estimate share email sent successfully"}


@router.post("/credit-estimator/results/{result_id}/email")
async def send_credit_estimator_result_via_email(
    result_id: int,
    payload: CreditEstimatorShareEmailRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = db.query(CreditEstimatorShare).filter(CreditEstimatorShare.id == result_id).first()
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    now = datetime.now(timezone.utc)
    if _to_utc(share.expires_at) <= now:
        raise HTTPException(status_code=401, detail="Shared estimate link has expired")

    body = (payload.body or "").strip()
    subject = (payload.subject or "").strip() or "Credit Estimate from Zentrixel"
    if not body:
        raise HTTPException(status_code=400, detail="Email body cannot be empty")

    success, error_message = send_widget_test_link_email(
        recipient_email=str(payload.to_email),
        subject=subject,
        message_body=body,
    )
    if not success:
        raise HTTPException(status_code=400, detail=error_message or "Failed to send email")

    return {"message": "Credit estimate share email sent successfully"}


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    blocking_tables: List[str] = []
    for table_name in ORG_DELETE_BLOCKING_TABLES:
        if not _table_exists(db, table_name):
            continue
        row_count = db.execute(
            text(f"SELECT COUNT(1) FROM {table_name} WHERE organization_id = :org_id"),
            {"org_id": org_id},
        ).scalar()
        if int(row_count or 0) > 0:
            blocking_tables.append(table_name)

    if blocking_tables:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete organization because related data exists in: "
                + ", ".join(blocking_tables[:6])
                + (" ..." if len(blocking_tables) > 6 else "")
            ),
        )

    try:
        for table_name in ORG_DELETE_CLEANUP_TABLES:
            if not _table_exists(db, table_name):
                continue
            db.execute(
                text(f"DELETE FROM {table_name} WHERE organization_id = :org_id"),
                {"org_id": org_id},
            )

        db.delete(org)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to delete organization due to related records")

    return {"success": True, "deleted_organization_id": org_id}


@router.get("/analytics/overview", response_model=SuperAdminOverviewResponse)
async def superadmin_analytics_overview(
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    orgs = db.query(Organization).all()
    total_orgs = len(orgs)

    total_conversations = 0
    total_tokens = 0
    total_leads = 0
    total_documents = 0
    total_crawl_pages = 0

    for org in orgs:
        usage = db.query(OrganizationSubscriptionUsage).filter(
            OrganizationSubscriptionUsage.organization_id == org.id
        ).order_by(OrganizationSubscriptionUsage.period_start.desc()).first()
        if not usage:
            continue
        total_conversations += usage.conversations_count
        total_tokens += usage.tokens_used
        total_leads += usage.leads_count
        total_documents += usage.documents_count
        total_crawl_pages += usage.crawl_pages_count

    return SuperAdminOverviewResponse(
        total_organizations=total_orgs,
        total_conversations=total_conversations,
        total_tokens=total_tokens,
        total_leads=total_leads,
        total_documents=total_documents,
        total_crawl_pages=total_crawl_pages,
    )


@router.get("/analytics/org/{org_id}")
async def superadmin_organization_analytics(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    limits = get_or_create_limits(db, org_id)
    usage = db.query(OrganizationSubscriptionUsage).filter(
        OrganizationSubscriptionUsage.organization_id == org_id
    ).order_by(OrganizationSubscriptionUsage.period_start.desc()).first()
    subscription = get_active_subscription(db, org_id)
    plan = db.query(Plan).filter(Plan.id == limits.plan_id).first() if limits.plan_id else None

    return {
        "organization": {
            "id": org.id,
            "name": org.name,
            "description": org.description,
        },
        "limits": limits,
        "plan": plan,
        "subscription": {
            "id": subscription.id,
            "organization_id": subscription.organization_id,
            "plan_id": subscription.plan_id,
            "status": subscription.status,
            "billing_cycle": subscription.billing_cycle,
            "start_date": subscription.start_date,
            "end_date": subscription.end_date,
            "trial_end": subscription.trial_end,
            "is_active": subscription.is_active,
            "days_left": get_subscription_days_left(subscription),
        } if subscription else None,
        "usage": usage,
    }




@router.post('/outcomes/process')
async def run_outcome_processing_now(
    payload: dict = Body(None),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    """Admin endpoint to run outcome processing on-demand.

    Optional JSON payload: {"batch_size": int, "max_batches": int}
    """
    batch_size = int(payload.get('batch_size')) if payload and payload.get('batch_size') else settings.OUTCOME_DAEMON_BATCH_SIZE
    max_batches = int(payload.get('max_batches')) if payload and payload.get('max_batches') else settings.OUTCOME_DAEMON_MAX_BATCHES

    processed, failed = run_outcome_processing_batches(batch_size=batch_size, max_batches=max_batches)
    return {"processed": processed, "failed": failed}


@router.get("/analytics/by-org")
async def superadmin_analytics_by_org(
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    orgs = db.query(Organization).all()
    data = []

    for org in orgs:
        usage = db.query(OrganizationSubscriptionUsage).filter(
            OrganizationSubscriptionUsage.organization_id == org.id
        ).order_by(OrganizationSubscriptionUsage.period_start.desc()).first()
        data.append({
            "organization": {
                "id": org.id,
                "name": org.name,
                "description": org.description,
            },
            "usage": usage,
        })

    return data


### Organization Calling No
@router.get("/org/{org_id}/calling-numbers")
def get_calling_numbers(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    return db.query(OrganizationCallingNumber).filter(
        OrganizationCallingNumber.organization_id == org_id
    ).all()
    
    
@router.post("/org/{org_id}/calling-number")
def create_calling_number(
    org_id: int,
    payload: CallingNumberCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    obj = OrganizationCallingNumber(
        organization_id=org_id,
        calling_number=payload.calling_number
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return obj

@router.put("/org/calling-number/{id}")
def update_calling_number(
    id: int,
    payload: CallingNumberUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin)
):
    obj = db.query(
        OrganizationCallingNumber
    ).get(id)

    obj.calling_number = payload.calling_number

    db.commit()
    return obj

@router.patch("/org/calling-number/{id}/active")
def toggle_active(
    id: int,
    db: Session = Depends(get_db)
):
    obj = db.query(
        OrganizationCallingNumber
    ).get(id)

    obj.is_active = not obj.is_active

    db.commit()

    return obj

@router.patch("/org/calling-number/{id}/default")
def set_default(
    id: int,
    db: Session = Depends(get_db)
):
    obj = db.query(
        OrganizationCallingNumber
    ).get(id)

    # remove old default
    db.query(OrganizationCallingNumber).filter(
        OrganizationCallingNumber.organization_id ==
        obj.organization_id
    ).update({"is_default": False})

    obj.is_default = True

    db.commit()

    return obj

@router.delete("/org/calling-number/{id}")
def delete_calling_number(
    id: int,
    db: Session = Depends(get_db)
):
    obj = db.query(
        OrganizationCallingNumber
    ).get(id)

    db.delete(obj)
    db.commit()

    return {"success": True}
