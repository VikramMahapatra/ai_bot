from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, func
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
    name = Column(String(255), nullable=False)

    type = Column(Enum(TemplateType), nullable=False)

    subject = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)

    status = Column(Enum(TemplateStatus), default=TemplateStatus.active)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())