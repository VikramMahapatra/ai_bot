import logging
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends
from backend.app.schemas.calling_agent import AgentStatusUpdate, CallingAgentCreate, CallingAgentRead, TestCallRequest
from backend.app.database import get_db
from sqlalchemy.orm import Session
from backend.app.services import calling_agent_service as service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/calling-agent", tags=["calling-agent"])

@router.post("/create", response_model=CallingAgentRead)
def create_agent(agent: CallingAgentCreate, db: Session = Depends(get_db)):
    return service.create_agent(db, agent)


@router.get("/all", response_model=List[CallingAgentRead])
def read_agents(db: Session = Depends(get_db)):
    return service.read_agents(db)
    
@router.get("/{agent_id:int}", response_model=CallingAgentRead)
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    return service.get_agent(db, agent_id)


@router.post("/{agent_id:int}/test-call")
def test_call(
    agent_id: int,
    data: TestCallRequest,
    db: Session = Depends(get_db)
):
    return service.test_call(db, agent_id, data)


@router.patch("/{agent_id:int}/status")
def update_agent_status(
    agent_id: int,
    data: AgentStatusUpdate,
    db: Session = Depends(get_db)
):
    return service.update_agent_status(db, agent_id, data)