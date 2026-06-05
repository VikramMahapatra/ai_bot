from sqlalchemy import Column, Identity, Integer, Boolean, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.database import Base


class OrganizationLimits(Base):
    __tablename__ = "organization_limits"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), unique=True, nullable=False, index=True
    )

    lead_generation_enabled = Column(Boolean, nullable=True)
    voice_chat_enabled = Column(Boolean, nullable=True)
    multilingual_text_enabled = Column(Boolean, nullable=True)
    whatsapp_enabled = Column(Boolean, nullable=True)
    human_handoff_enabled = Column(Boolean, nullable=True)
    email_campaign_enabled = Column(Boolean, nullable=True)
    sms_campaign_enabled = Column(Boolean, nullable=True)

    module_knowledge_enabled = Column(Boolean, nullable=True)
    module_leads_enabled = Column(Boolean, nullable=True)
    module_analytics_enabled = Column(Boolean, nullable=True)
    module_advanced_analytics_enabled = Column(Boolean, nullable=True)
    module_reports_enabled = Column(Boolean, nullable=True)
    module_campaigns_enabled = Column(Boolean, nullable=True)
    module_appointments_enabled = Column(Boolean, nullable=True)
    module_products_enabled = Column(Boolean, nullable=True)
    module_users_enabled = Column(Boolean, nullable=True)

    instagram_chat_enabled = Column(Boolean, nullable=False, default=False)
    facebook_messenger_enabled = Column(Boolean, nullable=False, default=False)
    whatsapp_campaign_enabled = Column(Boolean, nullable=False, default=False)

    call_forwarding_enabled = Column(Boolean, nullable=False, default=False)
    inbound_voice_enabled = Column(Boolean, nullable=False, default=False)
    outbound_voice_enabled = Column(Boolean, nullable=False, default=False)
    ai_assistant_campaign_enabled = Column(Boolean, nullable=False, default=False)

    module_followup_workflow_enabled = Column(Boolean, nullable=False, default=False)

    outbound_call_billing_model = Column(String(20), nullable=True)
    max_outbound_voice_agents = Column(Integer, nullable=True)
    max_inbound_voice_agents = Column(Integer, nullable=True)
    max_outbound_calls = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
