from sqlalchemy import Column, Identity, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.database import Base


class OrganizationZohoIntegration(Base):
    __tablename__ = "organization_zoho_integrations"

    id = Column(Integer, primary_key=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        unique=True,
    )

    integration_connection_id = Column(String(36), nullable=True)

    is_connected = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    is_initialized = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    zoho_email = Column(
        String(255),
        nullable=True,
    )

    auto_calling_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    auto_calling_campaign_id = Column(
        Integer,
        nullable=True,
    )

    auto_email_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    auto_email_campaign_id = Column(
        Integer,
        nullable=True,
    )

    auto_whatsapp_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
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
