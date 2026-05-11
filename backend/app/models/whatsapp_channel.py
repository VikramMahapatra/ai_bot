from sqlalchemy import Column, Identity, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class WhatsAppChannel(Base):
    __tablename__ = "whatsapp_channels"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    widget_id = Column(String, nullable=True, index=True)
    phone_number_id = Column(String, nullable=False, unique=True, index=True)
    waba_id = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
    verify_token = Column(String, nullable=True)
    business_phone_number = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    token_type = Column(String, nullable=True)
    token_expires_in = Column(Integer, nullable=True)
    token_created_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    token_expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
