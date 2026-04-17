import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from openai import OpenAI
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Conversation, Lead, FunnelCategory

import logging

from app.models.call_campaigns import CallCampaign
from app.services.call_campaign_service import sync_campaign_from_echoleads
from app.utils.echoleads_client import EcholeadsClient
from app.models.lead_contact_mapping import LeadContactMapping
from app.models.lead_activities import LeadActivity

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAPI_KEY2)

VALID_OUTCOMES = {
    "positive",
    "negative",
    "satisfactory",
    "neutral",
    "unresolved",
    "other",
}


def _normalize_outcome(value: Optional[str]) -> str:
    if not value:
        return "other"

    normalized = value.strip().lower()
    if normalized in VALID_OUTCOMES:
        return normalized

    aliases = {
        "satisfied": "satisfactory",
        "satisfaction": "satisfactory",
        "good": "positive",
        "bad": "negative",
        "unknown": "other",
    }
    return aliases.get(normalized, "other")


def _build_transcript(rows: List[Conversation]) -> str:
    lines: List[str] = []
    for row in rows[:120]:
        if row.message and row.message.strip():
            lines.append(f"User: {row.message.strip()}")
        if row.response and row.response.strip():
            lines.append(f"Assistant: {row.response.strip()}")
    return "\n".join(lines)


def _classify_outcome_with_llm(transcript: str) -> str:
    if not transcript.strip():
        return "other"

    response = client.chat.completions.create(
        model=settings.OUTCOME_CLASSIFICATION_MODEL,
        temperature=0,
        max_tokens=12,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a conversation-quality classifier. "
                    "Classify the full session outcome into exactly one label from: "
                    "positive, negative, satisfactory, neutral, unresolved, other. "
                    "Return only the label, nothing else."
                ),
            },
            {
                "role": "user",
                "content": f"Session transcript:\n{transcript}",
            },
        ],
    )

    content = response.choices[0].message.content if response.choices else None
    return _normalize_outcome(content)


def _classify_funnel_stage_with_llm(transcript: str, categories: List[FunnelCategory]) -> Optional[str]:
    if not transcript.strip() or not categories:
        return None

    valid_keys = {str(item.key).strip().lower() for item in categories if (item.key or '').strip()}
    if not valid_keys:
        return None

    category_lines = [f"- {item.key}: {item.name}" for item in categories if (item.key or '').strip()]

    response = client.chat.completions.create(
        model=settings.OUTCOME_CLASSIFICATION_MODEL,
        temperature=0,
        max_tokens=24,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a sales funnel classifier. "
                    "Classify the full session into exactly one funnel category key from the provided list. "
                    "Return only the key, nothing else."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Available funnel category keys:\n"
                    + "\n".join(category_lines)
                    + "\n\nSession transcript:\n"
                    + transcript
                ),
            },
        ],
    )

    content = (response.choices[0].message.content if response.choices else "") or ""
    normalized = content.strip().lower().replace(' ', '_')
    if normalized in valid_keys:
        return normalized
    return None


def process_pending_session_outcomes(db: Session, batch_size: int = 100, organization_id: Optional[int] = None) -> Tuple[int, int]:
    """Process pending session outcomes where conversation.outcome is NULL.

    Returns tuple: (processed_count, failed_count)
    """
    pending_query = db.query(
        Conversation.organization_id,
        Conversation.session_id,
    ).filter(
        Conversation.session_id.isnot(None),
        Conversation.outcome.is_(None),
    )

    if organization_id is not None:
        pending_query = pending_query.filter(Conversation.organization_id == organization_id)

    pending_sessions = pending_query.group_by(
        Conversation.organization_id,
        Conversation.session_id,
    ).limit(batch_size).all()

    processed = 0
    failed = 0
    funnel_categories_by_org: dict[int, List[FunnelCategory]] = {}

    for org_id, session_id in pending_sessions:
        try:
            rows = db.query(Conversation).filter(
                Conversation.organization_id == org_id,
                Conversation.session_id == session_id,
            ).order_by(Conversation.created_at.asc()).all()

            if not rows:
                continue

            transcript = _build_transcript(rows)
            outcome = _classify_outcome_with_llm(transcript)

            if org_id not in funnel_categories_by_org:
                funnel_categories_by_org[org_id] = db.query(FunnelCategory).filter(
                    FunnelCategory.organization_id == org_id,
                    FunnelCategory.is_active == True,
                ).order_by(FunnelCategory.position.asc(), FunnelCategory.id.asc()).all()
            inferred_funnel_stage = _classify_funnel_stage_with_llm(
                transcript,
                funnel_categories_by_org.get(org_id, []),
            )

            db.query(Conversation).filter(
                Conversation.organization_id == org_id,
                Conversation.session_id == session_id,
                Conversation.outcome.is_(None),
            ).update(
                {Conversation.outcome: outcome},
                synchronize_session=False,
            )
            
            # Update LeadActivity outcome by session_id
            db.query(LeadActivity).filter(
                LeadActivity.session_id == session_id,
                LeadActivity.outcome.is_(None),
            ).update(
                {LeadActivity.outcome: outcome},
                synchronize_session=False,
            )

            # Keep leads in sync with the resolved conversation outcome.
            lead_rows = db.query(Lead).join(
                LeadContactMapping,
                LeadContactMapping.lead_id == Lead.id
            ).join(
                Conversation,
                Conversation.contact_id == LeadContactMapping.contact_id
            ).filter(
                Conversation.organization_id == org_id,
                Conversation.session_id == session_id,
                Lead.organization_id == org_id
            ).distinct(Lead.id).all()
            
            for lead in lead_rows:
                if (lead.lead_outcome or "").strip().lower() != outcome:
                    lead.lead_outcome = outcome
                if inferred_funnel_stage and not (lead.funnel_stage or '').strip():
                    lead.funnel_stage = inferred_funnel_stage

            db.commit()
            processed += 1
        except Exception as exc:
            db.rollback()
            failed += 1
            logger.error(
                "Failed to process outcome for org=%s session=%s: %s",
                org_id,
                session_id,
                str(exc),
                exc_info=True,
            )

    return processed, failed


