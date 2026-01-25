from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    widget_id = Column(String, index=True, nullable=True)
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
