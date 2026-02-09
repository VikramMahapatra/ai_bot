from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
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
)
from app.schemas.superadmin import (
    SuperAdminLoginRequest,
    SuperAdminLoginResponse,
    SuperAdminBootstrapRequest,
    SuperAdminCreateOrganizationRequest,
    SuperAdminOrganizationResponse,
    OrganizationLimitsUpdate,
    OrganizationLimitsResponse,
    SuperAdminOverviewResponse,
    PlanCreate,
    PlanUpdate,
    PlanResponse,
    SubscriptionCreate,
    SubscriptionResponse,
)
from app.services.limits_service import (
    get_or_create_limits,
    update_limits,
    create_or_renew_subscription,
    get_active_subscription,
    get_subscription_days_left,
)
from sqlalchemy import func
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


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
    existing_org = db.query(Organization).filter(Organization.name == request.organization_name).first()
    if existing_org:
        raise HTTPException(status_code=400, detail="Organization already exists")

    existing_user = db.query(User).filter(User.username == request.admin_username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Admin username already exists")

    org = Organization(name=request.organization_name, description=request.description)
    db.add(org)
    db.commit()
    db.refresh(org)

    admin_user = User(
        username=request.admin_username,
        email=request.admin_email,
        hashed_password=get_password_hash(request.admin_password),
        role=UserRole.ADMIN,
        organization_id=org.id,
        is_active=True,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

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

    plan = db.query(Plan).filter(Plan.id == request.plan_id).first()

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
    response = []

    for org in orgs:
        admin_user = db.query(User).filter(
            User.organization_id == org.id,
            User.role == UserRole.ADMIN
        ).first()
        limits = get_or_create_limits(db, org.id)
        subscription = get_active_subscription(db, org.id)
        plan = db.query(Plan).filter(Plan.id == limits.plan_id).first() if limits.plan_id else None

        response.append(
            SuperAdminOrganizationResponse(
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
        )

    return response


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
    limits = update_limits(db, org_id, updates.dict(exclude_unset=True))
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
