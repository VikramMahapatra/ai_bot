from sqlalchemy import Column, Integer, Boolean, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.config import settings


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

    default_escalation_level_1 = Column(String, nullable=True)
    default_escalation_level_2 = Column(String, nullable=True)

    expected_close_days = Column(Integer, nullable=True)

    organization = relationship("Organization")

    @property
    def DEFAULT_ESCALATION_CONTACT_LEVEL_1(self) -> str:
        value = (self.default_escalation_level_1 or "").strip()
        return value or settings.DEFAULT_ESCALATION_CONTACT_LEVEL_1

    @DEFAULT_ESCALATION_CONTACT_LEVEL_1.setter
    def DEFAULT_ESCALATION_CONTACT_LEVEL_1(self, value: str | None) -> None:
        self.default_escalation_level_1 = (value or "").strip() or None

    @property
    def DEFAULT_ESCALATION_CONTACT_LEVEL_2(self) -> str:
        value = (self.default_escalation_level_2 or "").strip()
        return value or settings.DEFAULT_ESCALATION_CONTACT_LEVEL_2

    @DEFAULT_ESCALATION_CONTACT_LEVEL_2.setter
    def DEFAULT_ESCALATION_CONTACT_LEVEL_2(self, value: str | None) -> None:
        self.default_escalation_level_2 = (value or "").strip() or None
