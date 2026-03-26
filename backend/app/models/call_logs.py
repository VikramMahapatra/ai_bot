# models/call_log.py

import uuid
from datetime import datetime
from sqlalchemy import JSON, Boolean, Column, Integer, Numeric, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database import Base


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True)
    external_call_id = Column(Integer, unique=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    contact_id = Column(Integer, ForeignKey("leads.id"))
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
    
    industry = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    cost = Column(Numeric(10, 2), nullable=True)
    audio_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    transcripts = relationship("CallTranscript", back_populates="call_log")
    
    
# models/call_transcript.py

class CallTranscript(Base):
    __tablename__ = "call_transcripts"

    id = Column(Integer, primary_key=True, index=True)
    call_log_id = Column(Integer, ForeignKey("call_logs.id"))
    speaker = Column(String)   # Agent / Contact
    text = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    call_log = relationship("CallLog", back_populates="transcripts")