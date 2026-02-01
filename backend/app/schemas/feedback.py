from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FeedbackCreate(BaseModel):
    session_id: str
    message_index: int  # Position in conversation
    rating: int  # 1-5
    feedback_text: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    session_id: str
    message_index: int
    rating: int
    feedback_text: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
