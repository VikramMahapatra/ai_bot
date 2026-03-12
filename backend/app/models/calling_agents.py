# models.py
import uuid
from sqlalchemy import Column, ForeignKey, String, Boolean, DateTime, Integer, JSON, func
from sqlalchemy.dialects.sqlite import BLOB
from datetime import datetime
from sqlalchemy.orm import relationship
from backend.app.database import Base


class CallingAgent(Base):
    __tablename__ = "calling_agents"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    
    # Agent info
    name = Column(String, nullable=False)
    type = Column(String, nullable=False, default="Outbound")  # 'Inbound' | 'Outbound'
    calling_no = Column(String, nullable=True)
    destination = Column(String, nullable=True)  # comma-separated list of countries
    status = Column(String, default="Active")  # Active / Paused

    # Campaign & credits
    active_campaigns = Column(Integer, default=0)
    allocated_calls = Column(Integer, default=0)
    pending_calls = Column(Integer, default=0)
    attempted_calls = Column(Integer, default=0)

    # Agent configuration
    greeting = Column(String, nullable=True)
    prompt = Column(String, nullable=True)
    training_doc = Column(String, nullable=True)  # store filename/path
    enable_sentiment = Column(Boolean, default=False)
    voice_mail_detection = Column(Boolean, default=False)
    enable_call_recording = Column(Boolean, default=False)
    success_parameters = Column(String, nullable=True)
    enable_call_summary = Column(Boolean, default=False)
    summary_prompt = Column(String, nullable=True)
    follow_up_whatsapp = Column(Boolean, default=False)

    # Meta
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    campaigns = relationship("Campaign", back_populates="agent")
    
    
    
class CallingAgentTestCall(Base):
    __tablename__ = "calling_agent_test_calls"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("calling_agents.id"))
    phone_no = Column(String)
    name = Column(String)
    status = Column(String, default="Triggered")
    created_at = Column(DateTime, default=datetime.utcnow)