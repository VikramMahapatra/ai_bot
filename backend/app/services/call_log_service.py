import asyncio
from datetime import date, datetime, time, timedelta, timezone
import json
import logging
import random
import re
import threading
from typing import Optional, Tuple, Union
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks
from psycopg2 import IntegrityError
from sqlalchemy import (
    Integer,
    String,
    and_,
    case,
    cast,
    distinct,
    exists,
    func,
    literal_column,
    or_,
    select,
    true,
)

from app.models.call_logs import CallLog, CallTranscript
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB
from app.models.calling_agents import CallingAgent, CallingAgentTestCall
from app.models.lead import Lead
from app.schemas.call_log import CallLogCreate, CallLogRequest, MoveToFunnelRequest
from app.utils.echoleads_client import EcholeadsClient
from app.models.call_campaigns import CallCampaign
from app.models.campaign import Contact
from app.config import settings
from app.models.conversation import Conversation
from app.enums.credit_feature_codes import FeatureCodes
from app.enums.credit_feature_codes import FeatureCodes
from app.services import organization_credit_service
from app.services.conversation_decision_service import analyze_conversation
from app.services.sms_service import (
    get_twilio_sms_config,
    send_instant_campaign_sms_using_twilio,
    send_sms,
)
from app.services.email_service import send_campaign_email
from app.models.call_campaign_instant_replies import CallCampaignInstantReply
from app.services.organization_setting_service import get_org_settings
from app.models.whatsapp_channel import WhatsAppChannel
from app.services.whatsapp_service import send_whatsapp_text_message
from app.models.lead_activities import LeadActivity
from app.models.lead_contact_mapping import LeadContactMapping
from app.models.workflows import (
    WorkflowEdge,
    WorkflowExecution,
    WorkflowExecutionLog,
    WorkflowScheduledCall,
    WorkflowStep,
    WorkflowStepOutcome,
)
from app.models.message_templates import MessageTemplate
from app.services.report_service import (
    sync_conversation_metrics,
    sync_voice_metrics_from_conversation,
)
from app.models.campaign_contacts import CampaignContact
from app.services import organization_channel_service
from app.database import SessionLocal
from app.models.instant_reply_logs import InstantReplyChannelLog, InstantReplyLog
from app.models.channels import Channel, ChannelReservation, OrganizationChannel

LEAD_QUALITY_RANGES = {
    "High": (80, 100),
    "Medium": (50, 79),
    "Low": (20, 49),
    "Poor": (0, 19),
}

NORMALIZED_SOURCES = {
    "reschedule_call": "rescheduled_call",
}

logger = logging.getLogger(__name__)


def get_call_logs(
    background_tasks: BackgroundTasks,
    db: Session,
    organization_id: int,
    params: CallLogRequest,
):
    ### SYNC WITH ECHOLEADS

    background_tasks.add_task(
        sync_call_logs,
        db,
        organization_id,
        params.campaign_id,
        params.from_date,
        params.end_date,
        params.agent_id,
    )

    conversation_subq = (
        select(Conversation)
        .where(Conversation.session_id == CallLog.call_session_id)
        .order_by(Conversation.created_at.desc())
        .limit(1)
        .lateral()
        .alias("conversation_subq")
    )

    follow_up_subq = (
        db.query(
            CallLog.contact_id.label("fu_contact_id"),
            func.count(WorkflowExecutionLog.id).label("follow_up_count"),
        )
        .join(WorkflowExecution, WorkflowExecution.contact_id == CallLog.contact_id)
        .join(
            WorkflowExecutionLog,
            WorkflowExecution.id == WorkflowExecutionLog.execution_id,
        )
        .filter(
            CallLog.source == "campaign_call",  # ✅ only campaign calls
        )
        .group_by(CallLog.contact_id)
    ).subquery()

    query = (
        db.query(
            CallLog,
            Contact.name.label("contact_name"),
            CallingAgent.name.label("agent_name"),
            CallCampaign.name.label("campaign_name"),
            conversation_subq.c.outcome.label("call_outcome"),
            follow_up_subq.c.follow_up_count,
        )
        .outerjoin(Contact, Contact.id == CallLog.contact_id)
        .outerjoin(CallingAgent, CallingAgent.id == CallLog.agent_id)
        .outerjoin(CallCampaign, CallCampaign.id == CallLog.campaign_id)
        .outerjoin(conversation_subq, true())
        .outerjoin(follow_up_subq, follow_up_subq.c.fu_contact_id == CallLog.contact_id)
        .filter(CallLog.organization_id == organization_id)
    )

    if params.agent_id:
        query = query.filter(CallLog.agent_id == params.agent_id)

    if params.campaign_id:
        query = query.filter(CallLog.campaign_id == params.campaign_id)

    # SEARCH
    if params.search:
        query = query.filter(
            or_(
                Contact.name.ilike(f"%{params.search}%"),
                CallingAgent.name.ilike(f"%{params.search}%"),
                CallCampaign.name.ilike(f"%{params.search}%"),
                CallLog.status.ilike(f"%{params.search}%"),
                CallLog.type.ilike(f"%{params.search}%"),
            )
        )

    # FROM DATE → start of day
    if params.from_date:
        from_datetime = datetime.combine(params.from_date, time.min)
        query = query.filter(CallLog.start_time >= from_datetime)

    # END DATE → end of day
    if params.end_date:
        end_datetime = datetime.combine(params.end_date, time.max)
        query = query.filter(CallLog.start_time <= end_datetime)

    # STATUS FILTER
    if params.status:
        query = query.filter(CallLog.status == params.status)

    # CALL END REASON
    if params.call_end_reason:
        query = query.filter(CallLog.ended_reason == params.call_end_reason)

    # SENTIMENT
    if params.sentiment:
        query = query.filter(
            exists().where(
                and_(
                    Conversation.session_id == CallLog.call_session_id,
                    func.lower(func.trim(Conversation.outcome))
                    == params.sentiment.lower(),
                )
            )
        )

    # EVALUATION (boolean)
    if params.evaluation is not None:
        query = query.filter(CallLog.success_evaluation == params.evaluation)

    if params.lead_quality:
        lead_rate = cast(CallLog.lead_info["lead_quality"]["rate"].astext, Integer)

        min_val, max_val = LEAD_QUALITY_RANGES[params.lead_quality]

        query = query.filter(lead_rate.between(min_val, max_val))

    if params.is_lead_qualified is not None:
        query = query.filter(conversation_subq.c.is_lead == params.is_lead_qualified)

    # TOTAL COUNT
    transcript_exists = (
        db.query(CallTranscript.id)
        .filter(CallTranscript.call_log_id == CallLog.id)
        .exists()
    )

    summary = query.with_entities(
        func.count(distinct(CallLog.id)).label("total_calls"),
        func.count(distinct(case((CallLog.campaign_id != None, CallLog.id)))).label(
            "campaign_calls"
        ),
        func.count(distinct(case((CallLog.campaign_id == None, CallLog.id)))).label(
            "test_calls"
        ),
        func.count(distinct(case((transcript_exists, CallLog.id)))).label(
            "successful_calls"
        ),
    ).first()

    # PAGINATION
    if params.skip is not None and params.limit is not None:
        logs = (
            query.order_by(CallLog.created_at.desc())
            .offset(params.skip)
            .limit(params.limit)
            .all()
        )
    else:
        # Export case → fetch all
        logs = query.order_by(CallLog.created_at.desc()).all()

    rows = []

    for (
        log,
        contact_name,
        agent_name,
        campaign_name,
        lead_outcome,
        follow_up_count,
    ) in logs:

        transcripts = (
            db.query(CallTranscript)
            .filter(CallTranscript.call_log_id == log.id)
            .order_by(CallTranscript.created_at.asc())
            .all()
        )

        # duration in seconds
        duration = log.duration or 0

        # Determine lead status for grid
        is_lead = (
            db.query(Conversation.is_lead)
            .filter(
                Conversation.session_id == log.call_session_id,
                Conversation.organization_id == organization_id,
                Conversation.outcome.isnot(None),
            )
            .order_by(Conversation.created_at.desc())
            .limit(1)
            .scalar()
        )

        lead_status = {
            True: "positive",
            False: "negative",
        }.get(is_lead, "pending" if campaign_name and lead_outcome else "")

        instant_log = (
            db.query(InstantReplyLog)
            .filter(InstantReplyLog.call_log_id == log.id)
            .order_by(InstantReplyLog.created_at.asc())
            .first()
        )

        instant_reply_data = None

        if instant_log:
            instant_reply_data = {
                "decision": instant_log.decision,
                "status": instant_log.status,
                "error": instant_log.error,
                "created_at": (
                    instant_log.created_at.isoformat()
                    if instant_log.created_at
                    else None
                ),
                "channels": [
                    {
                        "channel": ch.channel,
                        "status": ch.status,
                        "error": ch.error,
                        "created_at": (
                            ch.created_at.isoformat() if ch.created_at else None
                        ),
                    }
                    for ch in instant_log.channel_logs
                ],
            }

        is_follow_up = log.source == "rescheduled_call"

        rows.append(
            {
                "id": log.id,
                "contact_id": log.contact_id,
                "contact": contact_name,
                "agent": agent_name,
                "campaign": campaign_name,
                "type": log.type,
                "mode": log.mode,
                "phone": log.phone,
                "status": log.status,
                "date": log.created_at.replace(tzinfo=timezone.utc).isoformat(),
                "startTime": log.start_time.replace(tzinfo=timezone.utc).isoformat(),
                "endTime": (
                    log.end_time.replace(tzinfo=timezone.utc).isoformat()
                    if log.end_time
                    else None
                ),
                "duration": duration,
                "industry": log.industry,
                "cost": float(log.cost) if log.cost else 0,
                "audioUrl": log.audio_url,
                # test call logic
                "testCall": False if log.campaign_id else True,
                "ended_reason": log.ended_reason,
                "call_summary": log.call_summary,
                "sentiment": lead_outcome if lead_outcome and log.campaign_id else "",
                "follow_up_recommended": log.follow_up_recommended or [],
                "extract_data": log.extract_data or {},
                "lead_info": log.lead_info or {},
                "lead_qualified_status": lead_status,
                "transcript": [
                    {"speaker": t.speaker, "text": t.text} for t in transcripts
                ],
                "follow_up_count": (
                    0 if is_follow_up else max(int(follow_up_count or 0), 0)
                ),
                "source": log.source,
                "instant_reply": instant_reply_data,
            }
        )

    return {
        "items": rows,
        "summary": {
            "total_calls": summary.total_calls or 0,
            "campaign_calls": summary.campaign_calls or 0,
            "test_calls": summary.test_calls or 0,
            "successful_calls": summary.successful_calls or 0,
        },
        "pagination": {
            "total": summary.total_calls or 0,
            "skip": params.skip,
            "limit": params.limit,
        },
    }


