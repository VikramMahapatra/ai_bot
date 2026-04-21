from datetime import date, datetime, time, timedelta, timezone
import json
import random
import re
from typing import Optional, Tuple, Union
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks
from psycopg2 import IntegrityError
from sqlalchemy import Integer, case, cast, func, or_

from app.models.call_logs import CallLog, CallTranscript
from sqlalchemy.orm import Session

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
from app.services.sms_service import get_twilio_sms_config, send_sms
from app.services.email_service import send_campaign_email
from app.models.call_campaign_instant_replies import CallCampaignInstantReply
from app.services.organization_setting_service import get_org_settings
from app.models.whatsapp_channel import WhatsAppChannel
from app.services.whatsapp_service import send_whatsapp_text_message
from app.models.lead_activities import LeadActivity
from app.models.lead_contact_mapping import LeadContactMapping
from app.models.workflows import WorkflowEdge, WorkflowExecution, WorkflowExecutionLog, WorkflowStep, WorkflowStepOutcome
from app.models.message_templates import MessageTemplate

LEAD_QUALITY_RANGES = {
    "High": (80, 100),
    "Medium": (50, 79),
    "Low": (20, 49),
    "Poor": (0, 19)
}

def get_call_logs(
    background_tasks: BackgroundTasks,
    db: Session,
    organization_id: int,
    params: CallLogRequest
):
    ### SYNC WITH ECHOLEADS
   
    background_tasks.add_task(
        sync_call_logs,
        db,
        organization_id,
        params.campaign_id, 
        params.from_date, 
        params.end_date, 
        params.agent_id
    )
    
    conversation_subq = (
        db.query(Conversation)
        .filter(Conversation.session_id == CallLog.call_session_id)
        .order_by(Conversation.created_at.desc())   # or desc if "latest" needed
        .limit(1)
        .correlate(CallLog)
        .subquery()
    )

    query = (
        db.query(
            CallLog,
            Contact.name.label("contact_name"),
            CallingAgent.name.label("agent_name"),
            CallCampaign.name.label("campaign_name"),
            conversation_subq.c.outcome.label("call_outcome")
        )
        .outerjoin(Contact, Contact.id == CallLog.contact_id)
        .outerjoin(CallingAgent, CallingAgent.id == CallLog.agent_id)
        .outerjoin(CallCampaign, CallCampaign.id == CallLog.campaign_id)
        .outerjoin(
            conversation_subq,
            conversation_subq.c.session_id == CallLog.call_session_id
        )
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
                CallLog.type.ilike(f"%{params.search}%")
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
        query = query.filter(conversation_subq.c.outcome == params.sentiment)

    # EVALUATION (boolean)
    if params.evaluation is not None:
        query = query.filter(CallLog.success_evaluation == params.evaluation)
        
    if params.lead_quality:
        lead_rate = cast(
            CallLog.lead_info["lead_quality"]["rate"].astext,
            Integer
        )

        min_val, max_val = LEAD_QUALITY_RANGES[params.lead_quality]

        query = query.filter(
            lead_rate.between(min_val, max_val)
        )
        
    if params.is_lead_qualified is not None:
        query = query.filter(
            CallLog.is_lead_qualified == params.is_lead_qualified
        )

    # TOTAL COUNT
    summary = query.with_entities(
        func.count(CallLog.id).label("total_calls"),
        func.sum(
            case((CallLog.campaign_id != None, 1), else_=0)
        ).label("campaign_calls"),
        func.sum(
            case((CallLog.campaign_id == None, 1), else_=0)
        ).label("test_calls")
    ).first()

    total_calls = summary.total_calls or 0
    campaign_calls = summary.campaign_calls or 0
    test_calls = summary.test_calls or 0

    # PAGINATION
    if params.skip is not None and params.limit is not None:
        logs = (
            query
            .order_by(CallLog.created_at.desc())
            .offset(params.skip)
            .limit(params.limit)
            .all()
        )
    else:
        # Export case → fetch all
        logs = (
            query
            .order_by(CallLog.created_at.desc())
            .all()
        )

    rows = []

    for log, contact_name, agent_name, campaign_name, lead_outcome in logs:

        transcripts = (
            db.query(CallTranscript)
            .filter(CallTranscript.call_log_id == log.id)
            .all()
        )

        # duration in seconds
        duration = log.duration
        if not log.duration and log.start_time and log.end_time:
            duration = int((log.end_time - log.start_time).total_seconds())
            
        # Determine lead status for grid
        lead_exists = db.query(Lead.id).join(
            LeadContactMapping,
            LeadContactMapping.lead_id == Lead.id
        ).join(
            Conversation,
            Conversation.contact_id == LeadContactMapping.contact_id
        ).filter(
            Conversation.session_id == log.call_session_id,
            Lead.organization_id == organization_id
        ).limit(1).scalar()
        
        if log.is_lead_qualified:
            lead_qualified_status = "Synced" if lead_exists else "Pending"
        else:
            lead_qualified_status = "Not Qualified" if log.campaign_id else "N/A"
            
        rows.append({
            "id": log.id,
            "contact": contact_name,
            "agent": agent_name,
            "campaign": campaign_name,
            "type": log.type,
            "mode": log.mode,
            "phone": log.phone,
            "status": log.status,
            "date": log.created_at.replace(tzinfo=timezone.utc).isoformat(),
            "startTime": log.created_at.replace(tzinfo=timezone.utc).isoformat(),
            "endTime": log.end_time.replace(tzinfo=timezone.utc).isoformat() if log.end_time else None,
            "duration": duration,
            "industry": log.industry,
            "cost": float(log.cost) if log.cost else 0,
            "audioUrl": log.audio_url,

            # test call logic
            "testCall": False if log.campaign_id else True,
            "ended_reason": log.ended_reason,
            "call_summary": log.call_summary,
            "sentiment": lead_outcome if lead_outcome and log.campaign_id else "N/A",
            "follow_up_recommended": log.follow_up_recommended or [],
            "extract_data": log.extract_data or {},
            "lead_info": log.lead_info or {},
            "lead_qualified_status": lead_qualified_status,
            "transcript": [
                {
                    "speaker": t.speaker,
                    "text": t.text
                } for t in transcripts
            ]
        })

    return {
        "items": rows,
        "total_calls": total_calls,
        "campaign_calls": campaign_calls,
        "test_calls": test_calls,
        "pagination": {
            "total": total_calls,
            "skip": params.skip,
            "limit": params.limit
        }
    }


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
        audio_url=data.audio_url
    )

    db.add(call)
    db.flush()

    for t in data.transcript:
        db.add(
            CallTranscript(
                call_log_id=call.id,
                speaker=t.speaker,
                text=t.text
            )
        )

    db.commit()

    return {"message": "Call log created"}


