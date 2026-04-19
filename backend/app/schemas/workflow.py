from typing import List, Optional
from pydantic import BaseModel

class WorkflowRequest(BaseModel):
    search: Optional[str] = None
    skip: Optional[int] = None
    limit: Optional[int] = None
    

class OutcomeIn(BaseModel):
    id: str
    outcome: Optional[str]
    stepType: str
    agentId: Optional[int] = None
    templateId: Optional[int] = None
    delay: Optional[int] = 0
    delayUnit: Optional[str] = "minutes"
    branch: Optional[str] = None

class PositionIn(BaseModel):
    x: float
    y: float

class NodeIn(BaseModel):
    id: str
    type: str
    title: str
    position: PositionIn
    stepNumber: Optional[int] = None
    outcomes: List[OutcomeIn] = []


class EdgeIn(BaseModel):
    source: str
    target: str
    branch: Optional[str] = None
    condition: Optional[str] = None


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] 
    nodes: List[NodeIn]
    edges: List[EdgeIn]