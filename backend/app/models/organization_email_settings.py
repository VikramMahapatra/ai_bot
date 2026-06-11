from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Boolean, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class OrganizationEmailSetting(Base):
    __tablename__ = "organization_email_settings"

    id = Column(Integer, primary_key=True, index=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String, nullable=False)  # e.g. Sales, Support, Marketing

    smtp_host = Column(String, nullable=False)
    smtp_port = Column(Integer, nullable=False)
    smtp_username = Column(String, nullable=True)
    smtp_password = Column(String, nullable=True)

    sender_email = Column(String, nullable=False)
    reply_to_email = Column(String, nullable=True)
    sender_name = Column(String, nullable=True)
    cc_emails = Column(String, nullable=True)

    use_tls = Column(Boolean, default=True)

    is_default = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    organization = relationship(
        "Organization",
        back_populates="email_settings",
    )
