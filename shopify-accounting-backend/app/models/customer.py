import json
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, func, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

# -------------------------------
# Customer Model
# -------------------------------
class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    shopify_customer_id  = Column(BigInteger, unique=True, nullable=False)
    display_name  = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    verified_email = Column(Boolean, default=False)
    raw_data = Column(JSON, nullable=True)        # Full Shopify customer JSON

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shop = relationship("Shop", back_populates="customers")