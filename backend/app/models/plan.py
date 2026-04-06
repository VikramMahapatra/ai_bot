from sqlalchemy import Column, Identity, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, Identity(), primary_key=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    price_inr = Column(Integer, nullable=False, default=0)
    billing_cycle = Column(String, nullable=False, default="monthly")  # monthly|yearly
    is_active = Column(Boolean, default=True, nullable=False)

    monthly_conversation_limit = Column(Integer, default=1000)
    monthly_crawl_pages_limit = Column(Integer, default=1000)
    max_crawl_depth = Column(Integer, default=3)
    monthly_document_limit = Column(Integer, default=100)
    max_document_size_mb = Column(Integer, default=20)
    monthly_token_limit = Column(Integer, default=200000)
    max_query_words = Column(Integer, default=200)
    lead_generation_enabled = Column(Boolean, default=True)
    voice_chat_enabled = Column(Boolean, default=False)
    multilingual_text_enabled = Column(Boolean, default=False)
    whatsapp_enabled = Column(Boolean, default=False)
    human_handoff_enabled = Column(Boolean, default=False)
    email_campaign_enabled = Column(Boolean, default=True)
    sms_campaign_enabled = Column(Boolean, default=True)

    module_knowledge_enabled = Column(Boolean, default=True)
    module_leads_enabled = Column(Boolean, default=True)
    module_analytics_enabled = Column(Boolean, default=True)
    module_advanced_analytics_enabled = Column(Boolean, default=True)
    module_reports_enabled = Column(Boolean, default=True)
    module_campaigns_enabled = Column(Boolean, default=True)
    module_appointments_enabled = Column(Boolean, default=True)
    module_products_enabled = Column(Boolean, default=True)
    module_users_enabled = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
