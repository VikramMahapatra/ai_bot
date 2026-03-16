# Create Agent
from datetime import datetime
import os
import shutil
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import func
from app.config import settings
from fastapi import File, HTTPException, UploadFile, requests

from app.models.calling_agents import CallingAgent, CallingAgentTestCall
from sqlalchemy.orm import Session

from app.schemas.calling_agent import AgentStatusUpdate, CallingAgentCreate, CallingAgentUpdate, TestCallRequest
from app.utils.echoleads_client import EcholeadsClient
from app.models.voices import Voice
from app.models.call_logs import CallLog, CallTranscript

UPLOAD_DIR = "uploads/agent_training_docs"

def create_agent(
    db: Session,
    organization_id: int,
    agent: CallingAgentCreate,
    training_files: Optional[List[UploadFile]] = None
):
    #CREATE REQUEST TO ECHO LEADS
    echoleads = EcholeadsClient()
    echo_payload = {
        "name": agent.name,
        "agent_call_type":  "outgoing" if agent.type.lower() == "outbound" else "incoming",
        "firstMessage": agent.greeting,
        "prompt": agent.prompt,
        "voice_id": agent.voice,
        "language": agent.transcriber_language or "en",
        "data_extract": agent.important_data_points,
        "summary": agent.summary_prompt,
        "prompt_timezone": agent.prompt_timezone,
        "calendar_sync": agent.calendar_sync,
        "voice_mail_detection": agent.voice_mail_detection,
        "talking_speed": agent.talking_speed,
        "max_duration_seconds": agent.max_call_duration,
        "sentiment_detection": agent.enable_sentiment,
        "automated_follow_ups": agent.follow_up_whatsapp,
        "background_sound": agent.enable_background_sound,
        "background_sound_url": agent.background_sound_url,
        "start_speaking_wait_seconds": agent.start_speaking_wait_seconds,
        "stop_speaking_voice_seconds": agent.stop_speaking_voice_seconds,
        "agent_speaks_first": True if agent.who_speaks_first == "ai" else False,
        "transcriber_provider": agent.transcriber_provider,
        "transcriber_language": agent.transcriber_language,
        "transcriber_model": agent.transcriber_model,
        "server_location": agent.server_location,
        "plan_id": 1,
        "agent_status": "draft"
    }
    echo_response = echoleads.create_agent(echo_payload)
    external_agent_id = None
    external_agent_a_id = None
    if echo_response and "data" in echo_response:
        external_agent_id = echo_response["data"].get("id")
        external_agent_a_id = echo_response["data"].get("a_id")
        

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    saved_files = []

    # Save uploaded files
    if training_files:
        for file in training_files:
            ext = file.filename.split(".")[-1]
            unique_name = f"{uuid4()}.{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_name)

            with open(file_path, "wb") as buffer:
                buffer.write(file.file.read())

            saved_files.append(file_path)

    db_agent = CallingAgent(
        organization_id=organization_id,
        name=agent.name,
        type=agent.type.lower(),
        greeting=agent.greeting,
        prompt=agent.prompt,
        server_location=agent.server_location,

        # Voice
        gender=agent.gender,
        accent=agent.accent,
        voice=agent.voice,

        # Conversation
        who_speaks_first=agent.who_speaks_first,

        # Files
        training_doc=",".join(saved_files) if saved_files else None,

        # Destination
        destination=",".join(agent.destination) if agent.destination else None,

        # Timezone
        enable_prompt_timezone=agent.enable_prompt_timezone,
        prompt_timezone=agent.prompt_timezone,

        # Call Forwarding
        enable_call_forwarding=agent.enable_call_forwarding,
        call_forwarding_number=agent.call_forwarding_number,
        call_forwarding_role=agent.call_forwarding_role,
        call_forwarding_action_desc=agent.call_forwarding_action_desc,

        # Analysis
        silence_timeout=agent.silence_timeout,
        talking_speed=agent.talking_speed,
        max_call_duration=agent.max_call_duration,
        calendar_sync=agent.calendar_sync,

        enable_sentiment=agent.enable_sentiment,
        voice_mail_detection=agent.voice_mail_detection,
        enable_call_recording=agent.enable_call_recording,

        # Summary
        success_parameters=agent.success_parameters,
        enable_call_summary=agent.enable_call_summary,
        summary_prompt=agent.summary_prompt,
        follow_up_whatsapp=agent.follow_up_whatsapp,

        # AI Config
        important_data_points=agent.important_data_points,
        enable_background_sound=agent.enable_background_sound,
        background_sound_url=agent.background_sound_url,
        start_speaking_wait_seconds=agent.start_speaking_wait_seconds,
        stop_speaking_voice_seconds=agent.stop_speaking_voice_seconds,

        # Transcriber
        transcriber_provider=agent.transcriber_provider,
        transcriber_language=agent.transcriber_language,
        transcriber_model=agent.transcriber_model,
        
        external_agent_id=external_agent_id,
        external_agent_a_id= external_agent_a_id
    )

    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)

    return {
        **db_agent.__dict__,
        "destination": db_agent.destination.split(",") if db_agent.destination else []
    }