def get_contacts_by_type(
    db: Session,
    organization_id: int,
    campaign_id: int,
    type: str,  # all | initiated | rescheduled | pending
):
    # Base query: all contacts mapped to campaign
    query = (
        db.query(
            Contact.id.label("contact_id"),
            Contact.phone,
            Contact.name,
            Contact.email,
            CallLog.status,
            CallLog.ended_reason,
            CallLog.created_at,
        )
        .join(CampaignContact, CampaignContact.contact_id == Contact.id)
        .join(CallCampaign, CallCampaign.id == CampaignContact.campaign_id)
        .outerjoin(
            CallLog,
            and_(CallLog.contact_id == Contact.id, CallLog.campaign_id == campaign_id),
        )
        .filter(
            CallCampaign.id == campaign_id,
            CallCampaign.organization_id == organization_id,
        )
    )

    # ----------------------------
    # TYPE FILTERS
    # ----------------------------

    if type == "initiated":
        # call attempted → call_log exists
        query = query.filter(CallLog.id.isnot(None), CallLog.source == "campaign_call")

    elif type == "rescheduled":
        query = query.filter(
            and_(CallLog.id.isnot(None), CallLog.source == "rescheduled_call")
        )

    elif type == "pending":
        # no call attempted
        query = query.filter(CallLog.id.is_(None))

    results = query.all()

    return [
        {
            "contact_id": r.contact_id,
            "phone": r.phone,
            "name": r.name,
            "email": r.email,
            "status": r.status,
            "ended_reason": r.ended_reason,
            "date": (
                r.created_at.replace(tzinfo=timezone.utc).isoformat()
                if r.created_at
                else None
            ),
        }
        for r in results
    ]


def create_call_log(db: Session, data: CallLogCreate):

    call = CallLog(
        contact_id=data.contact_id,
        agent_id=data.agent_id,
        campaign_id=data.campaign_id,
        type=data.type,
        mode=data.mode,
        status=data.status,
        industry=data.industry,
        start_time=data.start_time,
        end_time=data.end_time,
        audio_url=data.audio_url,
    )

    db.add(call)
    db.flush()

    for t in data.transcript:
        db.add(CallTranscript(call_log_id=call.id, speaker=t.speaker, text=t.text))

    db.commit()

    return {"message": "Call log created"}


def trigger_outcome_processing(organization_id: int):
    from app.services.conversation_outcome_service import run_outcome_processing_batches

    run_outcome_processing_batches(
        batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
        max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
        organization_id=organization_id,
    )


def sync_test_call_log(
    db: Session, client: EcholeadsClient, agent_id: int, external_call_id: str
):
    total_calls = 0

    try:
        print("Syncing Test Calls WITH agent_id (direct agent mode)")

        agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

        if not agent:
            print("Agent not found")
            return

        from_date, to_date = get_default_dates()

        response = client.fetch_test_calls(
            agent_id=agent.external_agent_id,
            from_date=from_date.isoformat(),
            to_date=to_date.isoformat(),
        )

        calls = response.get("calls", [])

        for call in calls:
            if external_call_id == call["call_id"] or external_call_id == call["id"]:
                process_call(call, agent)

        db.commit()

    except Exception as e:
        db.rollback()
        print(f"Sync Test Call failed: {str(e)}")


