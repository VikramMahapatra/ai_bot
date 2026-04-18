import json
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import (
    Campaign,
    CampaignLeadConversion,
    CampaignLeadRule,
    CampaignLog,
    Contact,
    Lead,
)
from app.services.call_log_service import create_lead_activity
from app.models.lead_contact_mapping import LeadContactMapping

DEFAULT_RULE_NAME = "Default Campaign to Lead Rule"

DEFAULT_INCLUDE_STATUSES = ["delivered", "opened", "read", "clicked"]
DEFAULT_EXCLUDE_STATUSES = ["failed", "bounced", "complained", "unsubscribed"]
DEFAULT_SCORE_CONFIG = {
    "delivered": 10,
    "opened": 20,
    "read": 25,
    "clicked": 40,
    "extra_open": 5,
    "extra_click": 10,
    "replied": 60,
}
DEFAULT_SOURCE_MULTIPLIERS = {
    "email": 1.0,
    "sms": 1.15,
    "whatsapp": 1.2,
}


def _loads_json(raw: Optional[str], default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def _dumps_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def get_or_create_active_rule(db: Session, organization_id: int) -> CampaignLeadRule:
    rule = (
        db.query(CampaignLeadRule)
        .filter(
            CampaignLeadRule.organization_id == organization_id,
            CampaignLeadRule.is_active == 1,
        )
        .order_by(CampaignLeadRule.id.desc())
        .first()
    )

    if rule:
        return rule

    rule = CampaignLeadRule(
        organization_id=organization_id,
        rule_name=DEFAULT_RULE_NAME,
        is_active=1,
        auto_convert_enabled=0,
        min_score_threshold=50,
        dedupe_window_days=30,
        target_funnel_stage="qualified",
        include_statuses=_dumps_json(DEFAULT_INCLUDE_STATUSES),
        exclude_statuses=_dumps_json(DEFAULT_EXCLUDE_STATUSES),
        score_config=_dumps_json(DEFAULT_SCORE_CONFIG),
        source_multipliers=_dumps_json(DEFAULT_SOURCE_MULTIPLIERS),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def serialize_rule(rule: CampaignLeadRule) -> dict[str, Any]:
    return {
        "id": rule.id,
        "organization_id": rule.organization_id,
        "rule_name": rule.rule_name,
        "is_active": bool(rule.is_active),
        "auto_convert_enabled": bool(rule.auto_convert_enabled),
        "min_score_threshold": int(rule.min_score_threshold or 50),
        "dedupe_window_days": int(rule.dedupe_window_days or 30),
        "target_funnel_stage": rule.target_funnel_stage,
        "include_statuses": _loads_json(rule.include_statuses, DEFAULT_INCLUDE_STATUSES),
        "exclude_statuses": _loads_json(rule.exclude_statuses, DEFAULT_EXCLUDE_STATUSES),
        "score_config": _loads_json(rule.score_config, DEFAULT_SCORE_CONFIG),
        "source_multipliers": _loads_json(rule.source_multipliers, DEFAULT_SOURCE_MULTIPLIERS),
        "created_at": rule.created_at,
        "updated_at": rule.updated_at,
    }


def update_rule(
    db: Session,
    rule: CampaignLeadRule,
    payload: dict[str, Any],
) -> CampaignLeadRule:
    if "rule_name" in payload:
        rule.rule_name = str(payload.get("rule_name") or DEFAULT_RULE_NAME).strip() or DEFAULT_RULE_NAME
    if "auto_convert_enabled" in payload:
        rule.auto_convert_enabled = 1 if bool(payload.get("auto_convert_enabled")) else 0
    if "min_score_threshold" in payload:
        rule.min_score_threshold = max(1, int(payload.get("min_score_threshold") or 50))
    if "dedupe_window_days" in payload:
        rule.dedupe_window_days = max(1, int(payload.get("dedupe_window_days") or 30))
    if "target_funnel_stage" in payload:
        raw_stage = str(payload.get("target_funnel_stage") or "").strip().lower().replace(" ", "_")
        rule.target_funnel_stage = raw_stage or None

    if "include_statuses" in payload:
        values = [str(item).strip().lower() for item in (payload.get("include_statuses") or []) if str(item).strip()]
        rule.include_statuses = _dumps_json(values or DEFAULT_INCLUDE_STATUSES)

    if "exclude_statuses" in payload:
        values = [str(item).strip().lower() for item in (payload.get("exclude_statuses") or []) if str(item).strip()]
        rule.exclude_statuses = _dumps_json(values or DEFAULT_EXCLUDE_STATUSES)

    if "score_config" in payload and isinstance(payload.get("score_config"), dict):
        merged = {**DEFAULT_SCORE_CONFIG, **payload["score_config"]}
        normalized = {key: int(value or 0) for key, value in merged.items()}
        rule.score_config = _dumps_json(normalized)

    if "source_multipliers" in payload and isinstance(payload.get("source_multipliers"), dict):
        merged = {**DEFAULT_SOURCE_MULTIPLIERS, **payload["source_multipliers"]}
        normalized = {key: float(value or 0) for key, value in merged.items()}
        rule.source_multipliers = _dumps_json(normalized)

    db.commit()
    db.refresh(rule)
    return rule


def _evaluate_score(log: CampaignLog, campaign_type: str, rule: CampaignLeadRule) -> tuple[int, list[str]]:
    include_statuses = set(_loads_json(rule.include_statuses, DEFAULT_INCLUDE_STATUSES))
    exclude_statuses = set(_loads_json(rule.exclude_statuses, DEFAULT_EXCLUDE_STATUSES))
    score_cfg = _loads_json(rule.score_config, DEFAULT_SCORE_CONFIG)
    multipliers = _loads_json(rule.source_multipliers, DEFAULT_SOURCE_MULTIPLIERS)

    status = (log.status or "").strip().lower()
    reasons: list[str] = []

    if status in exclude_statuses:
        reasons.append(f"excluded_status:{status}")
        return 0, reasons

    if include_statuses and status not in include_statuses:
        reasons.append(f"status_not_included:{status}")
        return 0, reasons

    score = 0

    if log.delivered_at:
        score += int(score_cfg.get("delivered", 0))
        reasons.append("delivered")
    if log.opened_at:
        score += int(score_cfg.get("opened", 0))
        reasons.append("opened")
    if log.read_at:
        score += int(score_cfg.get("read", 0))
        reasons.append("read")
    if log.clicked_at:
        score += int(score_cfg.get("clicked", 0))
        reasons.append("clicked")

    if int(log.open_count or 0) > 1:
        score += int(score_cfg.get("extra_open", 0))
        reasons.append("extra_open")
    if int(log.click_count or 0) > 1:
        score += int(score_cfg.get("extra_click", 0))
        reasons.append("extra_click")

    multiplier = float(multipliers.get(campaign_type, 1.0) or 1.0)
    final_score = int(round(score * multiplier))
    reasons.append(f"channel_multiplier:{campaign_type}x{multiplier}")

    return final_score, reasons


def run_rule_engine(
    db: Session,
    organization_id: int,
    rule: CampaignLeadRule,
    campaign_id: Optional[int] = None,
    dry_run: bool = True,
    limit: int = 500,
) -> dict[str, Any]:
    query = (
        db.query(CampaignLog, Campaign, Contact)
        .join(Campaign, Campaign.id == CampaignLog.campaign_id)
        .join(Contact, Contact.id == CampaignLog.contact_id)
        .filter(Campaign.organization_id == organization_id)
        .order_by(CampaignLog.created_at.desc())
    )

    if campaign_id:
        query = query.filter(Campaign.id == campaign_id)

    rows = query.limit(max(1, min(limit, 5000))).all()

    dedupe_window_days = max(1, int(rule.dedupe_window_days or 30))
    dedupe_after = datetime.utcnow() - timedelta(days=dedupe_window_days)

    converted_count = 0
    duplicate_count = 0
    skipped_count = 0

    details: list[dict[str, Any]] = []

    for log, campaign, contact in rows:
        existing_decision = (
            db.query(CampaignLeadConversion)
            .filter(
                CampaignLeadConversion.rule_id == rule.id,
                CampaignLeadConversion.campaign_log_id == log.id,
            )
            .first()
        )
        if existing_decision:
            continue

        campaign_type = (campaign.campaign_type or "").strip().lower()
        score, reasons = _evaluate_score(log, campaign_type, rule)
        threshold = int(rule.min_score_threshold or 50)

        base_payload = {
            "campaign_log_id": log.id,
            "campaign_id": campaign.id,
            "campaign_name": campaign.campaign_name,
            "contact_id": contact.id,
            "contact_name": contact.name,
            "email": contact.email,
            "phone": contact.phone,
            "score": score,
            "threshold": threshold,
            "reasons": reasons,
        }

        if not (contact.email or contact.phone):
            skipped_count += 1
            if not dry_run:
                decision = CampaignLeadConversion(
                    organization_id=organization_id,
                    campaign_id=campaign.id,
                    campaign_log_id=log.id,
                    contact_id=contact.id,
                    rule_id=rule.id,
                    score=score,
                    status="skipped_missing_contact",
                    reason="missing_contact_fields",
                    details=_dumps_json(base_payload),
                )
                db.add(decision)
            details.append({**base_payload, "status": "skipped_missing_contact"})
            continue

        if score < threshold:
            skipped_count += 1
            if not dry_run:
                decision = CampaignLeadConversion(
                    organization_id=organization_id,
                    campaign_id=campaign.id,
                    campaign_log_id=log.id,
                    contact_id=contact.id,
                    rule_id=rule.id,
                    score=score,
                    status="skipped_not_eligible",
                    reason=f"score_below_threshold:{score}<{threshold}",
                    details=_dumps_json(base_payload),
                )
                db.add(decision)
            details.append({**base_payload, "status": "skipped_not_eligible"})
            continue

        duplicate_lead = None
        if contact.email:
            duplicate_lead = (
                db.query(Lead)
                .filter(
                    Lead.organization_id == organization_id,
                    Lead.email == contact.email,
                    Lead.created_at >= dedupe_after,
                )
                .order_by(Lead.created_at.desc())
                .first()
            )
        if not duplicate_lead and contact.phone:
            duplicate_lead = (
                db.query(Lead)
                .filter(
                    Lead.organization_id == organization_id,
                    Lead.phone == contact.phone,
                    Lead.created_at >= dedupe_after,
                )
                .order_by(Lead.created_at.desc())
                .first()
            )

        if duplicate_lead:
            duplicate_count += 1
            if not dry_run:
                log.converted_lead_id = duplicate_lead.id
                decision = CampaignLeadConversion(
                    organization_id=organization_id,
                    campaign_id=campaign.id,
                    campaign_log_id=log.id,
                    contact_id=contact.id,
                    lead_id=duplicate_lead.id,
                    rule_id=rule.id,
                    score=score,
                    status="skipped_duplicate",
                    reason="duplicate_lead_within_window",
                    details=_dumps_json(base_payload),
                )
                db.add(decision)
            details.append({**base_payload, "status": "skipped_duplicate", "lead_id": duplicate_lead.id})
            continue

        
        
        contact_fields = {}
        if contact:
            contact_fields = {
                "whatsapp_number": contact.whatsapp_number,
                "gender": contact.gender,
                "designation": contact.designation,
                "city": contact.city,
                "state": contact.state,
                "country": contact.country,
                "source": contact.source,
                "tags": contact.tags
            }
            
        conversion_metadata = {
            "origin": "campaign_to_lead_rule_engine",
            "campaign_id": campaign.id,
            "campaign_log_id": log.id,
            "contact_id": contact.id,
            "run_sequence": int(log.run_sequence or 1),
            "score": score,
            "threshold": threshold,
            "reasons": reasons,
            **contact_fields
        }
        
        filters = [
            Lead.organization_id == organization_id,
            Lead.product_id == (
                str(campaign.product_id) if campaign.product_id else None
            )
        ]

        contact_filters = []

        if contact.phone:
            contact_filters.append(Lead.phone == contact.phone)

        if contact.email:
            contact_filters.append(Lead.email == contact.email)

        if contact_filters:
            filters.append(or_(*contact_filters))

        existing = (
            db.query(Lead)
            .filter(*filters)
            .order_by(Lead.created_at.desc())
            .first()
        )
        
        if existing and existing.funnel_stage not in ["closed_won", "closed_lost"]:
            lead = existing    
        else:
            lead = Lead(
                session_id=f"campaign-{campaign.id}-contact-{contact.id}-log-{log.id}",
                widget_id=None,
                product_id=str(campaign.product_id) if campaign.product_id else None,
                user_id=None,
                organization_id=organization_id,
                name=(contact.name or "").strip() or None,
                email=(contact.email or "").strip().lower() or None,
                phone=(contact.phone or "").strip() or None,
                company=(contact.company or "").strip() or None,
                custom_fields=_dumps_json(conversion_metadata),
                lead_outcome="campaign_engaged",
                source=campaign_type if campaign_type in {"email", "sms", "whatsapp"} else "chat",
                funnel_stage=(rule.target_funnel_stage or "qualified"),
            )

            converted_count += 1
            if not dry_run:
                db.add(lead)
                db.flush()  
                
                if contact:
                    mapping = LeadContactMapping(
                        lead_id=lead.id,
                        contact_id=contact.id,
                        source=campaign_type if campaign_type in {"email", "sms", "whatsapp"} else "chat"
                    )
                    db.add(mapping)
                    db.flush()              
            else:
                details.append({**base_payload, "status": "would_convert"})
        
        
        if not dry_run:
            log.converted_lead_id = lead.id
            decision = CampaignLeadConversion(
                    organization_id=organization_id,
                    campaign_id=campaign.id,
                    campaign_log_id=log.id,
                    contact_id=contact.id,
                    lead_id=lead.id,
                    rule_id=rule.id,
                    score=score,
                    status="converted",
                    reason="eligible",
                    details=_dumps_json(base_payload),
            )
            db.add(decision)
            details.append({**base_payload, "status": "converted", "lead_id": lead.id})
            
            create_lead_activity(
                db=db,
                lead=lead,
                source=campaign_type if campaign_type in {"email", "sms", "whatsapp"} else "chat",
                session_id=f"campaign-{campaign.id}-contact-{contact.id}-log-{log.id}",
                campaign=campaign,
                summary="Lead created from campaign engagement",
            )

    if not dry_run:
        db.commit()

    return {
        "rule_id": rule.id,
        "rule_name": rule.rule_name,
        "dry_run": dry_run,
        "evaluated": len(rows),
        "converted": converted_count,
        "skipped_duplicates": duplicate_count,
        "skipped": skipped_count,
        "details": details[:200],
    }
