from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class BillingPayment(Base):
    __tablename__ = "billing_payments"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("billing_invoices.id"), nullable=True, index=True)
    amount = Column(Float, nullable=False, default=0)
    payment_date = Column(DateTime(timezone=True), nullable=False)
    method = Column(String(64), nullable=False, default="bank_transfer")
    reference = Column(String(120), nullable=True)
    status = Column(String(32), nullable=False, default="completed")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