def sync_call_logs(
    db: Session,
    organization_id: int,
    campaign_id=None,
    from_date=None,
    to_date=None,
    agent_id=None,
):
    client = EcholeadsClient(organization_id)
    total_calls = 0

    try:
        if agent_id:
            print("Syncing WITH agent_id (direct agent mode)")

            agent = (
                db.query(CallingAgent)
                .filter(
                    CallingAgent.id == agent_id,
                    CallingAgent.organization_id == organization_id,
                )
                .first()
            )

            if not agent:
                print("Agent not found")
                return

            from_date, to_date = get_default_dates(from_date, to_date)

            response = client.fetch_calls(
                agent_id=agent.external_agent_id,
                from_date=from_date.isoformat(),
                to_date=to_date.isoformat(),
            )

            calls = response.get("calls", [])

            for call in calls:
                process_call(call, agent)

        elif campaign_id or (from_date and to_date):

            if campaign_id:
                print("Syncing WITH campaign_id (campaign wise mode)")
                campaign = (
                    db.query(CallCampaign)
                    .filter(CallCampaign.id == campaign_id)
                    .first()
                )

                response = []
                if campaign.external_campaign_id:
                    response = client.fetch_campaign_calls(
                        campaign.external_campaign_id
                    )
            else:
                print("Syncing WITH dates (date range wise mode)")
                from_date, to_date = get_default_dates(from_date, to_date)
                response = client.fetch_calls(
                    agent_id=None,  # 👈 ignore
                    from_date=from_date.isoformat(),
                    to_date=to_date.isoformat(),
                )

            calls = response.get("calls", [])

            for call in calls:
                total_calls += 1
                call_start = parse_datetime(call.get("created_at"))
                if not call_start:
                    continue

                agent = (
                    db.query(CallingAgent)
                    .filter(
                        CallingAgent.external_agent_a_id == call.get("a_id"),
                        CallingAgent.organization_id == organization_id,
                    )
                    .first()
                )

                if not agent:
                    continue
                process_call(call, agent)
        else:
            print("Syncing WITH default (date-wise mode)")
            from_date, to_date = get_default_dates(from_date, to_date)

            agents = (
                db.query(CallingAgent)
                .filter(
                    CallingAgent.external_agent_id.isnot(None),
                    CallingAgent.is_deleted == False,
                    CallingAgent.organization_id == organization_id,
                )
                .all()
            )

            for agent in agents:
                response = client.fetch_calls(
                    agent_id=agent.external_agent_id,
                    from_date=from_date.isoformat(),
                    to_date=to_date.isoformat(),
                )

                calls = response.get("calls", [])
                for call in calls:
                    process_call(call, agent)

        db.commit()

        trigger_outcome_processing(organization_id)

    except Exception as e:
        db.rollback()
        print(f"Sync failed: {str(e)}")


def process_call(call, agent):
    db = SessionLocal()
    try:
        call_created_at = parse_datetime(call.get("created_at"))
        if not call_created_at:
            return

        existing = (
            db.query(CallLog).filter(CallLog.external_call_id == call["id"]).first()
        )

        campaign = None
        contact = None
        call_log = None
        normalized_transcript = None

        if not existing or existing.status != "ended":
            campaign_external_id = call["campaign_id"]

            if campaign_external_id:
                campaign = (
                    db.query(CallCampaign)
                    .filter(CallCampaign.external_campaign_id == campaign_external_id)
                    .first()
                )

            contact = None
            external_contact_id = call.get("contact_id")

            if campaign and external_contact_id:
                campaign_contact = (
                    db.query(CampaignContact)
                    .join(Contact, CampaignContact.contact_id == Contact.id)
                    .filter(
                        CampaignContact.campaign_id == campaign.id,
                        Contact.external_contact_id == external_contact_id,
                    )
                    .first()
                )

                if campaign_contact:
                    contact = campaign_contact.contact

            # Prepare common values
            duration = int(call.get("duration")) if call.get("duration") else None
            ended_reason = call.get("ended_reason")
            call_summary = call.get("call_summary")
            sentiment = call.get("sentiment")
            follow_up_recommended = call.get("follow_up_recommended")
            extract_data = call.get("extract_data")
            lead_info = call.get("lead_info")
            success_eval_str = (
                call.get("success_evaluation")
                if call.get("success_evaluation")
                else "false"
            )
            source = (call.get("source") or "").strip().lower()
            call_start = parse_datetime(call.get("call_started_at"))

            # convert extract_data if string
            if isinstance(extract_data, str):
                try:
                    extract_data = json.loads(extract_data)
                except:
                    extract_data = None

            if existing:
                new_status = call.get("status").lower() if call.get("status") else None
                existing.organization_id = agent.organization_id
                existing.external_call_a_id = call.get("call_id")
                existing.agent_id = agent.id
                existing.campaign_id = campaign.id if campaign else None
                existing.contact_id = contact.id if contact else None
                existing.type = agent.type
                existing.mode = "Voice"
                existing.phone = call.get("phone")
                existing.status = (
                    call.get("status").lower()
                    if call.get("status")
                    else existing.status
                )

                existing.start_time = call_start
                existing.end_time = parse_datetime(call.get("call_ended_at"))
                existing.audio_url = call.get("recording_url")
                existing.cost = float(call.get("cost")) if call.get("cost") else None

                existing.duration = duration
                existing.ended_reason = ended_reason
                existing.call_summary = call_summary
                existing.sentiment = sentiment
                existing.follow_up_recommended = follow_up_recommended
                existing.extract_data = extract_data
                existing.lead_info = lead_info
                existing.source = NORMALIZED_SOURCES.get(source, source)
                existing.success_evaluation = success_eval_str.lower() == "true"
                if new_status:
                    if existing.status != "ended" or new_status == "ended":
                        existing.status = new_status

                db.commit()

                normalized_transcript = save_transcripts(
                    db, existing, call.get("transcript")
                )
                call_log = existing
            else:
                call_session_id = f"session_{int(datetime.utcnow().timestamp()*1000)}_{random.randint(1000,9999)}"
                call_log = CallLog(
                    external_call_id=call["id"],
                    external_call_a_id=call["call_id"],
                    call_session_id=call_session_id,
                    organization_id=agent.organization_id,
                    agent_id=agent.id,
                    campaign_id=campaign.id if campaign else None,
                    contact_id=contact.id if contact else None,
                    type=agent.type,
                    mode="Voice",
                    phone=call.get("phone"),
                    status=(
                        call.get("status").lower()
                        if call.get("status")
                        else "calling fail"
                    ),
                    start_time=call_start,
                    end_time=parse_datetime(call.get("call_ended_at")),
                    audio_url=call.get("recording_url"),
                    cost=float(call.get("cost")) if call.get("cost") else None,
                    duration=duration,
                    ended_reason=ended_reason,
                    call_summary=call_summary,
                    sentiment=sentiment,
                    follow_up_recommended=follow_up_recommended,
                    extract_data=extract_data,
                    lead_info=lead_info,
                    source=NORMALIZED_SOURCES.get(source, source),
                    success_evaluation=success_eval_str.lower() == "true",
                    created_at=call_created_at,
                )

                try:
                    db.add(call_log)
                    db.flush()

                    if call_log.type == "inbound":
                        organization_credit_service.deduct_credits(
                            db=db,
                            organization_id=call_log.organization_id,
                            feature_code=FeatureCodes.CORE_CALL_IN_ATTEMPT,
                            quantity=1,
                            reference_type="call_log",
                            reference_id=call_log.call_session_id,
                        )

                    normalized_transcript = save_transcripts(
                        db, call_log, call.get("transcript")
                    )

                except IntegrityError:
                    db.rollback()
                    call_log = (
                        db.query(CallLog)
                        .filter(CallLog.external_call_id == call["id"])
                        .first()
                    )

                    if not call_log:
                        raise  # something else went wrong

        else:
            # Only update leads & conversations for ended calls, to prevent duplicates and wrong associations during sync
            call_log = existing

            if call_log.campaign_id:
                campaign = (
                    db.query(CallCampaign)
                    .filter(CallCampaign.id == existing.campaign_id)
                    .first()
                )

                normalized_transcript = save_transcripts(
                    db, call_log, call.get("transcript")
                )

        test_call = (
            db.query(CallingAgentTestCall)
            .filter(CallingAgentTestCall.external_call_id == str(call["call_id"]))
            .first()
        )

        call_status = call.get("status")
        is_call_ended = call_status and call_status.lower() == "ended"
        is_call_completed_or_failed = call_status and call_status.lower() in [
            "ended",
            "executing",
            "calling fail",
        ]

        if test_call:
            test_call.status = (
                call.get("status").lower()
                if call.get("status").lower()
                else test_call.status
            )

            if is_call_ended:
                organization_channel_service.release_channel(
                    db, call_type="test", reference_id=test_call.id
                )

        # Only create lead for Campaign calls, not for test calls.
        if campaign and is_call_ended:

            contact = (
                db.query(Contact).filter(Contact.id == call_log.contact_id).first()
            )

            lead = create_lead_from_call(db, call_log, call, agent, campaign, contact)

            if lead:
                # Mark call_log as lead qualified
                call_log.is_lead_qualified = True

            # Create conversation
            create_conversation_from_transcripts(db=db, call_log=call_log, agent=agent)

        if campaign and is_call_completed_or_failed:
            # update the status of scheduled call
            job = (
                db.query(WorkflowScheduledCall)
                .filter(
                    WorkflowScheduledCall.external_call_id
                    == call_log.external_call_a_id,
                    WorkflowScheduledCall.status == "processing",
                )
                .first()
            )

            if job:
                job.status = "done" if is_call_ended else "failed"
                organization_channel_service.release_channel(
                    db=db, call_type="rescheduled_call", reference_id=job.id
                )

                if not is_call_ended:
                    execution = db.query(WorkflowExecution).get(job.execution_id)

                    execution.status = "failed"
                    log_event(
                        db=db,
                        execution_id=execution.id,
                        step_id=None,
                        event_type="workflow_failed",
                        metadata={"reason": "Provider failure"},
                    )

        db.commit()

        if (
            is_call_completed_or_failed
            and campaign
            and campaign.workflow_id
            and contact
        ):
            threading.Thread(
                target=handle_workflow_async, args=(call_log.id, call), daemon=True
            ).start()

        if is_call_ended and campaign and campaign.instant_reply and contact:
            threading.Thread(
                target=handle_instant_replies_async,
                args=(call_log.id, normalized_transcript),
                daemon=True,
            ).start()

    except Exception as e:
        db.rollback()
        print(f"Process call failed: {str(e)}")
        raise

    finally:
        db.close()


