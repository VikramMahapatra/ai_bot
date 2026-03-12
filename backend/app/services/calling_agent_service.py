# Create Agent
import os
import shutil
from typing import List
from uuid import UUID

from fastapi import File, HTTPException, UploadFile

from backend.app.models.calling_agents import CallingAgent, CallingAgentTestCall
from sqlalchemy.orm import Session

from backend.app.schemas.calling_agent import AgentStatusUpdate, CallingAgentCreate, CallingAgentUpdate, TestCallRequest

def create_agent(db: Session, agent: CallingAgentCreate):
    db_agent = CallingAgent(
        name=agent.name,
        greeting=agent.greeting,
        prompt=agent.prompt,
        training_doc=",".join(agent.destination) if agent.destination else None,
        destination=",".join(agent.destination) if agent.destination else None,
        enable_sentiment=agent.enable_sentiment,
        voice_mail_detection=agent.voice_mail_detection,
        enable_call_recording=agent.enable_call_recording,
        success_parameters=agent.success_parameters,
        enable_call_summary=agent.enable_call_summary,
        summary_prompt=agent.summary_prompt,
        follow_up_whatsapp=agent.follow_up_whatsapp
    )
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent


# Read All Agents
def read_agents(db: Session):
    return db.query(CallingAgent).order_by(CallingAgent.created_at.desc()).all()


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


def create_agent_with_file(
    db: Session,
    agent: CallingAgentCreate,
    training_doc: UploadFile = File(None)    
):
    filename = None
    if training_doc:
        os.makedirs("uploads", exist_ok=True)
        filename = f"uploads/{training_doc.filename}"
        with open(filename, "wb") as f:
            shutil.copyfileobj(training_doc.file, f)
            
    db_agent = CallingAgent(
        name=agent.name,
        greeting=agent.greeting,
        prompt=agent.prompt,
        training_doc=filename,
        destination=",".join(agent.destination) if agent.destination else None,
        enable_sentiment=agent.enable_sentiment,
        voice_mail_detection=agent.voice_mail_detection,
        enable_call_recording=agent.enable_call_recording,
        success_parameters=agent.success_parameters,
        enable_call_summary=agent.enable_call_summary,
        summary_prompt=agent.summary_prompt,
        follow_up_whatsapp=agent.follow_up_whatsapp
    )

    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent

def update_agent_with_file(
    db: Session,
    agent_id: str,
    agent: CallingAgentUpdate,
    training_doc: UploadFile = File(None)
):

    db_agent = db.query(CallingAgent).filter(CallingAgent.id == agent_id).first()

    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Upload new training file if provided
    if training_doc:
        os.makedirs("uploads", exist_ok=True)
        filename = f"uploads/{training_doc.filename}"

        with open(filename, "wb") as f:
            shutil.copyfileobj(training_doc.file, f)

        db_agent.training_doc = filename

    update_data = agent.dict(exclude_unset=True)

    if "destination" in update_data and update_data["destination"]:
        update_data["destination"] = ",".join(update_data["destination"])

    for field, value in update_data.items():
        setattr(db_agent, field, value)

    db.commit()
    db.refresh(db_agent)

    return db_agent


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