def sync_call_logs(
    db: Session, 
    organization_id: int, 
    campaign_id=None, 
    from_date=None, 
    to_date=None,
    agent_id=None
):
    client = EcholeadsClient()
    total_calls = 0
    
    try:
        if agent_id:
            print("Syncing WITH agent_id (direct agent mode)")

            agent = db.query(CallingAgent).filter(
                CallingAgent.id == agent_id,
                CallingAgent.organization_id == organization_id
            ).first()

            if not agent:
                print("Agent not found")
                return

            from_date, to_date = get_default_dates(from_date, to_date)

            response = client.fetch_calls(
                agent_id=agent.external_agent_id,
                from_date=from_date.isoformat(),
                to_date=to_date.isoformat()
            )

            calls = response.get("calls", [])

            for call in calls:
                process_call(db, call, agent)
                
        elif campaign_id or (from_date and to_date):
            
            if campaign_id:
                print("Syncing WITH campaign_id (campaign wise mode)")
                campaign = db.query(CallCampaign).filter(
                    CallCampaign.id == campaign_id
                ).first()
                
                response = []
                if campaign.external_campaign_id:
                    response = client.fetch_campaign_calls(campaign.external_campaign_id)
            else:
                print("Syncing WITH dates (date range wise mode)")
                from_date, to_date = get_default_dates(from_date, to_date)
                response = client.fetch_calls(
                    agent_id=None,  # 👈 ignore
                    from_date=from_date.isoformat(),
                    to_date=to_date.isoformat()
                )

            calls = response.get("calls", [])

            for call in calls:
                total_calls += 1            
                call_start = parse_datetime(call.get("created_at"))
                if not call_start:
                    continue

                agent = db.query(CallingAgent).filter(
                    CallingAgent.external_agent_a_id == call.get("a_id"),
                    CallingAgent.organization_id == organization_id
                ).first()

                if not agent:
                    continue
                process_call(db, call, agent)
        else:
            print("Syncing WITH agent_id (agent-wise mode)")
            from_date, to_date = get_default_dates(from_date, to_date)

            agents = db.query(CallingAgent).filter(
                CallingAgent.external_agent_id.isnot(None),
                CallingAgent.is_deleted == False,
                CallingAgent.organization_id == organization_id
            ).all()

            for agent in agents:
                response = client.fetch_calls(
                    agent_id=agent.external_agent_id,
                    from_date=from_date.isoformat(),
                    to_date=to_date.isoformat()
                )

                calls = response.get("calls", [])
                for call in calls:   
                    process_call(db, call, agent)
                    
        db.commit()
    
    except Exception as e:
        db.rollback()
        print(f"Sync failed: {str(e)}")
    
    
