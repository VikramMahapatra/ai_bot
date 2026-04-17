from sqlalchemy import Column, Identity, Integer, String, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    id = Column(Integer, Identity(), primary_key=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    source = Column(String(50), nullable=True, index=True)
    session_id = Column(String(100), nullable=True, index=True)
    campaign_id = Column(
        Integer,
        nullable=True,
        index=True
    )
    activity_datetime = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )

    status = Column(String(150), nullable=True, index=True)
    attempt_label = Column(String(50), nullable=True)

    summary = Column(Text, nullable=True)
    outcome = Column(String(50), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    lead = relationship("Lead", backref="activities")