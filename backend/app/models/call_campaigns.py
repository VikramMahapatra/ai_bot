from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    Identity,
    Index,
    String,
    Boolean,
    DateTime,
    Integer,
    JSON,
    Text,
    func,
)
from sqlalchemy.dialects.sqlite import BLOB
from datetime import datetime
from sqlalchemy.orm import relationship
from app.database import Base


class CallCampaign(Base):
    __tablename__ = "call_campaigns"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    name = Column(String, nullable=False)
    description = Column(Text)
    calling_no = Column(String, nullable=True)
    category = Column(String)
    priority = Column(String)
    status = Column(String, default="Draft")
    agent_id = Column(Integer, ForeignKey("calling_agents.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    total_calls = Column(Integer, default=0)
    completed_calls = Column(Integer, default=0)

    success_rate = Column(Float, default=0.0)
    response_rate = Column(Float, default=0.0)
    instant_reply = Column(Boolean, default=False)

    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=True)

    is_deleted = Column(Boolean, default=False)
    external_campaign_id = Column(Integer, nullable=True)
    external_campaign_name = Column(String, nullable=True)
    stop_reason = Column(String, nullable=True)

    agent = relationship("CallingAgent", back_populates="campaigns")
    contacts = relationship("CampaignContact", back_populates="campaign")
    schedule = relationship(
        "CampaignSchedule", uselist=False, back_populates="campaign"
    )
    call_logs = relationship("CallLog", back_populates="campaign")

    key_insights = relationship(
        "CampaignKeyInsight", back_populates="campaign", cascade="all, delete-orphan"
    )

    sentiments = relationship(
        "CampaignSentiment", back_populates="campaign", cascade="all, delete-orphan"
    )

    ai_recommendations = relationship(
        "CampaignAIRecommendation",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )

    instant_replies = relationship(
        "CallCampaignInstantReply",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_callcampaign_agent_id", "agent_id"),
        Index("idx_callcampaign_status", "status"),
        Index("idx_callcampaign_agent_status", "agent_id", "status"),  # BEST ONE
    )
