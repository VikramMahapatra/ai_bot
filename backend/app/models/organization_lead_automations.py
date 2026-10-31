from sqlalchemy import Column, Identity, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.database import Base


class OrganizationLeadAutomation(Base):
    __tablename__ = "organization_lead_automations"

    id = Column(Integer, primary_key=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    auto_calling_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    auto_calling_campaign_id = Column(
        Integer,
        nullable=True,
    )

    auto_email_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    auto_email_campaign_id = Column(
        Integer,
        nullable=True,
    )

    auto_whatsapp_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    auto_whatsapp_campaign_id = Column(
        Integer,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
