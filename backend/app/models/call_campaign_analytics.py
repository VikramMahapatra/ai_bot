from sqlalchemy import Column, Float, ForeignKey, String, Boolean, DateTime, Integer, JSON, Text, func
from sqlalchemy.dialects.sqlite import BLOB
from datetime import datetime
from sqlalchemy.orm import relationship
from app.database import Base

class CampaignKeyInsight(Base):
    __tablename__ = "campaign_key_insights"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("call_campaigns.id"))
    
    title = Column(String)
    description = Column(Text)
    percentage = Column(Float)
    change = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=func.now())

    campaign = relationship("CallCampaign", back_populates="key_insights")
    
    
class CampaignSentiment(Base):
    __tablename__ = "campaign_sentiments"

    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("call_campaigns.id"))

    sentiment = Column(String)  # positive / neutral / negative
    rate = Column(Float)
    value = Column(Integer)

    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("CallCampaign", back_populates="sentiments")
    
class CampaignAIRecommendation(Base):
    __tablename__ = "campaign_ai_recommendations"

    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("call_campaigns.id"))

    recommendation = Column(Text)
    impact_level = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("CallCampaign", back_populates="ai_recommendations")