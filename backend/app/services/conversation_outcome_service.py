import asyncio
from collections import defaultdict
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.models.call_logs import CallLog
from fastapi import HTTPException
from openai import OpenAI
from sqlalchemy import and_, exists, or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import SessionLocal
from app.models import Conversation, Lead, FunnelCategory

import logging

from app.models.call_campaigns import CallCampaign
from app.services.call_campaign_service import (
    add_contact_to_qualified_list,
    sync_campaign_from_echoleads,
)
from app.utils.echoleads_client import EcholeadsClient
from app.models.lead_contact_mapping import LeadContactMapping
from app.models.lead_activities import LeadActivity
from app.enums.credit_feature_codes import FeatureCodes
from app.services import organization_credit_service
from app.models.workflows import WorkflowExecution
from app.models.calling_agents import CallingAgent, CallingAgentTestCall
from app.services.call_log_service import (
    process_call_bookings,
    sync_test_call_log,
    process_workflow_scheduled_calls,
)
from app.models.conversation import ConversationEvaluation
from app.models.qualification_templates import QualificationTemplate
from app.models.widget_config import WidgetConfig
from app.services.qualification_engine_service import QualificationEngineService

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

EVALUATION_STATUS_EVALUATED = "evaluated"
EVALUATION_STATUS_SKIPPED_NO_CUSTOMER = "skipped_no_customer_message"
EVALUATION_STATUS_FAILED = "failed"


def _seconds_until_next_run(hour_utc: int, minute_utc: int) -> float:
    now = datetime.now(timezone.utc)
    target = now.replace(hour=hour_utc, minute=minute_utc, second=0, microsecond=0)
    if now >= target:
        target = target + timedelta(days=1)
    return max((target - now).total_seconds(), 1.0)


