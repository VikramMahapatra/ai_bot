import datetime

from sqlalchemy import Boolean, Column, Identity, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class FollowUpSequence(Base):
    __tablename__ = "followup_sequences"

    id = Column(Integer, primary_key=True)

    workflow_id = Column(
        Integer,
        ForeignKey("followup_workflows.id")
    )

    sequence_order = Column(Integer)

    delay_value = Column(Integer)

    delay_unit = Column(String)  # minutes/hours/days

    mode = Column(String)  # call/email/sms/whatsapp

    agent_id = Column(Integer, nullable=True)

    subject = Column(String, nullable=True)

    template = Column(Text, nullable=True)

    agent_prompt = Column(Text, nullable=True)

    workflow = relationship(
        "FollowUpWorkflow",
        back_populates="sequences"
    )