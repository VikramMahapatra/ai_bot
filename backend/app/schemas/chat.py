from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChatMessage(BaseModel):
    message: str
    session_id: str
    widget_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


class ConversationHistoryItem(BaseModel):
    role: str
    message: str
    response: str
    created_at: datetime
    
    class Config:
        from_attributes = True
