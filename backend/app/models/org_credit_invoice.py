from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class OrgCreditInvoice(Base):
    __tablename__ = "org_credit_invoices"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    org_credit_id = Column(Integer, ForeignKey("org_credits.id"), nullable=False, index=True)
    reference_invoice_id = Column(Integer, ForeignKey("org_credit_invoices.id"), nullable=True, index=True)

    total_credit = Column(Float, nullable=False, default=0)
    invoice_amount = Column(Float, nullable=False, default=0)
    paid_amount = Column(Float, nullable=False, default=0)

    billing_month = Column(String(16), nullable=False, index=True)  # YYYY-MM
    invoice_date = Column(Date, nullable=False, index=True)
    payment_done_flag = Column(Boolean, nullable=False, default=False, index=True)
    notes = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
