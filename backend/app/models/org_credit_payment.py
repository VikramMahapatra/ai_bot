from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class OrgCreditPayment(Base):
    __tablename__ = "org_credit_payments"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("org_credit_invoices.id"), nullable=False, index=True)

    full_partial = Column(String(16), nullable=False, index=True)  # full | partial
    invoice_amount = Column(Float, nullable=False, default=0)
    actual_payment = Column(Float, nullable=False, default=0)
    actual_credit = Column(Float, nullable=False, default=0)

    payment_date = Column(Date, nullable=False, index=True)
    payment_details = Column(Text, nullable=True)
    payment_mode = Column(String(64), nullable=True)
    payment_reference = Column(String(120), nullable=True)
    payment_other_details = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
