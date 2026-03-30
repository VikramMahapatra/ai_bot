from datetime import date, datetime, time, timedelta, timezone
import json
from typing import Optional, Tuple, Union

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

LEAD_QUALITY_RANGES = {
    "High": (80, 100),
    "Medium": (50, 79),
    "Low": (20, 49),
    "Poor": (0, 19)
}

def get_call_logs(
    db: Session,
    organization_id: int,
    params: CallLogRequest
):
    ### SYNC WITH ECHOLEADS
    try:
        sync_call_logs(db, organization_id, params.campaign_id, params.from_date, params.end_date, params.agent_id)
    except Exception as e:
        print(f"Sync failed: {str(e)}")

    query = (
        db.query(
            CallLog,
            Contact.name.label("contact_name"),
            CallingAgent.name.label("agent_name"),
            CallCampaign.name.label("campaign_name")
        )
        .outerjoin(Contact, Contact.id == CallLog.contact_id)
        .outerjoin(CallingAgent, CallingAgent.id == CallLog.agent_id)
        .outerjoin(CallCampaign, CallCampaign.id == CallLog.campaign_id)
        .filter(CallLog.organization_id == organization_id)
    )
    
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
        query = query.filter(CallLog.sentiment == params.sentiment)

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

    for log, contact_name, agent_name, campaign_name in logs:

        transcripts = (
            db.query(CallTranscript)
            .filter(CallTranscript.call_log_id == log.id)
            .all()
        )

        # duration in seconds
        duration = None
        if log.start_time and log.end_time:
            duration = int((log.end_time - log.start_time).total_seconds())
            
        # Determine lead status for grid
        lead_exists = db.query(Lead).filter(Lead.session_id == log.id).first()
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
            "sentiment": log.sentiment,
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
    
    print(f"campaign : {campaign_id}")
    print(f"from date : {from_date}")
    print(f"to date : {to_date}")
    
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
    
def process_call(db, call, agent):
    call_start = parse_datetime(call.get("created_at"))
    if not call_start:
        return

    existing = db.query(CallLog).filter(
        CallLog.external_call_id == call["id"]
    ).first()
    
    # if existing and existing.status == "ended":
    #     return
    
    campaign_external_id = call["campaign_id"]
    
    campaign = None
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
            
    call_log_id = None

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
        
        save_transcripts(db, existing.id, call.get("transcript"))

        call_log = existing
    else:
        call_log = CallLog(
            external_call_id=call["id"],
            external_call_a_id=call["call_id"],
            organization_id=agent.organization_id,
            agent_id=agent.id,
            campaign_id=campaign.id if campaign else None,
            contact_id = contact.id if contact else None,
            type=agent.type,
            mode="Voice",
            phone=call.get("phone"),
            status=call.get("status").lower() if call.get("status") else "queued",

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

        db.add(call_log)
        db.flush()
        
        save_transcripts(db, call_log.id, call.get("transcript"))
        
        call_log_id = call_log.id
        
    # Create lead if eligible
    
    lead_quality_rate = lead_info.get("lead_quality", {}).get("rate")
    lead_quality_label = get_lead_quality_label(lead_quality_rate) if lead_quality_rate is not None else None
    

    # Only create lead for High or Medium quality
    if campaign and lead_quality_label in ["High", "Medium"]:
        if settings.CAN_AUTO_SYNC_CAMPAIGN_LEAD:
            lead = create_lead_from_call(db, call_log.id, call, agent, campaign, contact, lead_quality_label)

            if lead:
                # Mark call_log as lead qualified
                call_log.is_lead_qualified = True
                
        else:
            call_log.is_lead_qualified = True
            
        db.flush()

    
    test_call = db.query(CallingAgentTestCall).filter(
        CallingAgentTestCall.external_call_id ==call["id"]
    ).first()

    if test_call:
        test_call.status = call.get("status").lower() if call.get("status").lower() else test_call.status
        db.commit()

def save_transcripts(db: Session, call_log_id: int, transcript):

    if not transcript:
        return

    db.query(CallTranscript).filter(
        CallTranscript.call_log_id == call_log_id
    ).delete()

    lines = transcript.split("\n")

    for line in lines:

        if line.startswith("AI:"):
            speaker = "Agent"
            text = line.replace("AI:", "").strip()

        elif line.startswith("User:"):
            speaker = "User"
            text = line.replace("User:", "").strip()

        else:
            continue

        db.add(
            CallTranscript(
                call_log_id=call_log_id,
                speaker=speaker,
                text=text
            )
        )
        
def create_lead_from_call(db, call_log_id, call, agent, campaign, contact, lead_quality_label):
    # Skip test calls
    if not campaign:
        return None

    # Prevent duplicate
    product_id = None
    query = db.query(Lead).filter(
        Lead.phone == call.get("phone"),
        Lead.organization_id == agent.organization_id
    )
    if product_id:
        query = query.filter(Lead.product_id == product_id)

    existing = query.first()
    if existing:
        return None

    lead = Lead(
        source="voice",
        session_id=call_log_id,
        widget_id=str(agent.id),
        organization_id=agent.organization_id,
        product_id = product_id,
        name=contact.name if contact else None,
        email=contact.email if contact else None,
        phone=call.get("phone"),
        company=contact.company if contact else None,
        custom_fields=json.dumps({
            "lead_quality_label": lead_quality_label,
            "lead_info": call.get("lead_info"),
            "external_call_id": call.get("id")
        }),
        funnel_stage="lead_qualification"
    )

    db.add(lead)
    db.flush()  # so we can get lead.id if needed
    return lead

def create_manual_lead(db : Session, organization_id :int, call_log_id : int, payload: MoveToFunnelRequest):
    result = True
    # Fetch call log (you may adjust based on your CallLog model)
    call = db.query(CallLog).filter(CallLog.id == call_log_id).first()
    if not call:
        return {
            "success" : False,
            "message" : "Call not found"
        } 
    
    agent = db.query(CallingAgent).filter(
        CallingAgent.id == call.agent_id,
        CallingAgent.organization_id == organization_id
    ).first()
    
    campaign = None
    if call.campaign_id:
        campaign = db.query(CallCampaign).filter(
            CallCampaign.id == call.campaign_id
        ).first()
        
    if not campaign:
        return {
            "success" : False,
            "message" : "Campaign not found"
        } 
    
    contact = None
    if call.contact_id:
        contact = db.query(Contact).filter(
            Contact.id == call.contact_id
        ).first()
        
    if not contact:
        return {
            "success" : False,
            "message" : "Contact not found"
        } 

    # Prevent duplicate by phone + organization + optional product
    query = db.query(Lead).filter(
        Lead.phone == call.phone,
        Lead.organization_id == agent.organization_id
    )
    if campaign.product_id:
        query = query.filter(Lead.product_id == campaign.product_id)

    if query.first():
        return {
            "success" : False,
            "message" : "Lead already synced"
        } 

    # Build custom fields
    custom_fields = {
        "lead_info": call.lead_info,
        "external_call_id": call.id
    }

    lead = Lead(
        source="voice",
        session_id=call_log_id,
        widget_id=str(agent.id),
        organization_id=agent.organization_id,
        product_id=campaign.product_id,
        name=contact.name if contact else None,
        email=contact.email if contact else None,
        phone=call.phone,
        company=contact.company if contact else None,
        custom_fields=json.dumps(custom_fields),
        funnel_stage=payload.stage
    )

    db.add(lead)
    call.is_lead_qualified = True
    
    db.flush()
    db.commit()
    return {
            "success" : True,
            "message" : "Lead synced successfully"
        } 
    
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