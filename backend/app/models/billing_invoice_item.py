from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class BillingInvoiceItem(Base):
    __tablename__ = "billing_invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("billing_invoices.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    price_matrix_item_id = Column(Integer, ForeignKey("price_matrix_items.id"), nullable=True, index=True)
    category = Column(String(120), nullable=False, default="")
    module = Column(String(120), nullable=False, default="")
    sub_module = Column(String(180), nullable=True)
    billing_unit = Column(String(120), nullable=True)
    quantity = Column(Float, nullable=True)
    credits_per_unit = Column(Float, nullable=True)
    allocated_credits = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
