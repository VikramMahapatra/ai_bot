from sqlalchemy import (
    Column,
    Identity,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from app.database import Base


class ZohoContactSyncState(Base):
    __tablename__ = "zoho_contact_sync_states"

    id = Column(Integer, primary_key=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    connection_id = Column(
        String(36),
        nullable=False,
        index=True,
    )

    external_contact_id = Column(
        String(128),
        nullable=False,
        index=True,
    )

    content_hash = Column(
        String(64),
        nullable=True,
    )

    remote_updated_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_processed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint(
            "connection_id",
            "external_contact_id",
            name="uq_zoho_contact_sync_state",
        ),
    )