def handle_workflow_async(call_log_id, call):
    db = SessionLocal()
    try:
        call_log = db.query(CallLog).get(call_log_id)
        campaign = db.query(CallCampaign).get(call_log.campaign_id)
        contact = db.query(Contact).get(call_log.contact_id)

        if not call_log or not campaign or not contact:
            return

        handle_workflow(db, call_log, campaign, call)
        db.commit()

    except Exception as e:
        logger.error(f"Workflow Failed : {str(e)}")
        db.rollback()
    finally:
        db.close()


def handle_workflow(db: Session, call_log: CallLog, campaign: CallCampaign, call: dict):
    if call_log.workflow_execution_id:
        return None

    if call_log.status not in ["completed", "ended", "calling fail", "executing"]:
        return None

    execution = (
        db.query(WorkflowExecution)
        .filter(
            WorkflowExecution.campaign_id == call_log.campaign_id,
            WorkflowExecution.contact_id == call_log.contact_id,
            WorkflowExecution.external_reference_id == call.get("call_id"),
            WorkflowExecution.status.in_(["pending", "scheduled"]),
        )
        .order_by(WorkflowExecution.id.desc())
        .first()
    )

    if execution:
        continue_workflow_from_call(db, execution, call_log, call)
    else:
        trigger_workflow_from_call(db, campaign.workflow_id, call_log, call)


def handle_instant_replies_async(call_log_id, normalized_transcript):
    db = SessionLocal()
    try:
        call_log = db.query(CallLog).get(call_log_id)
        campaign = db.query(CallCampaign).get(call_log.campaign_id)
        contact = db.query(Contact).get(call_log.contact_id)

        if not call_log or not campaign or not contact:
            return

        if not call_log.instant_reply_sent:

            handle_instant_replies(
                db, campaign, contact, call_log, normalized_transcript
            )
        db.commit()

    except Exception as e:
        db.rollback()
    finally:
        db.close()


def handle_instant_replies(
    db: Session,
    campaign: CallCampaign,
    contact: Contact,
    call_log: CallLog,
    normalized_transcript: str,
):
    existing = (
        db.query(InstantReplyLog)
        .filter(InstantReplyLog.call_log_id == call_log.id)
        .order_by(InstantReplyLog.id.desc())
        .first()
    )

    if existing:
        return  # already processed → skip everything

    log_entry = InstantReplyLog(
        call_log_id=call_log.id,
        status="pending",
    )
    db.add(log_entry)
    db.flush()

    replies_data = []
    whatsapp_data = None
    org_settings = None

    try:
        should_send = (
            campaign
            and campaign.instant_reply
            and contact
            and not call_log.instant_reply_sent
        )

        if not should_send or not normalized_transcript:
            log_entry.status = "skipped"
            db.commit()
            return

        response = analyze_conversation(normalized_transcript)
        decision = response.get("instant_reply_decision")

        log_entry.decision = decision

        if decision != "send_now":
            log_entry.status = "skipped"
            db.commit()
            return

        # ---- send logic ----
        replies = (
            db.query(CallCampaignInstantReply)
            .filter(CallCampaignInstantReply.call_campaign_id == campaign.id)
            .all()
        )

        replies_data = [
            {
                "mode": r.mode,
                "template": {
                    "content": r.template.content,
                    "subject": r.template.subject,
                },
            }
            for r in replies
        ]

        config = (
            db.query(WhatsAppChannel)
            .filter(
                WhatsAppChannel.organization_id == campaign.organization_id,
                WhatsAppChannel.is_active == True,
            )
            .first()
        )

        if config:
            whatsapp_data = {
                "phone_number_id": config.phone_number_id,
                "access_token": config.access_token,
            }

        org_settings = get_org_settings(db, campaign.organization_id)

        twilio_config = get_twilio_sms_config(
            db=db, organization_id=campaign.organization_id
        )

        call_log_id = call_log.id

        logger.info(
            f"Instant Reply initiated for Call : {call_log.id} and Contact: {contact.name}"
        )

        results = dispatch_instant_replies_safe(
            replies=replies_data,
            contact=contact,
            campaign=campaign,
            org_settings=org_settings,
            whatsapp_config=whatsapp_data,
            twilio_config=twilio_config,
        )

        all_success = True

        for channel, result in results.items():
            db.add(
                InstantReplyChannelLog(
                    instant_reply_log_id=log_entry.id,
                    channel=channel,
                    status="success" if result.get("success") else "failed",
                    error=result.get("error"),
                )
            )

            if not result.get("success"):
                all_success = False

        if all_success:
            log_entry.status = "success"
            call_log.instant_reply_sent = True
        else:
            log_entry.status = "failed"
            log_entry.error = "Dispatch failed"

        db.commit()

    except Exception as e:
        db.rollback()

        # reopen session-safe update
        try:
            log_entry.error = str(e)
            log_entry.status = "failed"
            db.add(log_entry)
            db.commit()
        except:
            pass


