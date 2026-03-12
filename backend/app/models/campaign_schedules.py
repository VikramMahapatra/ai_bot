from sqlalchemy import Column, ForeignKey, String, Boolean, DateTime, Integer, JSON, Text, func
from sqlalchemy.dialects.sqlite import BLOB
from datetime import datetime
from sqlalchemy.orm import relationship
from backend.app.database import Base

class CampaignSchedule(Base):
    __tablename__ = "campaign_schedules"

    id = Column(Integer, primary_key=True, index=True)

    campaign_id = Column(Integer, ForeignKey("campaigns.id"))

    start_datetime = Column(DateTime)
    timezone = Column(String)

    call_start_time = Column(String)
    call_end_time = Column(String)

    call_interval = Column(Integer)

    active_days = Column(String)  # "Mon,Tue,Wed"

    max_retry_attempts = Column(Integer)
    retry_interval = Column(Integer)

    retry_no_answer = Column(Integer)
    retry_busy = Column(Integer)
    retry_voicemail = Column(Integer)

    campaign = relationship("Campaign", back_populates="schedule")