def process_call(db, call, agent):
    call_start = parse_datetime(call.get("created_at"))
    if not call_start:
        return

    existing = db.query(CallLog).filter(
        CallLog.external_call_id == call["id"]
    ).first()
    
    campaign = None
    
    if not existing or existing.status != "ended":
        campaign_external_id = call["campaign_id"]
        
        if campaign_external_id:
            campaign = db.query(CallCampaign).filter(
                CallCampaign.external_campaign_id == campaign_external_id
            ).first()
            
        contact = None
        
        if call.get("contact_id"):
            contact = db.query(Contact).filter(
                Contact.external_contact_id == call.get("contact_id")
            ).first()

        # Prepare common values
        duration = int(call.get("duration")) if call.get("duration") else None
        ended_reason = call.get("ended_reason")
        call_summary = call.get("call_summary")
        sentiment = call.get("sentiment")
        follow_up_recommended = call.get("follow_up_recommended")
        extract_data = call.get("extract_data")
        lead_info = call.get("lead_info")
        success_eval_str = call.get("success_evaluation") if call.get("success_evaluation") else "false"

        # convert extract_data if string
        if isinstance(extract_data, str):
            try:
                extract_data = json.loads(extract_data)
            except:
                extract_data = None            

        if existing:
            existing.organization_id = agent.organization_id
            existing.external_call_a_id = call.get("call_id")
            existing.agent_id = agent.id
            existing.campaign_id = campaign.id if campaign else None
            existing.contact_id = contact.id if contact else None
            existing.type = agent.type
            existing.mode = "Voice"
            existing.phone = call.get("phone")
            existing.status = call.get("status").lower() if call.get("status") else existing.status

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
            existing.success_evaluation = success_eval_str.lower() == "true"
            db.flush()
            
            save_transcripts(db, existing, call.get("transcript"), campaign, contact)
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
                contact_id = contact.id if contact else None,
                type=agent.type,
                mode="Voice",
                phone=call.get("phone"),
                status=call.get("status").lower() if call.get("status") else "calling fail",

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
                success_evaluation=success_eval_str.lower() == "true",
                created_at = parse_datetime(call.get("created_at")),
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
                        reference_id=call_log.call_session_id
                    )   
                    
                save_transcripts(db, call_log, call.get("transcript"), campaign, contact)                        
                
            except IntegrityError:
                db.rollback()                      
    else: 
        # Only update leads & conversations for ended calls, to prevent duplicates and wrong associations during sync
        call_log = existing
        
        if call_log.campaign_id:
            campaign = db.query(CallCampaign).filter(
                    CallCampaign.id == existing.campaign_id
                ).first()  

    # Only create lead for Campaign calls, not for test calls.
    if campaign:
        
        contact = db.query(Contact).filter(
                Contact.id == call_log.contact_id
        ).first() 
        
        lead = create_lead_from_call(db, call_log, call, agent, campaign, contact)

        if lead:
            # Mark call_log as lead qualified
            call_log.is_lead_qualified = True
            
        # WORKFLOW EXECUTION
        if campaign.workflow_id and contact:
            
            if call_log.workflow_execution_id:
                return 
            
            if call_log.status not in ["completed", "ended", "calling fail"]:
                return

            execution = db.query(WorkflowExecution).filter(
                WorkflowExecution.campaign_id == call_log.campaign_id,
                WorkflowExecution.contact_id == call_log.contact_id,
                WorkflowExecution.external_reference_id == call.get("id")
            ).order_by(WorkflowExecution.id.desc()).first()

            if execution:
                print("continue workflow")
                continue_workflow_from_call(db, execution, call_log, call)
                return
            
            print("new workflow trigger")
            trigger_workflow_from_call(
                db,
                campaign.workflow_id,
                call_log,
                call
            )
            
        db.flush()
    
    test_call = db.query(CallingAgentTestCall).filter(
        CallingAgentTestCall.external_call_id == str(call["id"])
    ).first()

    if test_call:
        test_call.status = call.get("status").lower() if call.get("status").lower() else test_call.status
        
    db.commit()
    
