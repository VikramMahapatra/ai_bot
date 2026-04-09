from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class OrgCreditBalance(Base):
    __tablename__ = "org_credit_balances"
    __table_args__ = (
        UniqueConstraint("organization_id", "billing_period", name="uq_org_credit_balances_org_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    billing_period = Column(String(16), nullable=False, index=True)  # YYYY-MM
    total_credit = Column(Float, nullable=False, default=0)
    used_credit = Column(Float, nullable=False, default=0)
    remaining_credit = Column(Float, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
