from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Optional
from app.models import (
    OrganizationLimits,
    OrganizationUsage,
    OrganizationSubscription,
    OrganizationSubscriptionUsage,
    Plan,
)


DEFAULT_LIMITS = {
    "monthly_conversation_limit": None,
    "monthly_crawl_pages_limit": None,
    "max_crawl_depth": None,
    "monthly_document_limit": None,
    "max_document_size_mb": None,
    "monthly_token_limit": None,
    "max_query_words": None,
    "lead_generation_enabled": None,
    "voice_chat_enabled": None,
    "multilingual_text_enabled": None,
}


def get_current_year_month() -> tuple[int, int]:
    now = datetime.utcnow()
    return now.year, now.month


def get_or_create_limits(db: Session, organization_id: int) -> OrganizationLimits:
    limits = db.query(OrganizationLimits).filter(
        OrganizationLimits.organization_id == organization_id
    ).first()

    if not limits:
        limits = OrganizationLimits(
            organization_id=organization_id,
            **DEFAULT_LIMITS
        )
        db.add(limits)
        db.commit()
        db.refresh(limits)

    return limits


def update_limits(db: Session, organization_id: int, updates: dict) -> OrganizationLimits:
    limits = get_or_create_limits(db, organization_id)
    for key, value in updates.items():
        if hasattr(limits, key) and value is not None:
            setattr(limits, key, value)
    db.commit()
    db.refresh(limits)
    return limits


def _build_effective_limits(plan: Plan, limits: OrganizationLimits) -> dict:
    return {
        "monthly_conversation_limit": limits.monthly_conversation_limit if limits.monthly_conversation_limit is not None else plan.monthly_conversation_limit,
        "monthly_crawl_pages_limit": limits.monthly_crawl_pages_limit if limits.monthly_crawl_pages_limit is not None else plan.monthly_crawl_pages_limit,
        "max_crawl_depth": limits.max_crawl_depth if limits.max_crawl_depth is not None else plan.max_crawl_depth,
        "monthly_document_limit": limits.monthly_document_limit if limits.monthly_document_limit is not None else plan.monthly_document_limit,
        "max_document_size_mb": limits.max_document_size_mb if limits.max_document_size_mb is not None else plan.max_document_size_mb,
        "monthly_token_limit": limits.monthly_token_limit if limits.monthly_token_limit is not None else plan.monthly_token_limit,
        "max_query_words": limits.max_query_words if limits.max_query_words is not None else plan.max_query_words,
        "lead_generation_enabled": limits.lead_generation_enabled if limits.lead_generation_enabled is not None else plan.lead_generation_enabled,
        "voice_chat_enabled": limits.voice_chat_enabled if limits.voice_chat_enabled is not None else plan.voice_chat_enabled,
        "multilingual_text_enabled": limits.multilingual_text_enabled if limits.multilingual_text_enabled is not None else plan.multilingual_text_enabled,
    }


def get_active_subscription(db: Session, organization_id: int) -> Optional[OrganizationSubscription]:
    sub = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id,
        OrganizationSubscription.is_active == True
    ).first()

    if not sub:
        return None

    now = datetime.utcnow()
    if sub.end_date < now:
        sub.status = "expired"
        sub.is_active = False
        db.commit()
        return None

    return sub


def get_subscription_days_left(sub: OrganizationSubscription) -> int:
    now = datetime.utcnow()
    delta = sub.end_date - now
    return max(0, delta.days)


def create_or_renew_subscription(
    db: Session,
    organization_id: int,
    plan_id: int,
    billing_cycle: str = "monthly",
    trial_days: Optional[int] = None,
) -> OrganizationSubscription:
    now = datetime.utcnow()
    cycle_days = 30 if billing_cycle == "monthly" else 365
    start_date = now
    end_date = now + timedelta(days=cycle_days)
    trial_end = now + timedelta(days=trial_days) if trial_days else None

    existing = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id
    ).first()

    if existing:
        existing.plan_id = plan_id
        existing.billing_cycle = billing_cycle
        existing.status = "trial" if trial_days else "active"
        existing.is_active = True
        existing.start_date = start_date
        existing.end_date = end_date
        existing.trial_end = trial_end
        db.commit()
        db.refresh(existing)
        return existing

    sub = OrganizationSubscription(
        organization_id=organization_id,
        plan_id=plan_id,
        status="trial" if trial_days else "active",
        billing_cycle=billing_cycle,
        start_date=start_date,
        end_date=end_date,
        trial_end=trial_end,
        is_active=True,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def get_effective_limits(db: Session, organization_id: int) -> dict:
    limits = get_or_create_limits(db, organization_id)
    subscription = get_active_subscription(db, organization_id)
    if not subscription:
        return {"subscription_active": False}

    plan = db.query(Plan).filter(Plan.id == subscription.plan_id, Plan.is_active == True).first()
    if not plan:
        return {"subscription_active": False}

    effective = _build_effective_limits(plan, limits)
    effective["subscription_active"] = True
    effective["days_left"] = get_subscription_days_left(subscription)
    effective["plan_id"] = plan.id
    effective["billing_cycle"] = subscription.billing_cycle
    return effective


def get_or_create_usage(db: Session, organization_id: int) -> OrganizationUsage:
    year, month = get_current_year_month()
    usage = db.query(OrganizationUsage).filter(
        OrganizationUsage.organization_id == organization_id,
        OrganizationUsage.year == year,
        OrganizationUsage.month == month
    ).first()

    if not usage:
        usage = OrganizationUsage(
            organization_id=organization_id,
            year=year,
            month=month,
            conversations_count=0,
            messages_count=0,
            crawl_pages_count=0,
            documents_count=0,
            tokens_used=0,
            leads_count=0,
        )
        db.add(usage)
        db.commit()
        db.refresh(usage)

    return usage


def get_or_create_subscription_usage(db: Session, organization_id: int) -> Optional[OrganizationSubscriptionUsage]:
    subscription = get_active_subscription(db, organization_id)
    if not subscription:
        return None

    usage = db.query(OrganizationSubscriptionUsage).filter(
        OrganizationSubscriptionUsage.organization_id == organization_id,
        OrganizationSubscriptionUsage.period_start == subscription.start_date,
    ).first()

    if not usage:
        usage = OrganizationSubscriptionUsage(
            organization_id=organization_id,
            period_start=subscription.start_date,
            period_end=subscription.end_date,
            conversations_count=0,
            messages_count=0,
            crawl_pages_count=0,
            documents_count=0,
            tokens_used=0,
            leads_count=0,
        )
        db.add(usage)
        db.commit()
        db.refresh(usage)

    return usage


def increment_usage(db: Session, organization_id: int, **increments) -> OrganizationUsage:
    usage = get_or_create_usage(db, organization_id)
    for key, value in increments.items():
        if hasattr(usage, key) and value is not None:
            current = getattr(usage, key) or 0
            setattr(usage, key, current + int(value))
    db.commit()
    db.refresh(usage)

    subscription_usage = get_or_create_subscription_usage(db, organization_id)
    if subscription_usage:
        for key, value in increments.items():
            if hasattr(subscription_usage, key) and value is not None:
                current = getattr(subscription_usage, key) or 0
                setattr(subscription_usage, key, current + int(value))
        db.commit()
        db.refresh(subscription_usage)

    return usage
