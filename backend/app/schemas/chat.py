from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class ChatMessage(BaseModel):
    message: str
    session_id: str
    widget_id: str
    language_code: Optional[str] = None
    language_label: Optional[str] = None
    retrieval_message: Optional[str] = None


class SourceInfo(BaseModel):
    id: int
    name: str
    type: str
    url: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    sources: List[SourceInfo] = []


class SuggestedQuestionsResponse(BaseModel):
    questions: List[str] = []


class ConversationHistoryItem(BaseModel):
    role: str
    message: str
    response: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class TranslateRequest(BaseModel):
    text: str
    target_language_code: Optional[str] = None
    target_language_label: Optional[str] = None
    widget_id: Optional[str] = None


class TranslateResponse(BaseModel):
    translated_text: str