def save_transcripts(db: Session, call_log: CallLog, transcript: str):
    if not transcript or not call_log.id:
        return None

    lines = transcript.split("\n")
    normalized_lines = []
    transcript_rows = []

    for line in lines:
        if line.startswith("AI:"):
            speaker = "Agent"
            text = line.replace("AI:", "").strip()
            normalized_lines.append(f"AI: {text}")

        elif line.startswith("User:"):
            speaker = "User"
            text = line.replace("User:", "").strip()
            normalized_lines.append(f"User: {text}")

        else:
            continue

        transcript_rows.append(
            CallTranscript(call_log_id=call_log.id, speaker=speaker, text=text)
        )

    normalized_transcript = "\n".join(normalized_lines)

    # Only skip DB insert if already exists
    existing = (
        db.query(CallTranscript)
        .filter(CallTranscript.call_log_id == call_log.id)
        .first()
    )

    if not existing:
        db.query(CallTranscript).filter(
            CallTranscript.call_log_id == call_log.id
        ).delete()

        db.add_all(transcript_rows)
        db.flush()

    # ALWAYS return normalized transcript
    return normalized_transcript


def get_instant_replies(campaign_id):
    db = SessionLocal()
    try:
        replies = (
            db.query(CallCampaignInstantReply)
            .filter(CallCampaignInstantReply.call_campaign_id == campaign_id)
            .all()
        )

        return [
            {
                "mode": r.mode,
                "content": r.template.content,
                "subject": r.template.subject,
            }
            for r in replies
        ]
    finally:
        db.close()


def get_feature_code_for_instant_reply(reply_mode: str) -> str:
    if reply_mode == "email":
        return FeatureCodes.CMP_EMAIL_SEND
    elif reply_mode == "whatsapp":
        return FeatureCodes.CMP_WA_CONVERSATION
    elif reply_mode == "sms":
        return FeatureCodes.CMP_SMS_SEGMENT


def dispatch_instant_replies_safe(
    replies, contact, campaign, org_settings, whatsapp_config, twilio_config
):
    results = {}

    for reply in replies:
        template = reply["template"]
        message = render_template(template["content"], contact)
        mode = reply["mode"]

        results[mode] = {"success": False, "error": None}

        # ---------------- SMS ----------------
        if mode == "sms":
            try:
                success, error = send_instant_campaign_sms_using_twilio(
                    message=message,
                    to_number=contact.phone,
                    twilio_config=twilio_config,
                )

                results[mode]["success"] = success
                results[mode]["error"] = error

            except Exception as e:
                results[mode]["error"] = str(e)

        # ---------------- WHATSAPP ----------------
        elif mode == "whatsapp":
            if not whatsapp_config:
                results[mode]["error"] = "WhatsApp config missing"
                continue

            try:
                send_whatsapp_text_message(
                    phone_number_id=whatsapp_config["phone_number_id"],
                    access_token=whatsapp_config["access_token"],
                    to_number=contact.phone,
                    message_text=message,
                )
                results[mode]["success"] = True

            except Exception as e:
                results[mode]["error"] = str(e)

        # ---------------- EMAIL ----------------
        elif mode == "email":
            try:
                success, error, _ = send_campaign_email(
                    campaign_name=campaign.name,
                    subject=template["subject"] or "Update",
                    message_template=message,
                    recipient_name=contact.name,
                    recipient_email=contact.email,
                    settings=org_settings,
                )

                results[mode]["success"] = success
                results[mode]["error"] = error

            except Exception as e:
                results[mode]["error"] = str(e)

        # ---------------- UNKNOWN MODE ----------------
        else:
            results[mode]["error"] = "Unsupported channel"

    return results


def create_lead_from_call(db, call_log, call, agent, campaign, contact):
    lead = None
    phone = contact.phone if contact and contact.phone else call.get("phone")
    is_rescheduled = call_log.source == "rescheduled"

    try:
        existing = (
            db.query(Lead)
            .filter(
                Lead.organization_id == call_log.organization_id,
                Lead.phone == phone,
                Lead.product_id
                == (str(campaign.product_id) if campaign.product_id else None),
            )
            .order_by(Lead.created_at.desc())
            .first()
        )

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
                "tags": contact.tags,
            }

        # If existing & not closed → update
        if is_rescheduled:
            # Never create new lead
            lead = existing

        elif call_log.is_lead_qualified or (
            existing and existing.funnel_stage not in ["closed_won", "closed_lost"]
        ):

            existing.session_id = call_log.call_session_id
            existing.widget_id = agent.widget_id

            # Merge custom fields
            existing_fields = {}
            if existing.custom_fields:
                existing_fields = json.loads(existing.custom_fields)

            existing_fields.update(
                {
                    "lead_info": call.get("lead_info"),
                    "external_call_id": call.get("id"),
                    **contact_fields,
                }
            )

            existing.custom_fields = json.dumps(existing_fields)

            lead = existing

        else:

            valid = organization_credit_service.validate_feature_usage(
                db, agent.organization_id, FeatureCodes.AI_LEAD_GEN, 1
            )

            if valid:
                # Create new lead
                lead = Lead(
                    source="voice",
                    session_id=call_log.call_session_id,
                    widget_id=agent.widget_id,
                    organization_id=agent.organization_id,
                    product_id=(
                        str(campaign.product_id) if campaign.product_id else None
                    ),
                    name=contact.name if contact else None,
                    email=contact.email if contact else None,
                    phone=phone,
                    company=contact.company if contact else None,
                    custom_fields=json.dumps(
                        {
                            "lead_info": call.get("lead_info"),
                            "external_call_id": call.get("id"),
                            **contact_fields,
                        }
                    ),
                )

                db.add(lead)
                db.flush()

                if contact:
                    mapping = LeadContactMapping(
                        lead_id=lead.id, contact_id=contact.id, source="voice"
                    )
                    db.add(mapping)
                    db.flush()

                try:
                    organization_credit_service.deduct_credits(
                        db=db,
                        organization_id=agent.organization_id,
                        feature_code=FeatureCodes.AI_LEAD_GEN,
                        quantity=1,
                        reference_type="lead",
                        reference_id=str(lead.id),
                    )
                except:
                    pass

        # Add Lead Activity
        if lead:
            create_lead_activity(
                db=db,
                lead=lead,
                source="voice",
                session_id=call_log.call_session_id,
                campaign=campaign,
                summary=call.get("call_summary"),
                status=call.get("ended_reason"),
            )

        db.commit()
        return lead

    except Exception as e:
        print(f"Lead creation failed : {str(e)}")
        db.rollback()


