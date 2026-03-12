from backend.app.models.call_logs import CallLog, CallTranscript
from sqlalchemy.orm import Session

from backend.app.models.calling_agents import CallingAgent
from backend.app.models.lead import Lead
from backend.app.schemas.call_log import CallLogCreate

def get_call_logs(db: Session):

    logs = db.query(CallLog).all()

    result = []

    for log in logs:

        contact = db.query(Lead).filter(Lead.id == log.contact_id).first()
        agent = db.query(CallingAgent).filter(CallingAgent.id == log.agent_id).first()

        transcripts = (
            db.query(CallTranscript)
            .filter(CallTranscript.call_log_id == log.id)
            .all()
        )

        result.append({
            "id": log.id,
            "contact": contact.name if contact else None,
            "agent": agent.name if agent else None,
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

    return result


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