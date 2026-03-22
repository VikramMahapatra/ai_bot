from datetime import date, datetime, time, timedelta, timezone
import json
from typing import Optional, Tuple, Union

from sqlalchemy import or_

from app.models.call_logs import CallLog, CallTranscript
from sqlalchemy.orm import Session

from app.models.calling_agents import CallingAgent, CallingAgentTestCall
from app.models.lead import Lead
from app.schemas.call_log import CallLogCreate, CallLogRequest
from app.utils.echoleads_client import EcholeadsClient
from app.models.call_campaigns import CallCampaign
from app.models.campaign import Contact

def get_call_logs(
    db: Session,
    organization_id: int,
    params: CallLogRequest
):
    ### SYNC WITH ECHOLEADS
    try:
        sync_call_logs(db, organization_id, params.campaign_id, params.from_date, params.end_date)
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

    # TOTAL COUNT
    total = query.count()

    # PAGINATION
    logs = (
        query
        .order_by(CallLog.created_at.desc())
        .offset(params.skip)
        .limit(params.limit)
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

            "transcript": [
                {
                    "speaker": t.speaker,
                    "text": t.text
                } for t in transcripts
            ]
        })

    return {
        "items": rows,
        "pagination": {
            "total": total,
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

    campaign_external_id = call["campaign_id"]
    
    
    campaign = None
    if campaign_external_id:
        campaign = db.query(CallCampaign).filter(
            CallCampaign.external_campaign_id == campaign_external_id
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
        existing.agent_id = agent.id
        existing.campaign_id = campaign.id if campaign else None
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

    else:
        call_log = CallLog(
            external_call_id=call["id"],
            organization_id=agent.organization_id,
            agent_id=agent.id,
            campaign_id=campaign.id if campaign else None,
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