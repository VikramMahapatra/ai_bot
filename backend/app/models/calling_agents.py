# models.py
import uuid
from sqlalchemy import Column, Float, ForeignKey, String, Boolean, DateTime, Integer, JSON, Text, func
from sqlalchemy.dialects.sqlite import BLOB
from datetime import datetime
from sqlalchemy.orm import relationship
from app.database import Base


class CallingAgent(Base):
    __tablename__ = "calling_agents"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    
    # Agent info
    name = Column(String, nullable=False)
    type = Column(String, nullable=False, default="outbound")  # 'inbound' | 'outbound'
    calling_no = Column(String, nullable=True)
    destination = Column(String, nullable=True)  # comma-separated list of countries
    status = Column(String, default="Draft")  # Active / Paused
    server_location = Column(String)

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
    
    gender = Column(String, nullable=False)
    accent = Column(String)
    voice = Column(String, nullable=False)

    who_speaks_first = Column(String, nullable=False)

    enable_prompt_timezone = Column(Boolean)
    prompt_timezone = Column(String)

    enable_call_forwarding = Column(Boolean)
    call_forwarding_number = Column(String)
    call_forwarding_role = Column(String)
    call_forwarding_action_desc = Column(Text)

    silence_timeout = Column(Integer, nullable=False)
    talking_speed = Column(Float, nullable=False)
    max_call_duration = Column(Integer, nullable=False)
    calendar_sync = Column(Boolean)

    important_data_points = Column(Text)
    enable_background_sound = Column(Boolean)
    background_sound_url = Column(String)

    start_speaking_wait_seconds = Column(Float)
    stop_speaking_voice_seconds = Column(Float)

    transcriber_provider = Column(String)
    transcriber_language = Column(String)
    transcriber_model = Column(String)

    # Meta
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    external_agent_id = Column(String, nullable=True) 
    external_agent_a_id = Column(String, nullable=True)
    
    campaigns = relationship("CallCampaign", back_populates="agent")
    
    
    
class CallingAgentTestCall(Base):
    __tablename__ = "calling_agent_test_calls"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("calling_agents.id"))
    phone_no = Column(String)
    name = Column(String)
    status = Column(String, default="Triggered")
    created_at = Column(DateTime, default=datetime.utcnow)
    external_call_id = Column(String, nullable=True)  # NEW COLUMN