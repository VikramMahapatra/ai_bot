from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_

from app.models.call_logs import CallLog, CallTranscript
from sqlalchemy.orm import Session

from app.models.calling_agents import CallingAgent
from app.models.lead import Lead
from app.schemas.call_log import CallLogCreate
from app.utils.echoleads_client import EcholeadsClient
from app.models.call_campaigns import CallCampaign

def get_call_logs(
    db: Session,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    from_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):

    query = (
        db.query(
            CallLog,
            Lead.name.label("contact_name"),
            CallingAgent.name.label("agent_name"),
            CallCampaign.name.label("campaign_name")
        )
        .outerjoin(Lead, Lead.id == CallLog.contact_id)
        .outerjoin(CallingAgent, CallingAgent.id == CallLog.agent_id)
        .outerjoin(CallCampaign, CallCampaign.id == CallLog.campaign_id)
    )

    # SEARCH
    if search:
        query = query.filter(
            or_(
                Lead.name.ilike(f"%{search}%"),
                CallingAgent.name.ilike(f"%{search}%"),
                CallLog.status.ilike(f"%{search}%"),
                CallLog.type.ilike(f"%{search}%")
            )
        )

    # DATE FILTER
    if from_date:
        query = query.filter(CallLog.start_time >= from_date)

    if end_date:
        query = query.filter(CallLog.start_time <= end_date)

    # TOTAL COUNT
    total = query.count()

    # PAGINATION
    logs = (
        query
        .order_by(CallLog.created_at.desc())
        .offset(skip)
        .limit(limit)
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
            "date": log.created_at,
            "startTime": log.start_time,
            "endTime": log.end_time,
            "duration": duration,
            "industry": log.industry,
            "cost": float(log.cost) if log.cost else 0,
            "audioUrl": log.audio_url,

            # test call logic
            "testCall": False if log.campaign_id else True,

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
            "skip": skip,
            "limit": limit
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


def sync_call_logs(db: Session):
    client = EcholeadsClient()
    response = client.fetch_echolead_calls()
    
    calls = response.get("calls", [])

    # Only consider calls from last 30 minutes
    thirty_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=30)

    for call in calls:
        call_start = parse_datetime(call.get("created_at"))

        if not call_start or call_start < thirty_minutes_ago:
            # Skip old calls
            continue

        # Find agent mapping
        agent = db.query(CallingAgent).filter(
            CallingAgent.external_agent_a_id == call.get("a_id")
        ).first()

        if not agent:
            continue  # skip if agent not found

        organization_id = agent.organization_id

        # Check if call exists
        existing = db.query(CallLog).filter(
            CallLog.external_call_id == call["id"]
        ).first()

        if existing:
            # Update existing record
            existing.organization_id = organization_id
            existing.agent_id = agent.id
            existing.campaign_id = call.get("campaign_id")
            existing.type = agent.type
            existing.mode = "Voice"
            existing.phone = call.get("phone")
            existing.status = call.get("status")
            existing.start_time = call_start
            existing.end_time = parse_datetime(call.get("call_ended_at"))
            existing.audio_url = call.get("recording_url")
            existing.cost = float(call.get("cost")) if call.get("cost") else None

            db.flush()
            save_transcripts(db, existing.id, call.get("transcript"))
        else:
            # Add new record
            call_log = CallLog(
                external_call_id=call["id"],
                organization_id=organization_id,
                agent_id=agent.id,
                campaign_id=call.get("campaign_id"),
                type=agent.type,
                mode="Voice",
                phone=call.get("phone"),
                status=call.get("status"),
                start_time=call_start,
                end_time=parse_datetime(call.get("call_ended_at")),
                audio_url=call.get("recording_url"),
                cost=float(call.get("cost")) if call.get("cost") else None
            )

            db.add(call_log)
            db.flush()
            save_transcripts(db, call_log.id, call.get("transcript"))

    db.commit()
    
def save_transcripts(db: Session, call_log_id: int, transcript):

    if not transcript:
        return

    lines = transcript.split("\n")

    for line in lines:

        if line.startswith("AI:"):
            speaker = "Agent"
            text = line.replace("AI:", "").strip()

        elif line.startswith("User:"):
            speaker = "Contact"
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