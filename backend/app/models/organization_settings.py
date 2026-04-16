from sqlalchemy import Column, Integer, Boolean, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class OrganizationSettings(Base):
    __tablename__ = "organization_settings"

    id = Column(Integer, primary_key=True, index=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # -------- General Settings --------
    enable_email_notifications = Column(Boolean, default=True)
    auto_save_conversations = Column(Boolean, default=True)
    dark_mode = Column(Boolean, default=False)
    show_analytics_dashboard = Column(Boolean, default=True)

    # -------- AI Settings --------
    enable_rag = Column(Boolean, default=True)
    use_semantic_search = Column(Boolean, default=True)
    auto_vectorize_documents = Column(Boolean, default=True)
    enable_debugging = Column(Boolean, default=False)

    # -------- Lead Settings --------
    auto_capture_leads = Column(Boolean, default=True)
    require_email_for_lead = Column(Boolean, default=True)
    send_lead_notifications = Column(Boolean, default=False)

    # -------- SMTP Settings --------
    smtp_host = Column(String, nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_username = Column(String, nullable=True)
    smtp_password = Column(String, nullable=True)
    smtp_sender_email = Column(String, nullable=True)
    smtp_use_tls = Column(Boolean, default=True)

    default_escalation_level_1 = Column(String, nullable=True)
    default_escalation_level_2 = Column(String, nullable=True)

    expected_close_days = Column(Integer, nullable=True)

    organization = relationship("Organization")
