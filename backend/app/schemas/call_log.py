# schemas/call_log.py

from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime


class TranscriptSchema(BaseModel):
    speaker: str
    text: str


class CallLogResponse(BaseModel):
    id: int
    contact: str
    agent: str
    type: str
    mode: str
    status: str
    date: datetime
    startTime: datetime
    endTime: datetime
    industry: str
    audioUrl: str
    transcript: List[TranscriptSchema]
    
    
class CallLogCreate(BaseModel):
    contact_id: int
    agent_id: int
    campaign_id: int
    type: str
    mode: str
    status: str
    industry: str
    start_time: datetime
    end_time: datetime
    audio_url: str
    transcript: list[TranscriptSchema]
    
    
class CallLogRequest(BaseModel):
    from_date: Optional[date] = None
    end_date: Optional[date] = None
    search: Optional[str] = None

    skip: Optional[int] = None
    limit: Optional[int] = None
    agent_id: Optional[int] = None
    campaign_id: Optional[int] = None

    status: Optional[str] = None
    call_end_reason: Optional[str] = None
    sentiment: Optional[str] = None
    evaluation: Optional[bool] = None
    
    lead_quality: Optional[str] = None
    is_lead_qualified: Optional[bool] = None
    
class MoveToFunnelRequest(BaseModel):
    stage: str