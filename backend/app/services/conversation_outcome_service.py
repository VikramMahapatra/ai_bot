import asyncio
from collections import defaultdict
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from openai import OpenAI
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import SessionLocal
from app.models import Conversation, Lead, FunnelCategory

import logging

from app.models.call_campaigns import CallCampaign
from app.services.call_campaign_service import sync_campaign_from_echoleads
from app.utils.echoleads_client import EcholeadsClient
from app.models.lead_contact_mapping import LeadContactMapping
from app.models.lead_activities import LeadActivity
from app.enums.credit_feature_codes import FeatureCodes
from app.services import organization_credit_service
from app.models.workflows import WorkflowExecution
from app.models.calling_agents import CallingAgent, CallingAgentTestCall
from app.services.call_log_service import sync_test_call_log

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

VALID_LEAD_STATUSES = {
    "lead",
    "not lead",
}

FUNNEL_STAGE = {
    "LEAD_QUALIFICATION": "lead_qualification",
    "CLOSED_LOST": "closed_lost",
    "UNASSIGNED": "unassigned",
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


def _normalize_lead_status(value: Optional[str]) -> str:
    if not value:
        return "not lead"

    normalized = value.strip().lower().replace("_", " ").replace("-", " ")
    if normalized in VALID_LEAD_STATUSES:
        return normalized

    aliases = {
        "notlead": "not lead",
        "non lead": "not lead",
        "nonlead": "not lead",
        "potential lead": "lead",
        "qualified lead": "lead",
    }
    return aliases.get(normalized, "not lead")


def _normalize_outcome_payload(raw: Dict[str, Any]) -> Dict[str, str]:
    return {
        "outcome": _normalize_outcome(str(raw.get("outcome", ""))),
        "whether_lead": _normalize_lead_status(str(raw.get("whether_lead", ""))),
    }


def _build_chat_transcript(rows: List[Conversation]) -> str:
    lines = []

    for row in rows[:120]:
        if row.message and row.message.strip():
            lines.append(f"User: {row.message.strip()}")
        if row.response and row.response.strip():
            lines.append(f"Assistant: {row.response.strip()}")

    return "\n".join(lines)

def _build_voice_transcript(rows):
    lines = []

    for r in rows:

        msg = (r.message or "").strip()
        resp = (r.response or "").strip()

        # Case 1: proper Q/A
        if msg and resp:
            lines.append(f"User: {msg}")
            lines.append(f"Assistant: {resp}")

        # Case 2: agent only (voice-first)
        elif resp and not msg:
            lines.append(f"Assistant: {resp}")

        # Case 3: user only fragment
        elif msg and not resp:
            lines.append(f"User: {msg}")

    return "\n".join(lines)

def _build_transcript(rows: List[Conversation]) -> str:
    if not rows:
        return ""

    if rows[0].source == "voice":
        return _build_voice_transcript(rows)

    return _build_chat_transcript(rows)


def _classify_outcome_with_llm(transcript: str) -> Dict[str, str]:
    if not transcript.strip():
        return {"outcome": "other", "whether_lead": "not lead"}

    response = client.chat.completions.create(
        model=settings.OUTCOME_CLASSIFICATION_MODEL,
        temperature=0,
        max_tokens=64,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a CRM sales conversation classifier. "
                    "Analyze the FULL transcript from a business / lead-generation perspective, "
                    "not merely conversational politeness.\n\n"

                    "Return valid JSON only with exactly two keys:\n"
                    "1) outcome\n"
                    "2) whether_lead\n\n"

                    "Allowed values:\n"
                    "outcome = positive | negative | satisfactory | neutral | unresolved | other\n"
                    "whether_lead = lead | not lead\n\n"

                    "Classification rules:\n"

                    "- positive = customer shows clear buying interest, asks for next step, agrees for callback/demo/visit, or is qualified opportunity.\n"
                    "- negative = customer clearly rejects, angry response, complaint, hostility, or strong refusal.\n"
                    "- satisfactory = issue/help request was successfully addressed OR conversation ended helpfully with useful engagement.\n"
                    "- neutral = polite conversation but no business opportunity / no intent / already customer / irrelevant / no current need.\n"
                    "- unresolved = customer has interest/problem/question but next action is pending or issue not closed.\n"
                    "- other = unclear / unrelated.\n\n"

                    "Lead rules:\n"
                    "- lead = potential sales opportunity exists.\n"
                    "- not lead = no opportunity, already purchased elsewhere, irrelevant contact, wrong number, or no need.\n\n"

                    "Important:\n"
                    "- If customer already owns/installed the product and shows no new requirement → outcome=neutral, whether_lead=not lead.\n"
                    "- Do not classify based only on politeness.\n"
                    "- Focus on commercial opportunity.\n"
                    "- Return JSON only."
                ),
            },
            {
                "role": "user",
                "content": f"Session transcript:\n{transcript}",
            },
        ],
    )

    content = response.choices[0].message.content if response.choices else ""
    if not content:
        return {"outcome": "other", "whether_lead": "not lead"}

    parsed: Dict[str, Any]
    try:
        candidate = json.loads(content)
        parsed = candidate if isinstance(candidate, dict) else {}
    except json.JSONDecodeError:
        # Backward compatibility for plain-text responses from older prompts.
        parsed = {"outcome": content, "whether_lead": "not lead"}

    return _normalize_outcome_payload(parsed)


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
            valid = organization_credit_service.validate_feature_usage(
                db, org_id, FeatureCodes.AI_SENTIMENT, 1
            )

            if not valid:
                raise HTTPException(
                    status_code=400,
                    detail="Insufficient credits. Please add more credits to continue.",
                )
        
        
            rows = db.query(Conversation).filter(
                Conversation.organization_id == org_id,
                Conversation.session_id == session_id,
            ).order_by(Conversation.created_at.asc()).all()

            if not rows:
                continue

            transcript = _build_transcript(rows)
            classification = _classify_outcome_with_llm(transcript)
            outcome = classification["outcome"]
            whether_lead = classification["whether_lead"]
            is_lead_value = 1 if whether_lead == "lead" else 0
            
            if transcript.strip():
                organization_credit_service.deduct_credits(
                db=db,
                organization_id=org_id,
                feature_code=FeatureCodes.AI_SENTIMENT,
                quantity=1,
                reference_type="conversation",
                reference_id=session_id
            )

            if org_id not in funnel_categories_by_org:
                funnel_categories_by_org[org_id] = db.query(FunnelCategory).filter(
                    FunnelCategory.organization_id == org_id,
                    FunnelCategory.is_active == True,
                ).order_by(FunnelCategory.position.asc(), FunnelCategory.id.asc()).all()
                
            # FUNNEL STAGE ANALYSIS TO BE DONE
                
            # inferred_funnel_stage = _classify_funnel_stage_with_llm(
            #     transcript,
            #     funnel_categories_by_org.get(org_id, []),
            # )
            
            inferred_funnel_stage = (
                FUNNEL_STAGE["LEAD_QUALIFICATION"]
                if is_lead_value
                else (
                    FUNNEL_STAGE["CLOSED_LOST"]
                    if (outcome or "").lower() not in (None, "")
                    else FUNNEL_STAGE["UNASSIGNED"]
                )
            )
            
            db.query(Conversation).filter(
                Conversation.organization_id == org_id,
                Conversation.session_id == session_id,
                Conversation.outcome.is_(None),
            ).update(
                {
                    Conversation.outcome: outcome,
                    Conversation.is_lead: is_lead_value,
                },
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

            logger.info(
                "Outcome classification resolved for org=%s session=%s: outcome=%s whether_lead=%s",
                org_id,
                session_id,
                outcome,
                whether_lead,
            )

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
    ).filter(
        Lead.lead_outcome.is_(None)
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
    ).filter(
        Lead.funnel_stage.is_(None)
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
                
            logger.info(f"Running llm for lead : {lead_id}")

            # inferred_funnel_stage = _classify_funnel_stage_with_llm(
            #     _build_transcript(rows),
            #     funnel_categories_by_org.get(org_id, []),
            # )
            
            lead = db.query(Lead).filter(
                Lead.organization_id == org_id,
                Lead.id == lead_id,
                or_(Lead.funnel_stage.is_(None), Lead.funnel_stage == ''),
            ).first()
            
            inferred_funnel_stage = None
            
            if lead:
                inferred_funnel_stage = (
                    FUNNEL_STAGE["LEAD_QUALIFICATION"]
                    if rows[0].is_lead
                    else (
                        FUNNEL_STAGE["CLOSED_LOST"]
                        if (rows[0].outcome or "").lower() not in (None, "")
                        else FUNNEL_STAGE["UNASSIGNED"]
                    )
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
    
    pending_execution_exists = (
        db.query(WorkflowExecution.id)
        .filter(
            WorkflowExecution.campaign_id == CallCampaign.id,
            WorkflowExecution.status == "pending"
        )
        .exists()
    )

    query = db.query(CallCampaign).filter(
        CallCampaign.is_deleted == False,
        or_(
            CallCampaign.status.in_(SYNC_STATUSES),
            and_(
                CallCampaign.status == "completed",
                pending_execution_exists
            )
        )
    )

    if last_id:
        query = query.filter(CallCampaign.id < last_id)

    campaign_models = query.order_by(CallCampaign.id.desc()).limit(batch_size).all()
    
    org_map = defaultdict(list)

    for campaign in campaign_models:
        org_map[campaign.organization_id].append(campaign)
        
    synced = 0
    failed = 0
    
    for org_id, campaigns in org_map.items():
        echolead_client = EcholeadsClient(org_id)

        for campaign in campaign_models:
            try:
                sync_campaign_from_echoleads(db, echolead_client, campaign.id)
                synced += 1
            except Exception as exc:
                failed += 1

    # Return last processed ID to skip in next batch
    new_last_id = campaign_models[-1].id if campaign_models else None
    return synced, failed, new_last_id

def process_test_call_data(
    db: Session,
    batch_size: int = 100,
    organization_id: Optional[int] = None,
    last_id: Optional[int] = None,
) -> Tuple[int, int, Optional[int]]:
    SYNC_STATUSES = ["active", "running", "pending", "scheduled"]
    
    
    query = (
        db.query(CallingAgentTestCall)
        .options(joinedload(CallingAgentTestCall.agent))
        .filter(
            CallingAgentTestCall.status == "queued",
            CallingAgentTestCall.external_call_id.isnot(None)
        )
    )

    if last_id:
        query = query.filter(CallingAgentTestCall.id < last_id)

    test_calls = query.order_by(CallingAgentTestCall.id.desc()).limit(batch_size).all()
    
    org_map = defaultdict(list)
    
    for call in test_calls:
        org_id = call.agent.organization_id
        org_map[org_id].append(call)

   
    synced = 0
    failed = 0

    for org_id, calls in org_map.items():
        echolead_client = EcholeadsClient(org_id)
         
        for call in calls:
            try:
                sync_test_call_log(db, echolead_client, call.agent_id, call.external_call_id)
                synced += 1
            except Exception as exc:
                failed += 1

    # Return last processed ID to skip in next batch
    new_last_id = test_calls[-1].id if test_calls else None
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
    """Outcome daemon that never blocks event loop"""

    initial_delay = max(settings.OUTCOME_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = await asyncio.to_thread(
            run_outcome_processing_batches,
            batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
            max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
        )
        logger.info("Initial outcome processing completed: %s %s", processed, failed)
    except Exception as exc:
        logger.error("Initial outcome processing failed: %s", exc, exc_info=True)

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
            processed, failed = await asyncio.to_thread(
                run_outcome_processing_batches,
                batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
                max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Scheduled outcome processing completed: %s %s",
                processed,
                failed,
            )

        except Exception as exc:
            logger.error("Scheduled outcome processing failed: %s", exc, exc_info=True)
            
            
def run_call_campaign_processing_batches(batch_size: int, max_batches: int, organization_id: Optional[int] = None) -> Tuple[int, int]:
    total_processed = 0
    total_failed = 0

    db = SessionLocal()
    try:
        last_id = None
        test_last_id = None
        for _ in range(max_batches):
            synced, sync_failed, last_id  = process_call_campaigns_data(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
                last_id =last_id
            )
            processed, failed, test_last_id = process_test_call_data(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
                last_id=test_last_id
            )
            total_processed += synced
            total_failed += sync_failed + failed
            if synced == 0 and processed == 0:
                break
            
    finally:
        db.close()

    return total_processed, total_failed

async def run_daily_call_campaign_daemon(stop_event: asyncio.Event) -> None:
    """Call campaign daemon with non-blocking execution"""

    initial_delay = max(settings.OUTCOME_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = await asyncio.to_thread(
            run_call_campaign_processing_batches,
            batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
            max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
        )

        logger.info(
            "Initial call campaign processing completed: %s %s",
            processed,
            failed,
        )

    except Exception as exc:
        logger.error(
            "Initial call campaign processing failed: %s",
            exc,
            exc_info=True,
        )

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
            processed, failed = await asyncio.to_thread(
                run_call_campaign_processing_batches,
                batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
                max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
            )

            logger.info(
                "Scheduled call campaign processing completed: %s %s",
                processed,
                failed,
            )

        except Exception as exc:
            logger.error(
                "Scheduled call campaign processing failed: %s",
                exc,
                exc_info=True,
            )
            
     