# schemas.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CallingAgentCreate(BaseModel):
    name: str
    type: str = "Outbound"  # Inbound | Outbound
    calling_no: Optional[str] = None
    destination: Optional[List[str]] = []
    status: str = "Active"
    
    # Credit & campaign
    active_campaigns: int = 0
    allocated_calls: int = 0
    pending_calls: int = 0
    attempted_calls: int = 0

    # Configuration
    greeting: Optional[str] = None
    prompt: Optional[str] = None
    training_doc: Optional[str] = None
    enable_sentiment: bool = False
    voice_mail_detection: bool = False
    enable_call_recording: bool = False
    success_parameters: Optional[str] = None
    enable_call_summary: bool = False
    summary_prompt: Optional[str] = None
    follow_up_whatsapp: bool = False
    
class CallingAgentUpdate(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    greeting: Optional[str] = None
    prompt: Optional[str] = None
    destination: Optional[List[str]] = None

    enable_sentiment: Optional[bool] = None
    voice_mail_detection: Optional[bool] = None
    enable_call_recording: Optional[bool] = None

    success_parameters: Optional[str] = None
    enable_call_summary: Optional[bool] = None
    summary_prompt: Optional[str] = None

    follow_up_whatsapp: Optional[bool] = None

class CallingAgentRead(CallingAgentCreate):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        
        
class TestCallRequest(BaseModel):
    phone_no: str
    name: str
    

class AgentStatusUpdate(BaseModel):
    status: str  # Active | Paused