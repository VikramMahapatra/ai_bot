from sqlalchemy import Column, ForeignKey, String, Boolean, DateTime, Integer, JSON, Text, func
from sqlalchemy.dialects.sqlite import BLOB
from datetime import datetime
from sqlalchemy.orm import relationship
from app.database import Base

class CampaignContact(Base):
    __tablename__ = "campaign_contacts"

    id = Column(Integer, primary_key=True, index=True)

    campaign_id = Column(Integer, ForeignKey("call_campaigns.id"))
    contact_id = Column(Integer, ForeignKey("contacts.id"))

    status = Column(String, default="Pending")

    campaign = relationship("CallCampaign", back_populates="contacts")