def _seconds_until_next_interval(interval_seconds: int) -> float:
    now = datetime.now(timezone.utc).timestamp()
    next_run = ((now // interval_seconds) + 1) * interval_seconds
    return max(next_run - now, 1.0)


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
                    # "- unresolved = customer has interest/problem/question but next action is pending or issue not closed.\n"
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


def _classify_funnel_stage_with_llm(
    transcript: str, categories: List[FunnelCategory]
) -> Optional[str]:
    if not transcript.strip() or not categories:
        return None

    valid_keys = {
        str(item.key).strip().lower() for item in categories if (item.key or "").strip()
    }
    if not valid_keys:
        return None

    category_lines = [
        f"- {item.key}: {item.name}" for item in categories if (item.key or "").strip()
    ]

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
    normalized = content.strip().lower().replace(" ", "_")
    if normalized in valid_keys:
        return normalized
    return None


def _build_evaluation_transcript(
    rows: List[Conversation],
    session_id: str,
) -> dict[str, Any]:

    if not rows:
        return {
            "conversation_transcript_id": str(session_id),
            "channel": "chat",
            "language": "en",
            "messages": [],
            "metadata": {},
        }

    source = (rows[0].source or "").lower()

    channel = "voice" if source == "voice" else "chat"

    messages = []

    for row in rows[:120]:

        timestamp = row.created_at.isoformat() if row.created_at else None

        if row.message and row.message.strip():
            messages.append(
                {
                    "speaker": "customer",
                    "text": row.message.strip(),
                    "timestamp": timestamp,
                    "metadata": {},
                }
            )

        if row.response and row.response.strip():
            messages.append(
                {
                    "speaker": "agent",
                    "text": row.response.strip(),
                    "timestamp": timestamp,
                    "metadata": {},
                }
            )

    return {
        "conversation_transcript_id": str(session_id),
        "channel": channel,
        "language": "en",
        "messages": messages,
        "metadata": {
            "source": source,
        },
    }


def _normalize_evaluation_result(
    evaluation: dict[str, Any],
) -> dict[str, Any]:

    qualified = bool(evaluation.get("qualified", False))

    outcome = _normalize_outcome(evaluation.get("outcome"))

    return {
        "outcome": outcome,
        "whether_lead": ("lead" if qualified else "not lead"),
        "qualified": qualified,
        "score": evaluation.get("score"),
        "temperature": evaluation.get("temperature"),
        "evaluation": evaluation,
    }


def _get_or_create_conversation_evaluation(
    db: Session,
    organization_id: int,
    session_id: str,
    template_id: Optional[int],
) -> ConversationEvaluation:

    query = db.query(ConversationEvaluation).filter(
        ConversationEvaluation.organization_id == organization_id,
        ConversationEvaluation.session_id == session_id,
    )

    if template_id is None:
        query = query.filter(ConversationEvaluation.template_id.is_(None))
    else:
        query = query.filter(ConversationEvaluation.template_id == template_id)

    evaluation_record = query.first()

    if evaluation_record:
        return evaluation_record

    evaluation_record = ConversationEvaluation(
        organization_id=organization_id,
        session_id=session_id,
        template_id=template_id,
    )

    db.add(evaluation_record)
    db.flush()

    return evaluation_record


async def _evaluate_conversation_with_engine(
    *,
    api_key: str,
    project_id: str,
    session_id: str,
    transcript: dict[str, Any],
    template_id: str,
    engine_template_payload: dict[str, Any],
) -> dict[str, Any]:

    if not api_key:
        raise RuntimeError("Qualification Engine API key is not configured")

    if not template_id:
        raise RuntimeError(
            "Qualification template is not synced with the Qualification Engine"
        )

    if not engine_template_payload:
        raise RuntimeError("Qualification Engine template payload is required")

    evaluation_request = {
        "project_id": project_id,
        "conversation_transcript_id": str(session_id),
        "transcript": transcript,
        "template": engine_template_payload,
        "template_id": str(template_id),
    }

    try:
        engine_service = QualificationEngineService()

        result = await engine_service.evaluate(
            api_key=api_key,
            project_id=project_id,
            conversation_transcript_id=str(session_id),
            transcript=transcript,
            template_id=str(template_id),
            template=engine_template_payload,
        )

        return result

    except Exception as exc:
        # Attach the request so the caller can persist it
        # if the Engine request fails.
        exc.evaluation_request = evaluation_request
        raise


def _has_customer_message(transcript: dict[str, Any]) -> bool:
    return any(
        (message.get("speaker") or "").lower() == "customer"
        and (message.get("text") or "").strip()
        for message in transcript.get("messages", [])
    )


async def process_pending_session_outcomes(
    db: Session,
    batch_size: int = 100,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:
    """Process pending session outcomes where conversation.outcome is NULL.

    Returns:
        Tuple[int, int]: (processed_count, failed_count)
    """

    pending_query = db.query(
        Conversation.organization_id,
        Conversation.session_id,
    ).filter(
        Conversation.session_id.isnot(None),
        Conversation.outcome.is_(None),
    )

    if organization_id is not None:
        pending_query = pending_query.filter(
            Conversation.organization_id == organization_id
        )

    pending_sessions = (
        pending_query.group_by(
            Conversation.organization_id,
            Conversation.session_id,
        )
        .limit(batch_size)
        .all()
    )

    processed = 0
    failed = 0

    funnel_categories_by_org: dict[int, List[FunnelCategory]] = {}

    for org_id, session_id in pending_sessions:

        try:
            # =========================================================
            # Load conversation rows
            # =========================================================

            rows = (
                db.query(Conversation)
                .filter(
                    Conversation.organization_id == org_id,
                    Conversation.session_id == session_id,
                )
                .order_by(Conversation.created_at.asc())
                .all()
            )

            if not rows:
                continue

            # =========================================================
            # Build transcript
            # =========================================================

            evaluation_transcript = _build_evaluation_transcript(
                rows,
                session_id,
            )

            # =========================================================
            # NO CUSTOMER MESSAGE
            #
            # Do not call Qualification Engine.
            # Do not consume credits.
            # =========================================================

            if not _has_customer_message(evaluation_transcript):

                logger.info(
                    "No customer message found for org=%s session=%s. "
                    "Marking conversation as negative without "
                    "Qualification Engine evaluation.",
                    org_id,
                    session_id,
                )

                outcome = "negative"
                whether_lead = "not lead"
                is_lead_value = 0

                # -----------------------------------------------------
                # Funnel stage
                # -----------------------------------------------------

                if org_id not in funnel_categories_by_org:
                    funnel_categories_by_org[org_id] = (
                        db.query(FunnelCategory)
                        .filter(
                            FunnelCategory.organization_id == org_id,
                            FunnelCategory.is_active == True,
                        )
                        .order_by(
                            FunnelCategory.position.asc(),
                            FunnelCategory.id.asc(),
                        )
                        .all()
                    )

                inferred_funnel_stage = FUNNEL_STAGE["CLOSED_LOST"]

                # -----------------------------------------------------
                # Update Conversations
                # -----------------------------------------------------

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

                # -----------------------------------------------------
                # Update LeadActivity
                # -----------------------------------------------------

                db.query(LeadActivity).filter(
                    LeadActivity.session_id == session_id,
                    LeadActivity.outcome.is_(None),
                ).update(
                    {
                        LeadActivity.outcome: outcome,
                    },
                    synchronize_session=False,
                )

                # -----------------------------------------------------
                # Update Lead
                # -----------------------------------------------------

                lead_rows = (
                    db.query(Lead)
                    .join(
                        LeadContactMapping,
                        LeadContactMapping.lead_id == Lead.id,
                    )
                    .join(
                        Conversation,
                        Conversation.contact_id == LeadContactMapping.contact_id,
                    )
                    .filter(
                        Conversation.organization_id == org_id,
                        Conversation.session_id == session_id,
                        Lead.organization_id == org_id,
                    )
                    .distinct(Lead.id)
                    .all()
                )

                for lead in lead_rows:
                    lead.lead_outcome = outcome

                    if not (lead.funnel_stage or "").strip():
                        lead.funnel_stage = inferred_funnel_stage

                # -----------------------------------------------------
                # Store skipped evaluation
                #
                # No template because Engine was never called.
                # -----------------------------------------------------

                evaluation_record = _get_or_create_conversation_evaluation(
                    db=db,
                    organization_id=org_id,
                    session_id=session_id,
                    template_id=None,
                )

                evaluation_record.engine_template_id = None
                evaluation_record.template_version = None
                evaluation_record.evaluation_id = None

                evaluation_record.evaluation_status = (
                    EVALUATION_STATUS_SKIPPED_NO_CUSTOMER
                )

                evaluation_record.qualified = False
                evaluation_record.outcome = "negative"
                evaluation_record.score = 0
                evaluation_record.temperature = None
                evaluation_record.evidence_level = "insufficient"

                evaluation_record.evaluation_request = None

                evaluation_record.evaluation_response = {
                    "evaluation_skipped": True,
                    "reason": ("No customer message found in conversation"),
                }

                evaluation_record.evaluation_error = None

                db.commit()

                processed += 1

                logger.info(
                    "No-response outcome resolved for "
                    "org=%s session=%s: outcome=%s whether_lead=%s",
                    org_id,
                    session_id,
                    outcome,
                    whether_lead,
                )

                continue

            # =========================================================
            # Validate credits
            # =========================================================

            valid = organization_credit_service.validate_feature_usage(
                db,
                org_id,
                FeatureCodes.AI_SENTIMENT,
                1,
            )

            if not valid:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Insufficient credits. Please add more credits " "to continue."
                    ),
                )

            # =========================================================
            # Resolve qualification template
            # =========================================================

            template = None

            source = (rows[0].source or "").lower()

            # ---------------------------------------------------------
            # Voice
            # ---------------------------------------------------------

            if source == "voice":

                call_log = (
                    db.query(CallLog)
                    .filter(
                        CallLog.call_session_id == session_id,
                        CallLog.organization_id == org_id,
                    )
                    .order_by(CallLog.created_at.desc())
                    .first()
                )

                if call_log and call_log.campaign_id:

                    campaign = (
                        db.query(CallCampaign)
                        .filter(
                            CallCampaign.id == call_log.campaign_id,
                            CallCampaign.organization_id == org_id,
                            CallCampaign.is_deleted == False,
                        )
                        .first()
                    )

                    if campaign:

                        effective_template_id = campaign.qualification_template_id or (
                            campaign.agent.qualification_template_id
                            if campaign.agent
                            else None
                        )

                        if effective_template_id:

                            template = (
                                db.query(QualificationTemplate)
                                .filter(
                                    QualificationTemplate.id == effective_template_id,
                                    QualificationTemplate.organization_id == org_id,
                                )
                                .first()
                            )
                # INBOUND
                else:

                    calling_agent = None

                    if call_log.agent_id:
                        calling_agent = (
                            db.query(CallingAgent)
                            .filter(
                                CallingAgent.id == call_log.agent_id,
                                CallingAgent.organization_id == org_id,
                            )
                            .first()
                        )

                    if calling_agent and calling_agent.qualification_template_id:

                        template = (
                            db.query(QualificationTemplate)
                            .filter(
                                QualificationTemplate.id
                                == calling_agent.qualification_template_id,
                                QualificationTemplate.organization_id == org_id,
                            )
                            .first()
                        )

            # ---------------------------------------------------------
            # Chat / Widget
            # ---------------------------------------------------------

            else:

                widget_id = rows[0].widget_id

                if widget_id:

                    widget = (
                        db.query(WidgetConfig)
                        .filter(
                            WidgetConfig.widget_id == widget_id,
                            WidgetConfig.organization_id == org_id,
                        )
                        .first()
                    )

                    if widget and widget.qualification_template_id:

                        template = (
                            db.query(QualificationTemplate)
                            .filter(
                                QualificationTemplate.id
                                == widget.qualification_template_id,
                                QualificationTemplate.organization_id == org_id,
                            )
                            .first()
                        )

            # =========================================================
            # Validate template
            # =========================================================

            if not template:
                raise RuntimeError(
                    "No qualification template configured for "
                    f"organization={org_id}, session={session_id}"
                )

            if not template.engine_template_id:
                raise RuntimeError(
                    f"Qualification template '{template.name}' "
                    "is not synced with the Qualification Engine"
                )

            # =========================================================
            # Qualification Engine evaluation
            # =========================================================

            try:
                engine_service = QualificationEngineService()

                api_key = engine_service.get_api_key(
                    db,
                    org_id,
                )

                engine_template_payload = engine_service.build_engine_template_payload(
                    template
                )

                # Release DB connection before external HTTP call.
                db.commit()
                db.close()

                evaluation_result = await _evaluate_conversation_with_engine(
                    api_key=api_key,
                    project_id=f"org_{org_id}_qualification",
                    session_id=str(session_id),
                    transcript=evaluation_transcript,
                    template_id=str(template.engine_template_id),
                    engine_template_payload=engine_template_payload,
                )

                db = SessionLocal()

                evaluation_request = evaluation_result["request"]
                evaluation = evaluation_result["response"]

            except Exception as exc:

                logger.error(
                    "Qualification Engine evaluation failed "
                    "for org=%s session=%s: %s",
                    org_id,
                    session_id,
                    str(exc),
                    exc_info=True,
                )

                # -----------------------------------------------------
                # IMPORTANT:
                #
                # Roll back the current transaction first.
                # This removes any pending DB changes but leaves the
                # Engine request available from the exception.
                # -----------------------------------------------------

                db.rollback()

                evaluation_request = getattr(
                    exc,
                    "evaluation_request",
                    None,
                )

                # -----------------------------------------------------
                # Store failed Engine evaluation.
                #
                # Because the unique constraint is:
                #
                # organization_id + session_id + template_id
                #
                # we UPDATE an existing record instead of blindly
                # INSERTing another one.
                # -----------------------------------------------------

                evaluation_record = _get_or_create_conversation_evaluation(
                    db=db,
                    organization_id=org_id,
                    session_id=session_id,
                    template_id=template.id,
                )

                evaluation_record.engine_template_id = str(template.engine_template_id)

                evaluation_record.template_version = str(template.version)

                evaluation_record.evaluation_id = None

                evaluation_record.evaluation_status = EVALUATION_STATUS_FAILED

                evaluation_record.qualified = None
                evaluation_record.outcome = None
                evaluation_record.score = None
                evaluation_record.temperature = None
                evaluation_record.evidence_level = None

                evaluation_record.evaluation_request = evaluation_request

                evaluation_record.evaluation_response = None

                evaluation_record.evaluation_error = str(exc)

                db.commit()

                failed += 1

                continue

            # =========================================================
            # Store successful Engine response
            #
            # UPSERT instead of INSERT because the session/template
            # combination is unique.
            # =========================================================

            evaluation_record = _get_or_create_conversation_evaluation(
                db=db,
                organization_id=org_id,
                session_id=session_id,
                template_id=template.id,
            )

            evaluation_record.engine_template_id = str(template.engine_template_id)

            evaluation_record.template_version = str(template.version)

            evaluation_record.evaluation_id = evaluation.get("evaluation_id")

            evaluation_record.evaluation_status = EVALUATION_STATUS_EVALUATED

            evaluation_record.qualified = bool(evaluation.get("qualified", False))

            evaluation_record.outcome = evaluation.get("outcome")

            evaluation_record.score = evaluation.get("score")

            evaluation_record.temperature = evaluation.get("temperature")

            evaluation_record.evidence_level = evaluation.get("evidence_level")

            evaluation_record.evaluation_request = evaluation_request

            evaluation_record.evaluation_response = evaluation

            evaluation_record.evaluation_error = None

            db.flush()

            # =========================================================
            # Normalize Engine result
            # =========================================================

            classification = _normalize_evaluation_result(evaluation)

            outcome = classification["outcome"]

            whether_lead = classification["whether_lead"]

            is_lead_value = 1 if whether_lead == "lead" else 0

            # =========================================================
            # Add contact to qualified list for voice calls
            #
            # Qualification Engine is now the source of truth for
            # whether the contact is qualified.
            # =========================================================

            if source == "voice" and is_lead_value == 1:

                call_log = (
                    db.query(CallLog)
                    .filter(
                        CallLog.call_session_id == session_id,
                        CallLog.organization_id == org_id,
                    )
                    .order_by(CallLog.created_at.desc())
                    .first()
                )

                if call_log and call_log.contact_id and call_log.campaign_id:

                    campaign = (
                        db.query(CallCampaign)
                        .filter(
                            CallCampaign.id == call_log.campaign_id,
                            CallCampaign.organization_id == org_id,
                            CallCampaign.is_deleted == False,
                        )
                        .first()
                    )

                    if campaign:

                        add_contact_to_qualified_list(
                            db=db,
                            organization_id=org_id,
                            campaign=campaign,
                            contact_id=call_log.contact_id,
                        )

            # =========================================================
            # Deduct credit only after successful Engine evaluation
            # =========================================================

            organization_credit_service.deduct_credits(
                db=db,
                organization_id=org_id,
                feature_code=FeatureCodes.AI_SENTIMENT,
                quantity=1,
                reference_type="conversation",
                reference_id=session_id,
            )

            # =========================================================
            # Load funnel categories
            # =========================================================

            if org_id not in funnel_categories_by_org:

                funnel_categories_by_org[org_id] = (
                    db.query(FunnelCategory)
                    .filter(
                        FunnelCategory.organization_id == org_id,
                        FunnelCategory.is_active == True,
                    )
                    .order_by(
                        FunnelCategory.position.asc(),
                        FunnelCategory.id.asc(),
                    )
                    .all()
                )

            # =========================================================
            # Resolve funnel stage
            # =========================================================

            inferred_funnel_stage = (
                FUNNEL_STAGE["LEAD_QUALIFICATION"]
                if is_lead_value
                else (
                    FUNNEL_STAGE["CLOSED_LOST"]
                    if (outcome or "").lower() not in (None, "")
                    else FUNNEL_STAGE["UNASSIGNED"]
                )
            )

            # =========================================================
            # Update Conversations
            # =========================================================

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

            # =========================================================
            # Update LeadActivity
            # =========================================================

            db.query(LeadActivity).filter(
                LeadActivity.session_id == session_id,
                LeadActivity.outcome.is_(None),
            ).update(
                {
                    LeadActivity.outcome: outcome,
                },
                synchronize_session=False,
            )

            # =========================================================
            # Update Lead
            # =========================================================

            lead_rows = (
                db.query(Lead)
                .join(
                    LeadContactMapping,
                    LeadContactMapping.lead_id == Lead.id,
                )
                .join(
                    Conversation,
                    Conversation.contact_id == LeadContactMapping.contact_id,
                )
                .filter(
                    Conversation.organization_id == org_id,
                    Conversation.session_id == session_id,
                    Lead.organization_id == org_id,
                )
                .distinct(Lead.id)
                .all()
            )

            for lead in lead_rows:

                lead.lead_outcome = outcome

                if inferred_funnel_stage and not (lead.funnel_stage or "").strip():
                    lead.funnel_stage = inferred_funnel_stage

            # =========================================================
            # Log
            # =========================================================

            logger.info(
                "Outcome classification resolved for "
                "org=%s session=%s: outcome=%s "
                "whether_lead=%s evaluation_id=%s",
                org_id,
                session_id,
                outcome,
                whether_lead,
                evaluation.get("evaluation_id"),
            )

            # =========================================================
            # Commit everything
            # =========================================================

            db.commit()

            processed += 1

        except Exception as exc:

            db.rollback()

            failed += 1

            logger.error(
                "Failed to process outcome for " "org=%s session=%s: %s",
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
    """Backfill Lead.lead_outcome from the latest LeadActivity outcome."""

    lead_query = db.query(Lead.id, Lead.organization_id).filter(
        Lead.lead_outcome.is_(None)
    )

    if organization_id is not None:
        lead_query = lead_query.filter(Lead.organization_id == organization_id)

    pending_leads = lead_query.limit(batch_size).all()

    synced = 0
    failed = 0

    for lead_id, org_id in pending_leads:
        try:

            # Get the latest activity having a valid outcome.
            latest_activity = (
                db.query(LeadActivity)
                .filter(
                    LeadActivity.lead_id == lead_id,
                    LeadActivity.outcome.isnot(None),
                    LeadActivity.outcome != "",
                )
                .order_by(
                    LeadActivity.activity_datetime.desc(),
                    LeadActivity.id.desc(),
                )
                .first()
            )

            if not latest_activity:
                continue

            normalized_outcome = _normalize_outcome(latest_activity.outcome)

            if not normalized_outcome:
                continue

            updated_rows = (
                db.query(Lead)
                .filter(
                    Lead.id == lead_id,
                    Lead.organization_id == org_id,
                    Lead.lead_outcome.is_(None),
                )
                .update(
                    {
                        Lead.lead_outcome: normalized_outcome,
                    },
                    synchronize_session=False,
                )
            )

            if updated_rows:
                synced += 1

            db.commit()

        except Exception as exc:
            db.rollback()
            failed += 1

            logger.error(
                "Failed to backfill lead outcome: lead_id=%s org=%s: %s",
                lead_id,
                org_id,
                str(exc),
                exc_info=True,
            )

    return synced, failed


def process_pending_lead_funnel_tags(
    db: Session,
    batch_size: int = 100,
    organization_id: Optional[int] = None,
) -> Tuple[int, int]:
    """Backfill lead.funnel_stage using the same logic as
    process_pending_session_outcomes().
    """

    lead_query = db.query(
        Lead.organization_id,
        Lead.id,
    ).filter(
        or_(
            Lead.funnel_stage.is_(None),
            Lead.funnel_stage == "",
        )
    )

    if organization_id is not None:
        lead_query = lead_query.filter(Lead.organization_id == organization_id)

    pending_leads = lead_query.limit(batch_size).all()

    tagged = 0
    failed = 0

    for org_id, lead_id in pending_leads:
        try:
            # ---------------------------------------------------------
            # Find the latest LeadActivity/session for this lead
            # ---------------------------------------------------------
            latest_activity = (
                db.query(LeadActivity)
                .filter(
                    LeadActivity.lead_id == lead_id,
                    LeadActivity.session_id.isnot(None),
                    LeadActivity.session_id != "",
                )
                .order_by(
                    LeadActivity.activity_datetime.desc(),
                    LeadActivity.id.desc(),
                )
                .first()
            )

            if not latest_activity:
                continue

            session_id = latest_activity.session_id

            # ---------------------------------------------------------
            # Get conversations for EXACT session
            # ---------------------------------------------------------
            rows = (
                db.query(Conversation)
                .filter(
                    Conversation.organization_id == org_id,
                    Conversation.session_id == session_id,
                )
                .order_by(Conversation.created_at.asc())
                .all()
            )

            if not rows:
                continue

            # ---------------------------------------------------------
            # Same logic as process_pending_session_outcomes()
            # ---------------------------------------------------------

            # Use the session's resolved is_lead value.
            #
            # Since process_pending_session_outcomes() updates ALL
            # conversations in this session with the same is_lead,
            # taking the latest non-null value is safe.
            classified_row = (
                db.query(Conversation)
                .filter(
                    Conversation.organization_id == org_id,
                    Conversation.session_id == session_id,
                    Conversation.is_lead.isnot(None),
                )
                .order_by(Conversation.created_at.desc())
                .first()
            )

            # If is_lead hasn't been populated yet, use the latest
            # conversation outcome if available.
            if classified_row:
                is_lead_value = int(classified_row.is_lead)
            else:
                is_lead_value = 0

            # Get the resolved outcome for this session.
            latest_outcome_row = (
                db.query(Conversation)
                .filter(
                    Conversation.organization_id == org_id,
                    Conversation.session_id == session_id,
                    Conversation.outcome.isnot(None),
                    Conversation.outcome != "",
                )
                .order_by(Conversation.created_at.desc())
                .first()
            )

            outcome = latest_outcome_row.outcome if latest_outcome_row else ""

            # ---------------------------------------------------------
            # EXACT SAME FUNNEL LOGIC
            # ---------------------------------------------------------
            inferred_funnel_stage = (
                FUNNEL_STAGE["LEAD_QUALIFICATION"]
                if is_lead_value
                else (
                    FUNNEL_STAGE["CLOSED_LOST"]
                    if (outcome or "").lower() not in (None, "")
                    else FUNNEL_STAGE["UNASSIGNED"]
                )
            )

            # ---------------------------------------------------------
            # Update only missing funnel stage
            # ---------------------------------------------------------
            updated_rows = (
                db.query(Lead)
                .filter(
                    Lead.organization_id == org_id,
                    Lead.id == lead_id,
                    or_(
                        Lead.funnel_stage.is_(None),
                        Lead.funnel_stage == "",
                    ),
                )
                .update(
                    {
                        Lead.funnel_stage: inferred_funnel_stage,
                    },
                    synchronize_session=False,
                )
            )

            db.commit()

            if updated_rows:
                tagged += 1

                logger.info(
                    "Funnel stage updated: lead_id=%s stage=%s",
                    lead_id,
                    inferred_funnel_stage,
                )

        except Exception as exc:
            db.rollback()
            failed += 1

            logger.error(
                "Failed to backfill funnel stage for org=%s lead_id=%s: %s",
                org_id,
                lead_id,
                str(exc),
                exc_info=True,
            )

    return tagged, failed


async def run_outcome_processing_batches(
    batch_size: int, max_batches: int, organization_id: Optional[int] = None
) -> Tuple[int, int]:
    total_processed = 0
    total_failed = 0

    db = SessionLocal()
    try:
        for _ in range(max_batches):
            processed, failed = await process_pending_session_outcomes(
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


def run_outcome_processing_batches_in_thread(
    batch_size: int,
    max_batches: int,
):
    return asyncio.run(
        run_outcome_processing_batches(
            batch_size=batch_size,
            max_batches=max_batches,
        )
    )


async def run_daily_outcome_daemon(stop_event: asyncio.Event) -> None:
    """Outcome daemon that never blocks event loop"""

    initial_delay = max(settings.OUTCOME_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = await asyncio.to_thread(
            run_outcome_processing_batches_in_thread,
            batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
            max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
        )

        logger.info("Initial outcome processing completed: %s %s", processed, failed)
    except Exception as exc:
        logger.error("Initial outcome processing failed: %s", exc, exc_info=True)

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_interval(
            settings.OUTCOME_DAEMON_INTERVAL_SECONDS
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = await asyncio.to_thread(
                run_outcome_processing_batches_in_thread,
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
