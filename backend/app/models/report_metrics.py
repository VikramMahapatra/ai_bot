from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ConversationMetrics(Base):
    __tablename__ = "conversation_metrics"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    session_id = Column(String, index=True, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    widget_id = Column(String, nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # Conversation metrics
    total_messages = Column(Integer, default=0)  # User + AI messages
    total_user_messages = Column(Integer, default=0)
    total_ai_messages = Column(Integer, default=0)
    
    # Token metrics
    total_tokens = Column(Integer, default=0)  # Total tokens used
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    
    # Engagement metrics
    average_response_time = Column(Float, default=0.0)  # Seconds
    conversation_duration = Column(Float, default=0.0)  # Seconds
    user_satisfaction = Column(Float, nullable=True)  # 1-5 rating from feedback
    
    # Lead metrics
    has_lead = Column(Integer, default=0)  # 1 if lead captured, 0 otherwise
    lead_name = Column(String, nullable=True)
    lead_email = Column(String, nullable=True)
    lead_company = Column(String, nullable=True)
    
    # Timestamps
    conversation_start = Column(DateTime(timezone=True), nullable=True)
    conversation_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Indexes for common queries
    __table_args__ = (
        Index('idx_org_date', 'organization_id', 'conversation_start'),
        Index('idx_session_org', 'session_id', 'organization_id'),
    )

    # Relationships
    conversation = relationship("Conversation")
    organization = relationship("Organization")
