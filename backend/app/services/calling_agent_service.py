# Create Agent
import os
import shutil
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import File, HTTPException, UploadFile

from app.models.calling_agents import CallingAgent, CallingAgentTestCall
from sqlalchemy.orm import Session

from app.schemas.calling_agent import AgentStatusUpdate, CallingAgentCreate, CallingAgentUpdate, TestCallRequest

UPLOAD_DIR = "uploads/agent_training_docs"

def create_agent(
    db: Session,
    organization_id: int,
    agent: CallingAgentCreate,
    training_files: Optional[List[UploadFile]] = None
):

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
        transcriber_model=agent.transcriber_model
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

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    saved_files = []

    # existing files
    if db_agent.training_doc:
        saved_files = db_agent.training_doc.split(",")

    # save new files
    if training_files:
        for file in training_files:
            ext = file.filename.split(".")[-1]
            unique_name = f"{uuid4()}.{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_name)

            with open(file_path, "wb") as buffer:
                buffer.write(file.file.read())

            saved_files.append(file_path)

    # Update fields dynamically
    update_data = agent.dict(exclude_unset=True)

    for key, value in update_data.items():

        if key == "destination":
            setattr(db_agent, key, ",".join(value) if value else None)
        else:
            setattr(db_agent, key, value)

    # update training docs
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

    # Save test call log
    test_call = CallingAgentTestCall(
        agent_id=agent_id,
        phone_no=data.phone_no,
        name=data.name
    )

    db.add(test_call)
    db.commit()

    # Here you will trigger actual call provider (Twilio / SIP / AI agent)
    # Example placeholder
    print(f"Calling {data.phone_no} with name {data.name} using agent {agent.name}")

    return {
        "message": "Test call triggered",
        "phone_no": data.phone_no,
        "name": data.name
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