def save_transcripts(db: Session, call_log: CallLog, transcript : str, campaign : CallCampaign, contact : Contact):

    if not transcript or not call_log.id    :
        return

    db.query(CallTranscript).filter(
        CallTranscript.call_log_id == call_log.id
    ).delete()

    lines = transcript.split("\n")
    normalized_lines = []
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

        db.add(
            CallTranscript(
                call_log_id=call_log.id,
                speaker=speaker,
                text=text
            )
        )
        
    db.flush()
    
    if campaign and campaign.instant_reply:
        normalized_transcript = "\n".join(normalized_lines)
        response = analyze_conversation(normalized_transcript)
        print(f"response from decision service: {response} and transcript: {normalized_transcript}")
        dispatch_instant_replies(
            db=db,
            call_log=call_log,
            campaign=campaign,
            contact=contact,
            decision= response.get("instant_reply_decision")
        )
            

def dispatch_instant_replies(db : Session, call_log: CallLog, campaign : CallCampaign, contact : Contact, decision : str):
    if decision != "send_now":
        return
    
    if not contact:
        return
    
    print("Dispatching instant replies...")

    replies = (
        db.query(CallCampaignInstantReply)
        .filter(CallCampaignInstantReply.call_campaign_id == campaign.id)
        .all()
    )

    instant_reply_completed  = False
    for reply in replies:

        template = reply.template
        message = render_template(template.content, contact)
        

        if reply.mode == "sms":
            print(f"Sending SMS to {contact.phone} with message: {message}")
            try:
                success, error = send_sms(
                    message=message,
                    to_number=contact.phone,
                    organization_id=campaign.organization_id
                )
                
                if success:
                   instant_reply_completed = True     
                else:
                    print(f"SMS failed: {error}")
            except Exception as e:
                print(f"Failed to send SMS: {str(e)}")
                pass

        elif reply.mode == "whatsapp":
            config = db.query(WhatsAppChannel).filter(
                WhatsAppChannel.organization_id == campaign.organization_id,
                WhatsAppChannel.is_active == True,
            ).first()
            
            if config:
                try:
                    send_whatsapp_text_message(
                        phone_number_id=config.phone_number_id,
                        access_token=config.access_token,
                        to_number=contact.phone,
                        message_text=message,
                    )
                except Exception as e:
                    print(f"Failed to send WhatsApp message: {str(e)}")
                    pass

        elif reply.mode == "email":
            print(f"Sending Email to {contact.email} with subject: {template.subject} and message: {message}")
            org_settings = get_org_settings(db, campaign.organization_id)
            try:
                success, error, message_id = send_campaign_email(
                    campaign_name=campaign.name,
                    subject=template.subject or "Update",
                    message_template=message,
                    recipient_name=contact.name,
                    recipient_email=contact.email,
                    settings=org_settings
                )
                
                if success:
                   instant_reply_completed = True     
            except Exception as e:
                print(f"Failed to send Email: {str(e)}")
                pass
        
    call_log.instant_reply_sent = instant_reply_completed
    db.flush()

