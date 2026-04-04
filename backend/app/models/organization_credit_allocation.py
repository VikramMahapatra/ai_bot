from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer
from sqlalchemy.sql import func

from app.database import Base


class OrganizationCreditAllocation(Base):
    __tablename__ = "organization_credit_allocations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    price_matrix_item_id = Column(Integer, ForeignKey("price_matrix_items.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=True)
    credits_per_unit = Column(Float, nullable=True)
    allocated_credits = Column(Float, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
