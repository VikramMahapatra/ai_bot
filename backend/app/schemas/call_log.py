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
    skip: int = 0
    limit: int = 10
    campaign_id: Optional[int] = None