def create_lead_from_call(db, call_log, call, agent, campaign, contact):

    phone = contact.phone if contact and contact.phone else call.get("phone")

    existing = (
        db.query(Lead)
        .filter(
            Lead.organization_id == call_log.organization_id,
            Lead.phone == phone,
            Lead.product_id == (str(campaign.product_id) if campaign.product_id else None)
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
            "tags": contact.tags
        }

    # If existing & not closed → update
    if existing and existing.funnel_stage not in ["closed_won", "closed_lost"]:

        existing.session_id = call_log.call_session_id
        existing.widget_id = agent.widget_id

        # Merge custom fields
        existing_fields = {}
        if existing.custom_fields:
            existing_fields = json.loads(existing.custom_fields)

        existing_fields.update({
            "lead_info": call.get("lead_info"),
            "external_call_id": call.get("id"),
            **contact_fields
        })

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
                product_id=str(campaign.product_id) if campaign.product_id else None,
                name=contact.name if contact else None,
                email=contact.email if contact else None,
                phone=phone,
                company=contact.company if contact else None,
                custom_fields=json.dumps({
                    "lead_info": call.get("lead_info"),
                    "external_call_id": call.get("id"),
                    **contact_fields
                })
            )

            db.add(lead)
            db.flush()
            
            if contact:
                mapping = LeadContactMapping(
                    lead_id=lead.id,
                    contact_id=contact.id,
                    source="voice"
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
                    reference_id=str(lead.id)
                )
            except:
                pass

    # Create conversation
    create_conversation_from_transcripts(
        db=db,
        call_log=call_log,
        agent=agent
    )

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

    return lead


def create_lead_activity(
    db,
    lead,
    source,
    session_id=None,
    campaign=None,
    status="completed",
    summary=None,
    outcome=None
):

    # Prevent duplicate activity
    existing_activity = (
        db.query(LeadActivity)
        .filter(
            LeadActivity.session_id == session_id,
            LeadActivity.source == source
        )
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
        outcome=outcome
    )

    db.add(activity)

    return activity

def get_next_attempt(db, lead_id, source):

    count = (
        db.query(LeadActivity)
        .filter(
            LeadActivity.lead_id == lead_id,
            LeadActivity.source == source
        )
        .count()
    )

    return count + 1

    