def create_lead_activity(
    db,
    lead,
    source,
    session_id=None,
    campaign=None,
    status="completed",
    summary=None,
    outcome=None,
):

    # Prevent duplicate activity
    existing_activity = (
        db.query(LeadActivity)
        .filter(LeadActivity.session_id == session_id, LeadActivity.source == source)
        .first()
    )

    if existing_activity:
        return existing_activity

    # Get attempt number
    attempt = get_next_attempt(db, lead.id, source)

    activity = LeadActivity(
        lead_id=lead.id,
        campaign_id=campaign.id if campaign else None,
        session_id=session_id,
        source=source,
        status=status,
        attempt_label=f"{source.capitalize()} Attempt #{attempt}",
        summary=summary,
        outcome=outcome,
    )

    db.add(activity)
    db.commit()
    return activity


def get_next_attempt(db, lead_id, source):

    count = (
        db.query(LeadActivity)
        .filter(LeadActivity.lead_id == lead_id, LeadActivity.source == source)
        .count()
    )

    return count + 1


def create_conversation_from_transcripts(db, call_log, agent):

    exists = (
        db.query(Conversation.id)
        .filter(
            Conversation.session_id == call_log.call_session_id,
            Conversation.organization_id == call_log.organization_id,
        )
        .first()
    )

    if exists:
        return

    transcripts = (
        db.query(CallTranscript)
        .filter(CallTranscript.call_log_id == call_log.id)
        .order_by(CallTranscript.created_at.asc())
        .all()
    )

    pending_conversation = None

    for t in transcripts:
        speaker = t.speaker.lower()
        text = (t.text or "").strip()

        if not text:
            continue

        # -------------------------
        # USER SPEAKS → create row
        # -------------------------
        if speaker != "agent":

            pending_conversation = Conversation(
                session_id=call_log.call_session_id,
                widget_id=agent.widget_id,
                organization_id=call_log.organization_id,
                message=text,
                response="",
                role="assistant",
                created_at=t.created_at,
                contact_id=call_log.contact_id,
                source="voice",
            )

            db.add(pending_conversation)
            db.flush()
        # -------------------------
        # AGENT SPEAKS → attach to last user row
        # -------------------------
        else:

            if pending_conversation:
                pending_conversation.response += (
                    " " + text if pending_conversation.response else text
                )
                db.flush()

            else:
                # agent-first call (IMPORTANT FIX)
                conv = Conversation(
                    session_id=call_log.call_session_id,
                    widget_id=agent.widget_id,
                    organization_id=call_log.organization_id,
                    message="",
                    response=text,
                    role="assistant",
                    created_at=t.created_at,
                    contact_id=call_log.contact_id,
                    source="voice",
                )

                db.add(conv)
                db.flush()

    db.commit()

    sync_voice_metrics_from_conversation(
        db,
        organization_id=call_log.organization_id,
        session_id=call_log.call_session_id,
        token_usage=None,
    )


def get_lead_quality_label(rate: int):
    for label, (min_val, max_val) in LEAD_QUALITY_RANGES.items():
        if min_val <= rate <= max_val:
            return label
    return None


def parse_datetime(dt):
    if not dt:
        return None
    return datetime.fromisoformat(dt.replace("Z", "+00:00"))


def get_default_dates(
    from_date: Optional[Union[str, datetime, date]] = None,
    to_date: Optional[Union[str, datetime, date]] = None,
) -> Tuple[datetime, datetime]:
    """
    Convert string, date, or datetime inputs to UTC datetime objects.
    If missing, defaults to last 24 hours (from_date = to_date - 1 day, to_date = now UTC).
    """
    now = datetime.now(timezone.utc)

    def parse_date(d: Union[str, datetime, date]) -> datetime:
        if isinstance(d, datetime):
            # Ensure UTC
            return (
                d.replace(tzinfo=timezone.utc)
                if d.tzinfo is None
                else d.astimezone(timezone.utc)
            )
        if isinstance(d, date):
            # Convert date -> datetime at midnight UTC
            return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        if isinstance(d, str):
            try:
                dt = datetime.fromisoformat(d)
            except ValueError:
                dt = datetime.strptime(d, "%Y-%m-%d")
            return (
                dt.replace(tzinfo=timezone.utc)
                if dt.tzinfo is None
                else dt.astimezone(timezone.utc)
            )
        raise ValueError(f"Invalid date type: {type(d)}")

    to_dt = parse_date(to_date) if to_date else now
    from_dt = parse_date(from_date) if from_date else to_dt - timedelta(days=1)

    return from_dt, to_dt


def extract_placeholders(text):
    if not text:
        return set()
    return set(re.findall(r"\{\{(.*?)\}\}", text))


def render_template(template_body: str, contact):
    if not template_body:
        return ""

    placeholders = extract_placeholders(template_body)

    for key in placeholders:
        value = getattr(contact, key, "")

        # handle None safely + numeric types
        if value is None:
            value = ""
        else:
            value = str(value)

        template_body = template_body.replace(f"{{{{{key}}}}}", value)

    return template_body


########## WORK FLOW BRANCHING LOGIC ##########
def trigger_workflow_from_call(db, workflow_id, call_log, call):

    if call.get("source") in ["rescheduled_call", "reschedule_call"]:
        return

    call_status, outcome = get_call_result(call)

    # Get initial step
    initial_step = (
        db.query(WorkflowStep)
        .filter(
            WorkflowStep.workflow_id == workflow_id,
            WorkflowStep.node_type == "initialCall",
        )
        .first()
    )

    if not initial_step:
        return

    logger.info(
        f"new workflow trigger for status {call_status} & call data {call_log.__dict__}"
    )

    # Create execution
    execution = WorkflowExecution(
        workflow_id=workflow_id,
        campaign_id=call_log.campaign_id,
        contact_id=call_log.contact_id,
        step_id=initial_step.id,
        status="pending",
        external_reference_id=call.get("id"),
    )

    db.add(execution)
    db.flush()

    log_event(
        db=db,
        execution_id=execution.id,
        step_id=initial_step.id,
        event_type="workflow_triggered",
        metadata={"call_status": call_status, "outcome": outcome},
    )

    # Get edge from INITIAL step
    edge = (
        db.query(WorkflowEdge)
        .filter(
            WorkflowEdge.source_step_id == initial_step.id,
            WorkflowEdge.branch == call_status,
        )
        .first()
    )

    if not edge:
        call_log.workflow_execution_id = execution.id
        execution.status = "completed"
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=None,
            event_type="workflow_completed",
            metadata={"reason": "No matching edge found"},
        )
        return None

    execution.step_id = edge.target_step_id

    next_step = (
        db.query(WorkflowStep).filter(WorkflowStep.id == edge.target_step_id).first()
    )

    if not next_step:
        execution.status = "completed"
        call_log.workflow_execution_id = execution.id
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=next_step.id,
            event_type="workflow_completed",
            metadata={"reason": "No next step found"},
        )
        return None

    # STOP
    if next_step.node_type == "stop":
        execution.status = "completed"
        call_log.workflow_execution_id = execution.id
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=next_step.id,
            event_type="workflow_completed",
            metadata={"reason": "Reached end of workflow"},
        )
        return None

    # CUSTOM STEP
    step_outcome = (
        db.query(WorkflowStepOutcome)
        .filter(
            WorkflowStepOutcome.step_id == edge.target_step_id,
            WorkflowStepOutcome.call_status == call_status,
            or_(
                WorkflowStepOutcome.outcome == outcome,
                WorkflowStepOutcome.outcome == "all",
            ),
        )
        .first()
    )

    if not step_outcome:
        execution.status = "completed"
        call_log.workflow_execution_id = execution.id
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=next_step.id,
            event_type="workflow_completed",
            metadata={"reason": "No matching outcome found"},
        )
        return None

    schedule_workflow_step(db, execution, call_log, step_outcome, edge.target_step_id)


