from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class OrgCredit(Base):
    __tablename__ = "org_credits"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    estimator_id = Column(Integer, ForeignKey("credit_estimator_shares.id"), nullable=False, index=True)
    parent_org_credit_id = Column(Integer, ForeignKey("org_credits.id"), nullable=True, index=True)

    total_credit = Column(Float, nullable=False, default=0)
    billing_cycle = Column(String(16), nullable=False, default="monthly")
    payment_status = Column(String(16), nullable=False, default="unpaid")
    billing_start_date = Column(Date, nullable=False, index=True)
    billing_end_date = Column(Date, nullable=False, index=True)
    billing_month = Column(String(16), nullable=False, index=True)  # YYYY-MM

    is_topup = Column(Boolean, nullable=False, default=False)
    topup_credit = Column(Float, nullable=True)
    is_auto_generated = Column(Boolean, nullable=False, default=False)
    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