def create_conversation_from_transcripts(db, call_log, agent):
    # Skip if already exists
    exists = db.query(Conversation.id).filter(
        Conversation.session_id == (call_log.call_session_id),
        Conversation.organization_id == call_log.organization_id
    ).first()
    
    if exists:
        return

    transcripts = (
        db.query(CallTranscript)
        .filter(CallTranscript.call_log_id == call_log.id)
        .order_by(CallTranscript.created_at.asc())
        .all()
    )

    conversations = []
    current_message = None

    for t in transcripts:
        role = "assistant" if t.speaker.lower() == "agent" else "user"

        if role == "user":
            # Start new conversation row with user message
            current_message = Conversation(
                session_id=call_log.call_session_id,
                widget_id=agent.widget_id,
                organization_id=call_log.organization_id,
                message=t.text,
                response="",
                role="assistant",  # role of the “responder”
                created_at=t.created_at,
                contact_id=call_log.contact_id,
                source="voice"
            )
            conversations.append(current_message)

        elif role == "assistant":
            if current_message:
                # attach assistant response to last user message
                current_message.response = t.text
            else:
                # First message is assistant, create a new row
                current_message = Conversation(
                    session_id=call_log.call_session_id,
                    widget_id=agent.widget_id,
                    organization_id=call_log.organization_id,
                    message="",
                    response=t.text,
                    role="assistant",
                    created_at=t.created_at,
                    contact_id=call_log.contact_id,
                    source="voice"
                )
                conversations.append(current_message)

    if conversations:
        db.add_all(conversations)
        db.flush()  
    
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
    to_date: Optional[Union[str, datetime, date]] = None
) -> Tuple[datetime, datetime]:
    """
    Convert string, date, or datetime inputs to UTC datetime objects.
    If missing, defaults to last 24 hours (from_date = to_date - 1 day, to_date = now UTC).
    """
    now = datetime.now(timezone.utc)

    def parse_date(d: Union[str, datetime, date]) -> datetime:
        if isinstance(d, datetime):
            # Ensure UTC
            return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)
        if isinstance(d, date):
            # Convert date -> datetime at midnight UTC
            return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        if isinstance(d, str):
            try:
                dt = datetime.fromisoformat(d)
            except ValueError:
                dt = datetime.strptime(d, "%Y-%m-%d")
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
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
    
    if call.get("source") == "rescheduled_call":
        return   

    call_status, outcome = get_call_result(call)

    # Get initial step
    initial_step = db.query(WorkflowStep).filter(
        WorkflowStep.workflow_id == workflow_id,
        WorkflowStep.node_type == "initialCall"
    ).first()

    if not initial_step:
        return

    # Create execution 
    execution = WorkflowExecution(
        workflow_id=workflow_id,
        campaign_id=call_log.campaign_id,
        contact_id=call_log.contact_id,
        step_id=initial_step.id,
        status="pending",
        external_reference_id=call.get("id")
    )

    db.add(execution)
    db.flush()
    call_log.workflow_execution_id = execution.id
    
    log_event(
        db=db,
        execution_id=execution.id,
        step_id=initial_step.id,
        event_type="workflow_triggered"
    )

    print(f"Trigger workflow for {call_status} and {outcome}")

    # Get edge from INITIAL step
    edge = db.query(WorkflowEdge).filter(
        WorkflowEdge.source_step_id == initial_step.id,
        WorkflowEdge.branch == call_status
    ).first()

    if not edge:
        return
    
    execution.step_id = edge.target_step_id
    
    next_step = db.query(WorkflowStep).filter(
        WorkflowStep.id == edge.target_step_id
    ).first()

    if not next_step:
        return
    
    #STOP
    if next_step.node_type == "stop":
        execution.status = "completed"
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=next_step.id,
            event_type="workflow_completed",
            metadata={"reason": "stop_node_reached"}
        )
        return
    
    # CUSTOM STEP
    step_outcome = db.query(WorkflowStepOutcome).filter(
        WorkflowStepOutcome.step_id == edge.target_step_id,
        WorkflowStepOutcome.call_status == call_status,
        or_(
            WorkflowStepOutcome.outcome == outcome,
            WorkflowStepOutcome.outcome == "all"
        )
    ).first()

    if not step_outcome:
        execution.status = "completed"
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=next_step.id,
            event_type="workflow_completed",
            metadata={"reason": "no further outcomes"}
        )
        return
    
    schedule_workflow_step(
        db,
        execution,
        call_log,
        step_outcome,
        edge.target_step_id
    )

    
def continue_workflow_from_call(db, execution : WorkflowExecution, call_log: CallLog, call: dict):

    call_status, outcome = get_call_result(call)
    
    # Edge resolution
    edge = db.query(WorkflowEdge).filter(
        WorkflowEdge.source_step_id == execution.step_id,
        WorkflowEdge.branch == call_status
    ).first()

    if not edge:
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=execution.step_id,
            event_type="workflow_completed",
            metadata={"reason": "no further edge"}
        )  
        return

    # Outcome resolution
    step_outcome = db.query(WorkflowStepOutcome).filter(
        WorkflowStepOutcome.step_id == edge.target_step_id,
        WorkflowStepOutcome.call_status == call_status,
        or_(
            WorkflowStepOutcome.outcome == outcome,
            WorkflowStepOutcome.outcome == "all"
        )
    ).first()

    if not step_outcome:
        log_event(
            db=db,
            execution_id=execution.id,
            step_id=execution.step_id,
            event_type="workflow_completed",
            metadata={"reason": "no further outcome"}
        )    
        return

    

    schedule_workflow_step(
        db,
        execution,
        call_log,
        step_outcome,
        edge.target_step_id
    )

    
