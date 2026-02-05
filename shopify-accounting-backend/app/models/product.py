import json
import uuid
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, func, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

# -------------------------------
# Product Model
# -------------------------------
class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    shopify_product_id = Column(BigInteger, unique=True, nullable=False)
    
    title = Column(String(255), nullable=True)
    vendor = Column(String(255), nullable=True)
    product_type = Column(String(255), nullable=True)
    variants = Column(JSON, nullable=True)        # List of variant objects
    raw_data = Column(JSON, nullable=True)       # Full Shopify product JSON

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shop = relationship("Shop", back_populates="products")