def process_pending_lead_outcomes(
    db: Session,
    batch_size: int = 100,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:
    """Backfill lead_outcome from existing conversation outcomes for matching sessions."""
    
    lead_query = db.query(
        Lead.organization_id,
        Lead.session_id,
        Lead.id,
    )

    if organization_id is not None:
        lead_query = lead_query.filter(Lead.organization_id == organization_id)

    pending_lead_sessions = lead_query.group_by(
        Lead.organization_id,
        Lead.session_id,
        Lead.id,
    ).limit(batch_size).all()

    synced = 0
    failed = 0

    for org_id, session_id, lead_id  in pending_lead_sessions:
        try:
            contact_id = db.query(LeadContactMapping.contact_id).filter(
                LeadContactMapping.lead_id == lead_id
            ).scalar()
            
            if not contact_id:
                latest_with_outcome = db.query(Conversation).filter(
                    Conversation.organization_id == org_id,
                    Conversation.session_id == session_id,
                    Conversation.outcome.isnot(None),
                ).order_by(Conversation.created_at.desc()).first()
            else :
                latest_with_outcome = db.query(Conversation).filter(
                    Conversation.organization_id == org_id,
                    Conversation.contact_id == contact_id,
                    Conversation.outcome.isnot(None),
                ).order_by(Conversation.created_at.desc()).first()

            if not latest_with_outcome or not (latest_with_outcome.outcome or "").strip():
                continue

            normalized_outcome = _normalize_outcome(latest_with_outcome.outcome)
            updated_rows = db.query(Lead).filter(
                Lead.organization_id == org_id,
                Lead.id == lead_id,
                Lead.lead_outcome.is_(None),
            ).update(
                {Lead.lead_outcome: normalized_outcome},
                synchronize_session=False,
            )

            db.commit()
            if updated_rows:
                synced += 1
        except Exception as exc:
            db.rollback()
            failed += 1
            logger.error(
                "Failed to backfill lead outcome for org=%s session=%s: %s",
                org_id,
                lead_id,
                str(exc),
                exc_info=True,
            )

    return synced, failed


def process_pending_lead_funnel_tags(
    db: Session,
    batch_size: int = 100,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:
    """Backfill lead.funnel_stage from AI classification for sessions with missing funnel tags."""
    lead_query = db.query(
        Lead.organization_id,
        Lead.session_id,
        Lead.id,
    )

    if organization_id is not None:
        lead_query = lead_query.filter(Lead.organization_id == organization_id)

    pending_sessions = lead_query.group_by(
        Lead.organization_id,
        Lead.session_id,
        Lead.id,
    ).limit(batch_size).all()

    tagged = 0
    failed = 0
    funnel_categories_by_org: dict[int, List[FunnelCategory]] = {}

    for org_id, session_id, lead_id in pending_sessions:
        try:
            contact_id = db.query(LeadContactMapping.contact_id).filter(
                LeadContactMapping.lead_id == lead_id
            ).scalar()
            
            if not contact_id: # guest lead without contact mapping, try to find conversations by session_id if available
                rows = db.query(Conversation).filter(
                    Conversation.organization_id == org_id,
                    Conversation.session_id == session_id
                ).order_by(Conversation.created_at.asc()).all()
            else :
                rows = db.query(Conversation).filter(
                    Conversation.organization_id == org_id,
                    Conversation.contact_id == contact_id
                ).order_by(Conversation.created_at.asc()).all()
            
            if not rows:
                continue

            if org_id not in funnel_categories_by_org:
                funnel_categories_by_org[org_id] = db.query(FunnelCategory).filter(
                    FunnelCategory.organization_id == org_id,
                    FunnelCategory.is_active == True,
                ).order_by(FunnelCategory.position.asc(), FunnelCategory.id.asc()).all()

            inferred_funnel_stage = _classify_funnel_stage_with_llm(
                _build_transcript(rows),
                funnel_categories_by_org.get(org_id, []),
            )
            if not inferred_funnel_stage:
                continue

            updated_rows = db.query(Lead).filter(
                Lead.organization_id == org_id,
                Lead.id == lead_id,
                or_(Lead.funnel_stage.is_(None), Lead.funnel_stage == ''),
            ).update(
                {Lead.funnel_stage: inferred_funnel_stage},
                synchronize_session=False,
            )

            db.commit()
            if updated_rows:
                tagged += 1
        except Exception as exc:
            db.rollback()
            failed += 1
            logger.error(
                "Failed to backfill funnel stage for org=%s session=%s: %s",
                org_id,
                lead_id,
                str(exc),
                exc_info=True,
            )

    return tagged, failed

def process_call_campaigns_data(
    db: Session,
    batch_size: int = 100,
    organization_id: Optional[int] = None,
    last_id: Optional[int] = None,
) -> Tuple[int, int, Optional[int]]:
    SYNC_STATUSES = ["active", "running", "pending", "scheduled"]

    query = db.query(CallCampaign).filter(
        CallCampaign.is_deleted == False,
        CallCampaign.status.in_(SYNC_STATUSES)
    )

    if last_id:
        query = query.filter(CallCampaign.id < last_id)

    campaign_models = query.order_by(CallCampaign.id.desc()).limit(batch_size).all()

    echolead_client = EcholeadsClient()
    synced = 0
    failed = 0

    for campaign in campaign_models:
        try:
            sync_campaign_from_echoleads(db, echolead_client, campaign)
            synced += 1
        except Exception as exc:
            failed += 1

    # Return last processed ID to skip in next batch
    new_last_id = campaign_models[-1].id if campaign_models else None
    return synced, failed, new_last_id


def run_outcome_processing_batches(batch_size: int, max_batches: int, organization_id: Optional[int] = None) -> Tuple[int, int]:
    total_processed = 0
    total_failed = 0

    db = SessionLocal()
    try:
        for _ in range(max_batches):
            processed, failed = process_pending_session_outcomes(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
            )
            synced, sync_failed = process_pending_lead_outcomes(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
            )
            tagged, tag_failed = process_pending_lead_funnel_tags(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
            )
            total_processed += processed
            total_failed += failed + sync_failed + tag_failed
            if processed == 0 and synced == 0 and tagged == 0:
                break
    finally:
        db.close()

    return total_processed, total_failed


def _seconds_until_next_run(hour_utc: int, minute_utc: int) -> float:
    now = datetime.now(timezone.utc)
    target = now.replace(hour=hour_utc, minute=minute_utc, second=0, microsecond=0)
    if now >= target:
        target = target + timedelta(days=1)
    return max((target - now).total_seconds(), 1.0)


async def run_daily_outcome_daemon(stop_event: asyncio.Event) -> None:
    """Run outcome processing once at startup, then once per day at configured UTC time."""
    initial_delay = max(settings.OUTCOME_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = run_outcome_processing_batches(
            batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
            max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
        )
        logger.info(
            "Initial outcome processing completed: processed=%s failed=%s",
            processed,
            failed,
        )
    except Exception as exc:
        logger.error("Initial outcome processing failed: %s", str(exc), exc_info=True)

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_run(
            settings.OUTCOME_DAEMON_HOUR_UTC,
            settings.OUTCOME_DAEMON_MINUTE_UTC,
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = run_outcome_processing_batches(
                batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
                max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
            )
            logger.info(
                "Scheduled outcome processing completed: processed=%s failed=%s",
                processed,
                failed,
            )
        except Exception as exc:
            logger.error("Scheduled outcome processing failed: %s", str(exc), exc_info=True)
            
            
def run_call_campaign_processing_batches(batch_size: int, max_batches: int, organization_id: Optional[int] = None) -> Tuple[int, int]:
    total_processed = 0
    total_failed = 0

    db = SessionLocal()
    try:
        last_id = None
        for _ in range(max_batches):
            synced, sync_failed, last_id  = process_call_campaigns_data(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
                last_id =last_id
            )
            total_processed += synced
            total_failed += sync_failed 
            if synced == 0:
                break
    finally:
        db.close()

    return total_processed, total_failed



async def run_daily_call_campaign_daemon(stop_event: asyncio.Event) -> None:
    """Run call campaign fetching once at startup, then once per day at configured UTC time."""
    initial_delay = max(settings.OUTCOME_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = run_call_campaign_processing_batches(
            batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
            max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
        )
        logger.info(
            "Initial call campaign processing completed: processed=%s failed=%s",
            processed,
            failed,
        )
    except Exception as exc:
        logger.error("Initial call campaign processing failed: %s", str(exc), exc_info=True)

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_run(
            settings.OUTCOME_DAEMON_HOUR_UTC,
            settings.OUTCOME_DAEMON_MINUTE_UTC,
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = run_call_campaign_processing_batches(
                batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
                max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
            )
            logger.info(
                "Scheduled call campaign processing completed: processed=%s failed=%s",
                processed,
                failed,
            )
        except Exception as exc:
            logger.error("Scheduled call campaign processing failed: %s", str(exc), exc_info=True)
