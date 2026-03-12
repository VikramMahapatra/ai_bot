from sqlalchemy import Column, ForeignKey, String, Boolean, DateTime, Integer, JSON, Text, func
from sqlalchemy.dialects.sqlite import BLOB
from datetime import datetime
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String)
    priority = Column(String)
    status = Column(String, default="Draft")
    agent_id = Column(int, ForeignKey("calling_agents.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_deleted = Column(Boolean, default=False)

    agent = relationship("CallingAgent", back_populates="campaigns")
    contacts = relationship("CampaignContact", back_populates="campaign")
    schedule = relationship("CampaignSchedule", uselist=False, back_populates="campaign")