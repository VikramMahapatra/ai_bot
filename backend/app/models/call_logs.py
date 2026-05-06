# models/call_log.py

import uuid
from datetime import datetime
from sqlalchemy import JSON, Boolean, Column, Identity, Index, Integer, Numeric, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(Integer, Identity(start=1, increment=1), primary_key=True, index=True)
    call_session_id = Column(String, unique=True, index=True)
    external_call_id = Column(Integer, unique=True, index=True)
    external_call_a_id = Column(String, unique=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    contact_id = Column(Integer, ForeignKey("contacts.id"))
    agent_id = Column(Integer, ForeignKey("calling_agents.id"))
    campaign_id = Column(Integer, ForeignKey("call_campaigns.id"))

    type = Column(String)       # Inbound / Outbound
    mode = Column(String)       # Voice / WhatsApp / etc
    phone = Column(String)
    status = Column(String)     # Completed / Failed / No Answer
    
    duration = Column(Integer)
    ended_reason = Column(String)
    call_summary = Column(Text)
    sentiment = Column(String)
    follow_up_recommended = Column(JSON)
    extract_data = Column(JSON)
    lead_info = Column(JSON)
    success_evaluation = Column(Boolean, default=False)
    is_lead_qualified = Column(Boolean, default=False)
    
    industry = Column(String)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    cost = Column(Numeric(10, 2), nullable=True)
    audio_url = Column(String)
    instant_reply_sent = Column(Boolean, default=False)
    source = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    workflow_execution_id = Column(
        Integer,
        ForeignKey("workflow_executions.id"),
        nullable=True
    )
    

    transcripts = relationship("CallTranscript", back_populates="call_log")
    contact = relationship("Contact", back_populates="call_logs")
    campaign = relationship("CallCampaign", back_populates="call_logs")
    agent = relationship("CallingAgent", back_populates="call_logs")
    
    __table_args__ = (
        Index("idx_calllog_external_call_id", "external_call_id"),
        Index("idx_calllog_campaign", "campaign_id"),
        Index("idx_calllog_agent", "agent_id"),
        Index("idx_calllog_contact", "contact_id"),
        Index("idx_calllog_org_created", "organization_id", "created_at"),
    )
    
    
# models/call_transcript.py

class CallTranscript(Base):
    __tablename__ = "call_transcripts"

    id = Column(Integer, Identity(), primary_key=True)
    call_log_id = Column(Integer, ForeignKey("call_logs.id"))
    speaker = Column(String)   # Agent / Contact
    text = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    call_log = relationship("CallLog", back_populates="transcripts")
    
    __table_args__ = (
        Index("idx_transcript_call_created", "call_log_id", "created_at"),
        Index("idx_transcript_call_log_id", "call_log_id")
    )