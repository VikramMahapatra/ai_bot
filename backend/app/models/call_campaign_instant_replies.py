from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class CallCampaignInstantReply(Base):
    __tablename__ = "call_campaign_instant_replies"

    id = Column(Integer, primary_key=True, index=True)

    call_campaign_id = Column(
        Integer,
        ForeignKey("call_campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    mode = Column(
        String(20),  # whatsapp / sms / email
        nullable=False
    )

    template_id = Column(
        Integer,
        ForeignKey("message_templates.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Relationship
    campaign = relationship(
        "CallCampaign",
        back_populates="instant_replies"
    )
    
    template = relationship("MessageTemplate")