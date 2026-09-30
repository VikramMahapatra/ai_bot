from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


class QualificationEngineIntegration(Base):
    __tablename__ = "qualification_engine_integrations"

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            name="uq_qualification_engine_integration_tenant",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    # Tenant ID returned by the standalone Qualification Service
    tenant_id = Column(
        String(100),
        nullable=False,
    )

    # Store encrypted tenant API key
    api_key = Column(
        Text,
        nullable=False,
    )

    enabled = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    organization = relationship(
        "Organization",
        back_populates="qualification_engine_integration",
    )
