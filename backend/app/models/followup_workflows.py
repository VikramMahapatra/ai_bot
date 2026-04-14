
from datetime import datetime
from sqlalchemy import Boolean, Column, Identity, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class FollowUpWorkflow(Base):
    __tablename__ = "followup_workflows"

    id = Column(Integer, primary_key=True, index=True)

    organization_id = Column(Integer, ForeignKey("organizations.id"))

    name = Column(String, nullable=False)

    contact_source = Column(String)  # campaign / contact_list

    campaign_source = Column(String, nullable=True)  # call/email/sms/whatsapp

    campaign_id = Column(Integer, nullable=True)

    contact_list_id = Column(Integer, nullable=True)

    lead_outcome = Column(String)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    sequences = relationship(
        "FollowUpSequence",
        back_populates="workflow",
        cascade="all, delete"
    )