def continue_workflow_from_call(
    db, execution: WorkflowExecution, call_log: CallLog, call: dict
):
    call_status, outcome = get_call_result(call)

    logger.info(f"workflow : {execution.id} continue with status : {call_status}")

    log_event(
        db=db,
        execution_id=execution.id,
        step_id=execution.step_id,
        event_type="workflow_executed",
        metadata={
            "step_type": "call",
            "call_status": call_status,
            "outcome": outcome,
            "call_log_id": call_log.id,
        },
    )

    # Edge resolution
    edge = (
        db.query(WorkflowEdge)
        .filter(
            WorkflowEdge.source_step_id == execution.step_id,
            WorkflowEdge.branch == call_status,
        )
        .first()
    )

    if not edge:
        execution.status = "completed"
        call_log.workflow_execution_id = execution.id
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=execution.step_id,
            event_type="workflow_completed",
            metadata={"reason": "No matching edge found"},
        )
        return None

    next_step = (
        db.query(WorkflowStep).filter(WorkflowStep.id == edge.target_step_id).first()
    )

    if not next_step:
        execution.status = "completed"
        call_log.workflow_execution_id = execution.id
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=next_step.id,
            event_type="workflow_completed",
            metadata={"reason": "No next step found"},
        )
        return None

    # STOP
    if next_step.node_type == "stop":
        execution.status = "completed"
        call_log.workflow_execution_id = execution.id
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=next_step.id,
            event_type="workflow_completed",
            metadata={"reason": "Reached end of workflow"},
        )
        return None

    # Outcome resolution
    step_outcome = (
        db.query(WorkflowStepOutcome)
        .filter(
            WorkflowStepOutcome.step_id == edge.target_step_id,
            WorkflowStepOutcome.call_status == call_status,
            or_(
                WorkflowStepOutcome.outcome == outcome,
                WorkflowStepOutcome.outcome == "all",
            ),
        )
        .first()
    )

    logger.info(f"Call Outcome : {step_outcome} for Workflow ID : {execution.id} ")

    if not step_outcome:
        execution.status = "completed"
        call_log.workflow_execution_id = execution.id
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=execution.step_id,
            event_type="workflow_completed",
            metadata={"reason": "No matching outcome found"},
        )
        return None

    schedule_workflow_step(db, execution, call_log, step_outcome, edge.target_step_id)


def schedule_workflow_step(db, execution, call_log, step_outcome, next_step_id):
    logger.info(f"Scheduling step for Call id : {call_log.id}")

    delay = step_outcome.delay or 0

    if step_outcome.delay_unit == "minutes":
        scheduled_at = datetime.utcnow() + timedelta(minutes=delay)

    elif step_outcome.delay_unit == "hours":
        scheduled_at = datetime.utcnow() + timedelta(hours=delay)

    elif step_outcome.delay_unit == "days":
        scheduled_at = datetime.utcnow() + timedelta(days=delay)

    # If action is call → schedule call
    if step_outcome.step_type == "call":
        existing = (
            db.query(WorkflowScheduledCall)
            .filter(
                WorkflowScheduledCall.execution_id == execution.id,
                WorkflowScheduledCall.step_id == next_step_id,
                WorkflowScheduledCall.status.in_(["pending", "processing"]),
            )
            .first()
        )

        if not existing:
            db.add(
                WorkflowScheduledCall(
                    organization_id=call_log.organization_id,
                    execution_id=execution.id,
                    call_log_id=call_log.id,
                    step_id=next_step_id,
                    campaign_id=call_log.campaign_id,
                    scheduled_at=scheduled_at,
                    status="pending",
                )
            )

            execution.status = "scheduled"
            # execution.external_reference_id = response.get("call_log_id")

            log_event(
                db=db,
                execution_id=execution.id,
                step_id=next_step_id,
                event_type="workflow_scheduled",
                metadata={
                    "delay": delay,
                    "delay_unit": step_outcome.delay_unit,
                    "step_type": step_outcome.step_type,
                    "scheduled_at": scheduled_at.replace(
                        tzinfo=timezone.utc
                    ).isoformat(),
                },
            )

            logger.info(f"Call id : {call_log.id} is scheduled at {scheduled_at}")
    else:
        contact = None

        if call_log.contact_id:
            contact = (
                db.query(Contact).filter(Contact.id == call_log.contact_id).first()
            )

        template = (
            db.query(MessageTemplate)
            .filter(MessageTemplate.id == step_outcome.template_id)
            .first()
        )

        message = render_template(template.content, contact)

        if step_outcome.step_type == "sms":
            logger.info(f"Sending SMS to {contact.phone} with message: {message}")
            try:
                success, error = send_sms(
                    message=message,
                    to_number=contact.phone,
                    organization_id=call_log.organization_id,
                )

                logger.info(f"SMS send result: {success}")

                if success:
                    log_event(
                        db=db,
                        execution_id=execution.id,
                        step_id=next_step_id,
                        event_type="workflow_executed",
                        metadata={
                            "step_type": step_outcome.step_type,
                            "phone": contact.phone,
                            "message_id": message_id,
                        },
                    )
            except Exception as e:
                execution.status = "failed"
                log_event(
                    db=db,
                    execution_id=execution.id,
                    step_id=next_step_id,
                    event_type="workflow_execution_failed",
                    metadata={
                        "step_type": "sms",
                        "phone": contact.phone,
                        "reason": "Provider returned failure",
                        "error": str(e),
                    },
                )

        elif step_outcome.step_type == "email":
            logger.info(
                f"Sending Email to {contact.email} with subject: {template.subject} and message: {message}"
            )
            org_settings = get_org_settings(db, call_log.organization_id)

            campaign_name = (
                db.query(CallCampaign.name)
                .filter(CallCampaign.id == call_log.campaign_id)
                .scalar()
            )

            try:
                success, error, message_id = send_campaign_email(
                    campaign_name=campaign_name,
                    subject=template.subject or "Update",
                    message_template=message,
                    recipient_name=contact.name,
                    recipient_email=contact.email,
                    settings=org_settings,
                )

                if success:
                    log_event(
                        db=db,
                        execution_id=execution.id,
                        step_id=next_step_id,
                        event_type="workflow_executed",
                        metadata={
                            "step_type": step_outcome.step_type,
                            "email": contact.email,
                            "message_id": message_id,
                        },
                    )

            except Exception as e:
                execution.status = "failed"
                log_event(
                    db=db,
                    execution_id=execution.id,
                    step_id=next_step_id,
                    event_type="workflow_execution_failed",
                    metadata={
                        "step_type": "email",
                        "email": contact.email,
                        "reason": "Provider returned failure",
                        "error": str(e),
                    },
                )

    call_log.workflow_execution_id = execution.id
    execution.step_id = next_step_id


