import json
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, 
    func, BigInteger, Numeric
)
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
    sku = Column(String(100), nullable=True)
    vendor = Column(String(255), nullable=True)
    product_type = Column(String(255), nullable=True)
    handle = Column(String(255), nullable=True)
    tags = Column(String, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    cost = Column(Numeric(10, 2), nullable=True)
    active = Column(Boolean, default=True)
    variants = Column(JSON, nullable=True)
    raw_data = Column(JSON, nullable=True)

    last_synced_inventory_at = Column(DateTime, nullable=True)  # optional
    total_sales_count = Column(Integer, default=0)               # optional
    total_sales_amount = Column(Numeric(12,2), default=0.0)     # optional

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shop = relationship("Shop", back_populates="products")