from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class BillingInvoice(Base):
    __tablename__ = "billing_invoices"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    invoice_number = Column(String(64), nullable=False, unique=True, index=True)
    issue_date = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    billing_start_date = Column(DateTime(timezone=True), nullable=True)
    billing_end_date = Column(DateTime(timezone=True), nullable=True)
    amount = Column(Float, nullable=False, default=0)
    paid_amount = Column(Float, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="pending")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