def reschedule_contact(db, campaign_id, contact_id, scheduled_at):
    now = datetime.now(timezone.utc)

    campaign = db.query(CallCampaign).filter(CallCampaign.id == campaign_id).first()

    if not campaign:
        return {"success": False, "message": "Campaign not found"}

    contact = db.query(Contact).filter(Contact.id == contact_id).first()

    if not contact:
        return {"success": False, "message": "Contact not found"}

    # if scheduled_at.tzinfo is None:
    #     scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

    # if scheduled_at <= now:
    #     scheduled_at = now + timedelta(minutes=2)

    # try:
    #     tz = ZoneInfo(campaign.schedule.timezone)
    # except:
    #     tz = ZoneInfo("Asia/Kolkata")  # fallback

    # local_time = scheduled_at.astimezone(tz)
    # timezone_str = (
    #     campaign.schedule.timezone or campaign.agent.prompt_timezone or "Asia/Kolkata"
    # )

    echo_client = EcholeadsClient(campaign.organization_id)
    response = echo_client.reschedule_contact_call(
        campaign.external_campaign_id,
        contact.external_contact_id,
        None,
        None,
    )

    logger.info(f"reshedule response {response}")
    return response


def get_call_result(call):
    from app.services.conversation_outcome_service import _classify_outcome_with_llm

    transcript = call.get("transcript")
    has_transcript = transcript is not None and str(transcript).strip() != ""

    if has_transcript and int(call.get("duration") or 0) > 0:
        call_status = "connected"
    else:
        call_status = "not_connected"

    # outcome from API / AI / call data
    transcript = _build_transcript(call.get("transcript"))
    classification = _classify_outcome_with_llm(transcript)
    whether_lead = classification["whether_lead"]

    # fallback outcomes
    if not whether_lead:
        outcome = "negative"
    else:
        outcome = "positive" if whether_lead == "lead" else "negative"

    return call_status, outcome


def log_event(
    db,
    execution_id: int,
    event_type: str,
    step_id: int | None = None,
    call_status: str = None,
    outcome: str = None,
    metadata: dict = None,
):
    log = WorkflowExecutionLog(
        execution_id=execution_id,
        step_id=step_id,
        event_type=event_type,
        call_status=call_status,
        outcome=outcome,
        event_metadata=metadata or {},
    )

    db.add(log)
    db.flush()

    return log


def _build_transcript(transcript: str) -> str:
    if not transcript:
        return ""

    lines = transcript.split("\n")
    normalized_lines = []
    for line in lines:

        if line.startswith("AI:"):
            text = line.replace("AI:", "").strip()
            normalized_lines.append(f"AI: {text}")

        elif line.startswith("User:"):
            text = line.replace("User:", "").strip()
            normalized_lines.append(f"User: {text}")

    return "\n".join(normalized_lines)


def process_workflow_scheduled_calls(db, batch_size, last_id=None):

    now = datetime.now(timezone.utc)
    blocked_orgs = set()

    jobs = (
        db.query(WorkflowScheduledCall)
        .filter(
            WorkflowScheduledCall.status == "pending",
            WorkflowScheduledCall.scheduled_at <= now,
        )
        .order_by(WorkflowScheduledCall.scheduled_at.asc())
        .limit(batch_size)
        .all()
    )

    processed = 0
    failed = 0
    new_last_id = last_id

    for job in jobs:
        try:
            if job.organization_id in blocked_orgs:
                continue

            call_log = db.query(CallLog).get(job.call_log_id)
            campaign = db.query(CallCampaign).get(job.campaign_id)
            execution = db.query(WorkflowExecution).get(job.execution_id)

            if not call_log or not campaign:
                job.status = "failed"
                failed += 1
                continue

            timezone_str = (
                campaign.schedule.timezone
                or campaign.agent.prompt_timezone
                or "Asia/Kolkata"
            )

            try:
                tz = ZoneInfo(timezone_str)
            except:
                tz = ZoneInfo("Asia/Kolkata")  # fallback

            scheduled_ist = job.scheduled_at.astimezone(tz)

            if not (time(9, 0) <= scheduled_ist.time() <= time(21, 0)):
                next_valid = scheduled_ist.replace(
                    hour=9, minute=0, second=0, microsecond=0
                )

                if scheduled_ist.time() > time(21, 0):
                    # move to next day 9 AM
                    next_valid = next_valid + timedelta(days=1)

                job.scheduled_at = next_valid.astimezone(timezone.utc)
                continue

            # CHECK CHANNEL CAPACITY
            total_channels = (
                db.query(func.count(Channel.id))
                .join(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
                .filter(OrganizationChannel.organization_id == job.organization_id)
                .scalar()
            )

            if total_channels == 0:
                blocked_orgs.add(job.organization_id)
                continue

            active_org_channels = (
                db.query(func.count(ChannelReservation.id))
                .filter(
                    ChannelReservation.organization_id == job.organization_id,
                    ChannelReservation.is_active == True,
                )
                .scalar()
            )

            if active_org_channels >= total_channels:
                blocked_orgs.add(job.organization_id)
                continue

            active_res_subq = db.query(ChannelReservation.channel_id).filter(
                ChannelReservation.is_active == True
            )

            channel = (
                db.query(Channel)
                .join(OrganizationChannel, OrganizationChannel.channel_id == Channel.id)
                .filter(OrganizationChannel.organization_id == job.organization_id)
                .filter(~Channel.id.in_(active_res_subq))
                .with_for_update(skip_locked=True)
                .first()
            )

            if not channel:
                blocked_orgs.add(job.organization_id)
                continue

            try:
                organization_channel_service.reserve_channel(
                    db=db,
                    organization_id=job.organization_id,
                    call_type="rescheduled_call",
                    reference_id=job.id,
                )
            except Exception:
                blocked_orgs.add(job.organization_id)
                continue

            response = reschedule_contact(
                db=db,
                campaign_id=job.campaign_id,
                contact_id=call_log.contact_id,
                scheduled_at=job.scheduled_at,
            )

            if response.get("success"):
                job.status = "processing"
                job.executed_at = now

                call_log_id = response.get("call_id")
                execution.external_reference_id = call_log_id
                job.external_call_id = call_log_id

                db.flush()
            else:
                job.status = "failed"
                failed += 1

                organization_channel_service.release_channel(
                    db=db, call_type="rescheduled_call", reference_id=job.id
                )

                execution.status = "failed"
                db.flush()

                error_msg = response.get("error") or "Provider failure"
                log_event(
                    db=db,
                    execution_id=execution.id,
                    step_id=None,
                    event_type="workflow_schedule_failed",
                    metadata={
                        "step_type": "call",
                        "reason": "Provider returned failure",
                        "error": error_msg,
                    },
                )

            processed += 1
            new_last_id = job.id

        except Exception as e:
            job.status = "failed"
            failed += 1

            try:
                organization_channel_service.release_channel(
                    db=db, call_type="rescheduled_call", reference_id=job.id
                )
            except:
                pass

            logger.error(f"Scheduler error: {e}")

    db.commit()

    return processed, failed, new_last_id
