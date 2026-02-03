from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class ChatMessage(BaseModel):
    message: str
    session_id: str
    widget_id: str


class SourceInfo(BaseModel):
    id: int
    name: str
    type: str
    url: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    sources: List[SourceInfo] = []


class ConversationHistoryItem(BaseModel):
    role: str
    message: str
    response: str
    created_at: datetime
    
    class Config:
        from_attributes = True
