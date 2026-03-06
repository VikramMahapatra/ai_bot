from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class WhatsAppChannel(Base):
    __tablename__ = "whatsapp_channels"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), unique=True, nullable=False, index=True)
    widget_id = Column(String, nullable=False, index=True)
    phone_number_id = Column(String, nullable=False, unique=True, index=True)
    waba_id = Column(String, nullable=True)
    access_token = Column(String, nullable=False)
    verify_token = Column(String, nullable=False)
    business_phone_number = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