def update_agent(
    db: Session,
    agent_id: int,
    agent: CallingAgentUpdate,
    training_files: Optional[List[UploadFile]] = None
):

    db_agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

    if not db_agent:
        raise ValueError("Agent not found")
    
    if not db_agent.external_agent_id:
        raise HTTPException(status_code=400, detail="Agent not synced with Echoleads")

    # 🔹 Update Echoleads
    echoleads = EcholeadsClient()
    echo_payload = {
        "name": agent.name if agent.name else db_agent.name,
        "agent_call_type":  "outgoing" if db_agent.type.lower() == "outbound" else "incoming",
        "prompt": agent.prompt if agent.prompt else db_agent.prompt,
        "firstMessage": agent.greeting if agent.greeting else db_agent.greeting,
        "voice_id": agent.voice if agent.voice else db_agent.voice,
        "language": agent.transcriber_language or db_agent.transcriber_language,
        "data_extract": agent.important_data_points or db_agent.important_data_points,
        "summary": agent.summary_prompt or db_agent.summary_prompt,
        "prompt_timezone": agent.prompt_timezone or db_agent.prompt_timezone,
        "calendar_sync": agent.calendar_sync if agent.calendar_sync is not None else db_agent.calendar_sync,
        "voice_mail_detection": agent.voice_mail_detection if agent.voice_mail_detection is not None else db_agent.voice_mail_detection,
        "talking_speed": agent.talking_speed or db_agent.talking_speed,
        "max_duration_seconds": agent.max_call_duration or db_agent.max_call_duration,
        "sentiment_detection": agent.enable_sentiment if agent.enable_sentiment is not None else db_agent.enable_sentiment,
        "automated_follow_ups": agent.follow_up_whatsapp if agent.follow_up_whatsapp is not None else db_agent.follow_up_whatsapp,
        "background_sound": agent.enable_background_sound if agent.enable_background_sound is not None else db_agent.enable_background_sound,
        "background_sound_url": agent.background_sound_url or db_agent.background_sound_url,
        "start_speaking_wait_seconds": agent.start_speaking_wait_seconds or db_agent.start_speaking_wait_seconds,
        "stop_speaking_voice_seconds": agent.stop_speaking_voice_seconds or db_agent.stop_speaking_voice_seconds,
        "agent_speaks_first": True if (agent.who_speaks_first or db_agent.who_speaks_first) == "ai" else False,
        "transcriber_provider": agent.transcriber_provider or db_agent.transcriber_provider,
        "transcriber_language": agent.transcriber_language or db_agent.transcriber_language,
        "transcriber_model": agent.transcriber_model or db_agent.transcriber_model,
        "server_location": agent.server_location or db_agent.server_location,
        "agent_status": db_agent.status,
        "plan_id": 1
    }
    # 🔹 Call Echoleads update
    if db_agent.external_agent_id:
        echoleads.update_agent(db_agent.external_agent_id, echo_payload)

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    saved_files = []

    if db_agent.training_doc:
        saved_files = db_agent.training_doc.split(",")

    if training_files:
        for file in training_files:
            ext = file.filename.split(".")[-1]
            unique_name = f"{uuid4()}.{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_name)

            with open(file_path, "wb") as buffer:
                buffer.write(file.file.read())

            saved_files.append(file_path)

    update_data = agent.dict(exclude_unset=True)

    for key, value in update_data.items():
        if key == "destination":
            setattr(db_agent, key, ",".join(value) if value else None)
        else:
            setattr(db_agent, key, value)

    if saved_files:
        db_agent.training_doc = ",".join(saved_files)

    db.commit()
    db.refresh(db_agent)

    return {
        **db_agent.__dict__,
        "destination": db_agent.destination.split(",") if db_agent.destination else []
    }

# Read All Agents
def read_agents(
    db: Session,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    sort_by: str = "newest"
):
    query = db.query(CallingAgent)

    if search:
        query = query.filter(CallingAgent.name.ilike(f"%{search}%"))

    if sort_by == "oldest":
        query = query.order_by(CallingAgent.created_at.asc())
    else:
        query = query.order_by(CallingAgent.created_at.desc())

    total = query.count()

    rows = query.offset(skip).limit(limit).all()

    items = []
    for agent in rows:
        data = agent.__dict__.copy()

        # convert destination string → list
        data["destination"] = (
            agent.destination.split(",") if agent.destination else []
        )

        items.append(data)

    return {
        "items": items,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }


# Optional: Get Single Agent
def get_agent(db: Session, agent_id: str):
    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

def update_credits(
    db: Session,
    agent_id: int,
    allocated_calls: int = None,
    pending_calls: int = None,
    attempted_calls: int = None,
    active_campaigns: int = None
):
    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if allocated_calls is not None:
        agent.allocated_calls = allocated_calls
    if pending_calls is not None:
        agent.pending_calls = pending_calls
    if attempted_calls is not None:
        agent.attempted_calls = attempted_calls
    if active_campaigns is not None:
        agent.active_campaigns = active_campaigns
    db.commit()
    db.refresh(agent)
    return agent


def test_call(
    db: Session,
    agent_id: int,
    data: TestCallRequest,
):
    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent.external_agent_id:
        raise HTTPException(status_code=400, detail="Agent not synced with Echoleads")
    
    # Prepare API request
    echoleads = EcholeadsClient()
    customer_name = data.name if data.name else "Customer"
    payload = {
    "a_id": agent.external_agent_a_id,
    "phone": data.phone_no,
    "firstMessage": agent.greeting.format(name=customer_name),
    "dynamicFieldValues": [
            {
                "key": "customer_name",
                "value": customer_name
            }
        ]
    }

    api_response = echoleads.create_call(payload)

    # Extract response values safely
    external_call_id = None
    call_status = None

    if api_response and "data" in api_response:
        external_call_id = api_response["data"].get("id")
        call_status = api_response["data"].get("status")

    # Save test call log
    test_call = CallingAgentTestCall(
        agent_id=agent_id,
        phone_no=data.phone_no,
        name=data.name,
        external_call_id=external_call_id,
        status=call_status
    )

    db.add(test_call)
    db.commit()
    db.refresh(test_call)

    return {
        "message": "Test call triggered",
        "phone_no": data.phone_no,
        "name": data.name,
        "external_call_id": external_call_id,
        "call_status": call_status,
        "provider_response": api_response
    }
    
def publish_agent(
    db: Session,
    agent_id: int
):

    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    echoleads = EcholeadsClient()

    # Prepare minimal payload for Echoleads
    echo_payload = {
        "agent_status": "active"
    }

    # Update Echoleads agent
    if agent.external_agent_id:
        echoleads.update_agent(agent.external_agent_id, echo_payload)

    # Update local DB
    agent.status = "Active"

    db.commit()
    db.refresh(agent)

    return {
        "message": "Agent published",
        "agent_id": agent.id
    }
    
    
def update_agent_status(
    db: Session,
    agent_id: int,
    data: AgentStatusUpdate,
):

    agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.status = data.status

    db.commit()
    db.refresh(agent)

    return {
        "message": "Agent status updated",
        "agent_id": agent.id,
        "status": agent.status
    }
    
    
# Agent Lookup
def agent_lookup(
    db: Session, 
    organization_id: int,
    search: Optional[str] = None):

    query = db.query(
        CallingAgent.id,
        CallingAgent.name
    ).filter(CallingAgent.organization_id == organization_id)

    if search:
        query = query.filter(
            CallingAgent.name.ilike(f"%{search}%")
        )

    agents = query.order_by(CallingAgent.name.asc()).all()

    return [
        {
            "id": agent.id,
            "name": agent.name
        }
        for agent in agents
    ]
    
def get_voices(db: Session):

    voices = db.query(Voice).all()

    # If already stored → return
    if voices:
        return voices

    # If empty → call Echoleads API
    client = EcholeadsClient()
    response = client.fetch_voices()

    voice_list = response.get("data", [])

    for voice in voice_list:

        db_voice = Voice(
            id=voice.get("id"),
            caller_name=voice.get("caller_name"),
            voice_id=voice.get("voice_id"),
            provider=voice.get("provider"),
            gender=voice.get("gender"),
            language=voice.get("language"),
            accent=voice.get("accent"),
            recording_url=voice.get("recording_url"),
            is_active=voice.get("is_active"),
            is_test_voice=voice.get("is_test_voice"),
            created_at=parse_datetime(voice.get("created_at")),
            updated_at=parse_datetime(voice.get("updated_at")),
        )

        db.add(db_voice)

    db.commit()

    return db.query(Voice).all()

def parse_datetime(dt):
    if not dt:
        return None
    return datetime.fromisoformat(dt.replace("Z", "+00:00"))