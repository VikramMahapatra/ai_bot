from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class OrganizationSubscriptionUsage(Base):
    __tablename__ = "organization_subscription_usage"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False, index=True)
    period_end = Column(DateTime(timezone=True), nullable=False, index=True)

    conversations_count = Column(Integer, default=0)
    messages_count = Column(Integer, default=0)
    crawl_pages_count = Column(Integer, default=0)
    documents_count = Column(Integer, default=0)
    tokens_used = Column(Integer, default=0)
    leads_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("organization_id", "period_start", name="uq_org_sub_usage_period"),
    )
