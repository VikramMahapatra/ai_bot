# schemas.py

from pydantic import BaseModel, field_validator
from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy import Float

class CallingAgentCreate(BaseModel):
    name: str
    type: str = "Outbound"
    calling_no: Optional[str] = None
    destination: Optional[List[str]] = []
    status: str = "pending"
    server_location: Optional[str] = None
    inbound_phone_number: Optional[str] = None

    # Credit & campaign
    active_campaigns: int = 0
    allocated_calls: int = 0
    pending_calls: int = 0
    attempted_calls: int = 0

    # Conversation
    greeting: Optional[str] = None
    prompt: Optional[str] = None
    training_doc: Optional[str] = None
    who_speaks_first: str = "ai"

    # Voice
    gender: Optional[str] = "Male"
    accent: Optional[str] = None
    voice: Optional[str] = None

    # Timezone
    enable_prompt_timezone: bool = False
    prompt_timezone: Optional[str] = None

    # Call Forwarding
    enable_call_forwarding: bool = False
    call_forwarding_number: Optional[str] = None
    call_forwarding_role: Optional[str] = None
    call_forwarding_action_desc: Optional[str] = None

    # Analysis
    silence_timeout: int = 10
    talking_speed: float = 1.0
    max_call_duration: int = 120
    calendar_sync: bool = False
    enable_sentiment: bool = False
    voice_mail_detection: bool = False
    enable_call_recording: bool = False

    # Summary
    success_parameters: Optional[str] = None
    enable_call_summary: bool = False
    summary_prompt: Optional[str] = None
    follow_up_whatsapp: bool = False

    # AI Config
    important_data_points: Optional[str] = None
    enable_background_sound: bool = False
    background_sound_url: Optional[str] = None
    start_speaking_wait_seconds: Optional[str] = "0.1"
    stop_speaking_voice_seconds: Optional[str] = "0.3"

    # Transcriber
    transcriber_provider: Optional[str] = None
    transcriber_language: Optional[str] = None
    transcriber_model: Optional[str] = None
    
class CallingAgentUpdate(BaseModel):

    type: Optional[str] = None
    name: Optional[str] = None
    greeting: Optional[str] = None
    prompt: Optional[str] = None
    destination: Optional[List[str]] = None
    server_location: Optional[str] = None
    inbound_phone_number: Optional[str] = None

    # Voice
    gender: Optional[str] = None
    accent: Optional[str] = None
    voice: Optional[str] = None

    # Conversation
    who_speaks_first: Optional[str] = None

    # Timezone
    enable_prompt_timezone: Optional[bool] = None
    prompt_timezone: Optional[str] = None

    # Call forwarding
    enable_call_forwarding: Optional[bool] = None
    call_forwarding_number: Optional[str] = None
    call_forwarding_role: Optional[str] = None
    call_forwarding_action_desc: Optional[str] = None

    # Analysis
    silence_timeout: Optional[int] = None
    talking_speed: Optional[float] = None
    max_call_duration: Optional[int] = None
    calendar_sync: Optional[bool] = None

    enable_sentiment: Optional[bool] = None
    voice_mail_detection: Optional[bool] = None
    enable_call_recording: Optional[bool] = None

    # Summary
    success_parameters: Optional[str] = None
    enable_call_summary: Optional[bool] = None
    summary_prompt: Optional[str] = None
    follow_up_whatsapp: Optional[bool] = None

    # AI Config
    important_data_points: Optional[str] = None
    enable_background_sound: Optional[bool] = None
    background_sound_url: Optional[str] = None
    start_speaking_wait_seconds: Optional[str] = None
    stop_speaking_voice_seconds: Optional[str] = None

    # Transcriber
    transcriber_provider: Optional[str] = None
    transcriber_language: Optional[str] = None
    transcriber_model: Optional[str] = None
  
    
class CallingAgentRead(CallingAgentCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
        
        
class TestCallRequest(BaseModel):
    phone_no: str
    calling_no: str
    variables: Optional[Dict[str, str]] = {}

class AgentStatusUpdate(BaseModel):
    status: str  # Active | Paused | Draft
    
class CallingNumberRequest(BaseModel):
    type: str