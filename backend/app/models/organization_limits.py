from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class OrganizationLimits(Base):
    __tablename__ = "organization_limits"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), unique=True, nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=True, index=True)

    # Overrides (nullable => use plan defaults)
    monthly_conversation_limit = Column(Integer, nullable=True)
    monthly_crawl_pages_limit = Column(Integer, nullable=True)
    max_crawl_depth = Column(Integer, nullable=True)
    monthly_document_limit = Column(Integer, nullable=True)
    max_document_size_mb = Column(Integer, nullable=True)
    monthly_token_limit = Column(Integer, nullable=True)
    max_query_words = Column(Integer, nullable=True)
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
    
    max_agents = Column(Integer, nullable=True)       # max number of agents
    max_campaigns = Column(Integer, nullable=True)    # max number of campaigns
    max_calls = Column(Integer, nullable=True)        # max number of calls

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