def schedule_workflow_step(db, execution, call_log, step_outcome, next_step_id):

    delay = step_outcome.delay or 0

    if step_outcome.delay_unit == "minutes":
        scheduled_at = datetime.utcnow() + timedelta(minutes=delay)

    elif step_outcome.delay_unit == "hours":
        scheduled_at = datetime.utcnow() + timedelta(hours=delay)

    elif step_outcome.delay_unit == "days":
        scheduled_at = datetime.utcnow() + timedelta(days=delay)
        
    log_event(
        db=db,
        execution_id=execution.id,
        step_id=next_step_id,
        event_type="scheduled",
        metadata={"delay": delay, "step_type": step_outcome.step_type}
    )
    
   

    # If action is call → schedule call
    if step_outcome.step_type == "call":
        response = reschedule_contact(
            db=db,
            campaign_id=call_log.campaign_id,
            contact_id=call_log.contact_id,
            scheduled_at=scheduled_at
        )
        
        if response.get("success"):
            execution.status = "scheduled"
            execution.external_reference_id = response.get("call_log_id")
            print(f"Call scheduled at {scheduled_at}")
    else:
        contact = None
        
        if call_log.contact_id:
            contact = db.query(Contact).filter(
                Contact.external_contact_id == call_log.contact_id
            ).first()
            
        template  = db.query(MessageTemplate).filter(
            MessageTemplate.id == step_outcome.template_id
        ).first()
        
        message = render_template(template.content, contact)
            
        if step_outcome.step_type == "sms":
            print(f"Sending SMS to {contact.phone} with message: {message}")
            try:
                result = send_sms(
                    message=message,
                    to_number=contact.phone,
                    organization_id=call_log.organization_id
                )
                
                print(f"SMS send result: {result}")
            except Exception as e:
                print(f"Failed to send SMS: {str(e)}")
                pass

        
        elif step_outcome.step_type == "email":
            print(f"Sending Email to {contact.email} with subject: {template.subject} and message: {message}")
            org_settings = get_org_settings(db, call_log.organization_id)
            
            campaign_name = db.query(CallCampaign.name).filter(
                 CallCampaign.id == call_log.campaign_id
            )
            try:
                send_campaign_email(
                    campaign_name=campaign_name,
                    subject=template.subject or "Update",
                    message_template=message,
                    recipient_name=contact.name,
                    recipient_email=contact.email,
                    settings=org_settings
                )
            except Exception as e:
                print(f"Failed to send Email: {str(e)}")
                pass
    
    execution.step_id = next_step_id
    db.commit()
    
def reschedule_contact(db, campaign_id, contact_id, scheduled_at):
    
    campaign = db.query(CallCampaign).filter(
        CallCampaign.id == campaign_id
    ).first()
    
    if not campaign:
        return {"success": False, "message": "Campaign not found"}
    
    contact = db.query(Contact).filter(
        Contact.id == contact_id
    ).first()
    
    if not contact:
        return {"success": False, "message": "Contact not found"}
    
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    
    try:
        tz = ZoneInfo(campaign.schedule.timezone)
    except:
        tz = ZoneInfo("Asia/Kolkata")  # fallback

    local_time = scheduled_at.astimezone(tz)
    
    print("local time : ", local_time)
    
    echo_client = EcholeadsClient()
    response = echo_client.reschedule_contact_call(campaign.external_campaign_id, contact.external_contact_id, local_time)
    print("reshedule response :", response)
    return response

def get_call_result(call):
    from app.services.conversation_outcome_service import _classify_outcome_with_llm
    
    if call.get("transcript") and int(call.get("duration") or 0) > 10:
        call_status = "connected"
    else:
        call_status = "not_connected"

    # outcome from API / AI / call data
    transcript = _build_transcript(call.get("transcript"))
    outcome = _classify_outcome_with_llm(transcript)

    # fallback outcomes
    if not outcome:
        if call_status == "not_connected":
            outcome = "no_answer"
        else:
            outcome = "neutral"

    return call_status, outcome

def log_event(
    db,
    execution_id: int,
    step_id: int,
    event_type: str,
    call_status: str = None,
    outcome: str = None,
    metadata: dict = None
):
    log = WorkflowExecutionLog(
        execution_id=execution_id,
        step_id=step_id,
        event_type=event_type,
        call_status=call_status,
        outcome=outcome,
        event_metadata=metadata or {}
    )

    db.add(log)
    db.flush()

    return log

def _build_transcript(transcript : str) -> str:
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
