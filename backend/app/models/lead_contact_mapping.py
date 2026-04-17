from sqlalchemy import Column, Identity, Integer, String, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship

class LeadContactMapping(Base):
    __tablename__ = "lead_contact_mapping"

    id = Column(Integer, Identity(), primary_key=True)

    lead_id = Column(
        Integer,
        ForeignKey("leads.id"),
        nullable=False,
        index=True
    )

    contact_id = Column(
        Integer,
        ForeignKey("contacts.id"),
        nullable=False,
        index=True
    )

    source = Column(String(50), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Relationships
    lead = relationship("Lead", backref="contact_mappings")
    contact = relationship("Contact", backref="lead_mappings")