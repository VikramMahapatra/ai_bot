from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
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

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
