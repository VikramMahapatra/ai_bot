from sqlalchemy import Column, ForeignKey, Integer, String, Text, Enum, DateTime, func
from app.database import Base
import enum


class TemplateType(str, enum.Enum):
    sms = "sms"
    whatsapp = "whatsapp"
    email = "email"


class TemplateStatus(str, enum.Enum):
    active = "Active"
    inactive = "Inactive"


class MessageTemplate(Base):
    __tablename__ = "message_templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False
    )
    name = Column(String(255), nullable=False)

    type = Column(Enum(TemplateType), nullable=False)

    subject = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)

    status = Column(Enum(TemplateStatus), default=TemplateStatus.active)
    
    whatsapp_template_name = Column(String(255), nullable=True)

    category = Column(String(50), nullable=True)   # MARKETING / UTILITY / AUTHENTICATION
    language = Column(String(20), nullable=True)   # en / en_US

    meta_template_id = Column(String(255), nullable=True)
    meta_status = Column(String(50), nullable=True)  # PENDING / APPROVED / REJECTED
    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())