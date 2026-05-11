from datetime import datetime, timezone
from sqlalchemy.orm import Session
from typing import Optional
from app.models import (
    OrganizationLimits,
    OrganizationUsage,
    OrganizationSubscription,
    OrganizationSubscriptionUsage,
)


DEFAULT_LIMITS = {
    "lead_generation_enabled": True,
    "voice_chat_enabled": False,
    "multilingual_text_enabled": False,
    "whatsapp_enabled": False,
    "human_handoff_enabled": False,
    "email_campaign_enabled": True,
    "sms_campaign_enabled": True,
    "module_knowledge_enabled": True,
    "module_leads_enabled": True,
    "module_analytics_enabled": True,
    "module_advanced_analytics_enabled": True,
    "module_reports_enabled": True,
    "module_campaigns_enabled": True,
    "module_appointments_enabled": True,
    "module_products_enabled": True,
    "module_users_enabled": True,
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

    changed = False
    for key, default_value in DEFAULT_LIMITS.items():
        if hasattr(limits, key) and getattr(limits, key) is None:
            setattr(limits, key, default_value)
            changed = True

    if changed:
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


def _build_effective_limits(limits: OrganizationLimits) -> dict:
    return {
        "lead_generation_enabled": limits.lead_generation_enabled if limits.lead_generation_enabled is not None else DEFAULT_LIMITS["lead_generation_enabled"],
        "voice_chat_enabled": limits.voice_chat_enabled if limits.voice_chat_enabled is not None else DEFAULT_LIMITS["voice_chat_enabled"],
        "multilingual_text_enabled": limits.multilingual_text_enabled if limits.multilingual_text_enabled is not None else DEFAULT_LIMITS["multilingual_text_enabled"],
        "whatsapp_enabled": limits.whatsapp_enabled if limits.whatsapp_enabled is not None else DEFAULT_LIMITS["whatsapp_enabled"],
        "human_handoff_enabled": limits.human_handoff_enabled if limits.human_handoff_enabled is not None else DEFAULT_LIMITS["human_handoff_enabled"],
        "email_campaign_enabled": limits.email_campaign_enabled if limits.email_campaign_enabled is not None else DEFAULT_LIMITS["email_campaign_enabled"],
        "sms_campaign_enabled": limits.sms_campaign_enabled if limits.sms_campaign_enabled is not None else DEFAULT_LIMITS["sms_campaign_enabled"],
        "module_knowledge_enabled": limits.module_knowledge_enabled if limits.module_knowledge_enabled is not None else DEFAULT_LIMITS["module_knowledge_enabled"],
        "module_leads_enabled": limits.module_leads_enabled if limits.module_leads_enabled is not None else DEFAULT_LIMITS["module_leads_enabled"],
        "module_analytics_enabled": limits.module_analytics_enabled if limits.module_analytics_enabled is not None else DEFAULT_LIMITS["module_analytics_enabled"],
        "module_advanced_analytics_enabled": limits.module_advanced_analytics_enabled if limits.module_advanced_analytics_enabled is not None else DEFAULT_LIMITS["module_advanced_analytics_enabled"],
        "module_reports_enabled": limits.module_reports_enabled if limits.module_reports_enabled is not None else DEFAULT_LIMITS["module_reports_enabled"],
        "module_campaigns_enabled": limits.module_campaigns_enabled if limits.module_campaigns_enabled is not None else DEFAULT_LIMITS["module_campaigns_enabled"],
        "module_appointments_enabled": limits.module_appointments_enabled if limits.module_appointments_enabled is not None else DEFAULT_LIMITS["module_appointments_enabled"],
        "module_products_enabled": limits.module_products_enabled if limits.module_products_enabled is not None else DEFAULT_LIMITS["module_products_enabled"],
        "module_users_enabled": limits.module_users_enabled if limits.module_users_enabled is not None else DEFAULT_LIMITS["module_users_enabled"],
    }


def get_active_subscription(db: Session, organization_id: int) -> Optional[OrganizationSubscription]:
    sub = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == organization_id,
        OrganizationSubscription.is_active == True
    ).first()

    if not sub:
        return None

    now = datetime.now(timezone.utc)
    if sub.end_date < now:
        sub.status = "expired"
        sub.is_active = False
        db.commit()
        return None

    return sub

def get_effective_limits(db: Session, organization_id: int) -> dict:
    limits = db.query(OrganizationLimits).filter(
        OrganizationLimits.organization_id == organization_id
    ).first()

    if limits:
        effective = _build_effective_limits(limits)
    else:
        effective = dict(DEFAULT_LIMITS)

    effective["subscription_active"] = True
    effective["days_left"] = None
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
