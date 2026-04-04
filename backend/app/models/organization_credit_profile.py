from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class OrganizationCreditProfile(Base):
    __tablename__ = "organization_credit_profiles"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, unique=True, index=True)
    total_price = Column(Float, nullable=False, default=0)
    buffer_percent = Column(Float, nullable=False, default=0)
    discount_percent = Column(Float, nullable=False, default=0)
    payment_status = Column(String(32), nullable=False, default="pending")
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    expiry_days = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
