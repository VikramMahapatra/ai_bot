from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class TwilioSmsChannel(Base):
    __tablename__ = "twilio_sms_channels"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), unique=True, nullable=False, index=True)
    account_sid = Column(String, nullable=False)
    auth_token = Column(String, nullable=False)
    from_phone_number = Column(String, nullable=False)
    inbound_phone_number = Column(String, nullable=True)
    location_label = Column(String, nullable=True)
    voice_webhook_url = Column(String, nullable=True)
    messaging_webhook_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
