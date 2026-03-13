from datetime import datetime
from typing import Optional

from sqlalchemy import or_

from app.models.call_logs import CallLog, CallTranscript
from sqlalchemy.orm import Session

from app.models.calling_agents import CallingAgent
from app.models.lead import Lead
from app.schemas.call_log import CallLogCreate

def get_call_logs(
    db: Session,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    from_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):

    query = (
        db.query(CallLog, Lead.name.label("contact_name"), CallingAgent.name.label("agent_name"))
        .outerjoin(Lead, Lead.id == CallLog.contact_id)
        .outerjoin(CallingAgent, CallingAgent.id == CallLog.agent_id)
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
        .order_by(CallLog.start_time.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    rows = []

    for log, contact_name, agent_name in logs:

        transcripts = (
            db.query(CallTranscript)
            .filter(CallTranscript.call_log_id == log.id)
            .all()
        )

        rows.append({
            "id": log.id,
            "contact": contact_name,
            "agent": agent_name,
            "type": log.type,
            "mode": log.mode,
            "status": log.status,
            "date": log.start_time,
            "startTime": log.start_time,
            "endTime": log.end_time,
            "industry": log.industry,
            "audioUrl": log.audio_url,
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