from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class BillingBill(Base):
    __tablename__ = "billing_bills"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("billing_invoices.id"), nullable=False, unique=True, index=True)
    payment_id = Column(Integer, ForeignKey("billing_payments.id"), nullable=True, index=True)
    bill_number = Column(String(64), nullable=False, unique=True, index=True)
    issued_date = Column(DateTime(timezone=True), nullable=False)
    amount = Column(Float, nullable=False, default=0)
    payment_method = Column(String(64), nullable=True)
    payment_reference = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
