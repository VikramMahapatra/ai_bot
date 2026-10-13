from sqlalchemy import Column, Identity, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class ZohoAutomationLog(Base):
    __tablename__ = "zoho_automation_logs"

    id = Column(Integer, primary_key=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    integration_id = Column(
        Integer,
        ForeignKey("organization_zoho_integrations.id"),
        nullable=False,
        index=True,
    )

    zoho_event_id = Column(
        String(128),
        nullable=True,
        index=True,
    )

    contact_id = Column(
        Integer,
        ForeignKey("contacts.id"),
        nullable=False,
        index=True,
    )

    campaign_id = Column(
        Integer,
        ForeignKey("campaigns.id"),
        nullable=True,
        index=True,
    )

    automation_type = Column(
        String(20),
        nullable=False,
        index=True,
    )
    # email / whatsapp / call

    status = Column(
        String(20),
        nullable=False,
        default="pending",
        index=True,
    )
    # pending / processing / scheduled / completed / failed / skipped

    attempts = Column(
        Integer,
        nullable=False,
        default=0,
    )

    error_message = Column(
        Text,
        nullable=True,
    )

    scheduled_at = Column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # For call automation
    external_call_id = Column(
        String,
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
