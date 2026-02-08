import uuid
from sqlalchemy import (
    Column, String, Boolean, ForeignKey, DateTime, BigInteger, Text, Integer, Numeric
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class OrderLineItem(Base):
    __tablename__ = "order_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    variant_id = Column(BigInteger, nullable=True)  # Shopify variant ID
    shopify_line_item_id = Column(BigInteger, index=True)
    title = Column(String(255))
    quantity = Column(Integer)
    price = Column(Numeric(10, 2))
    sku = Column(String(100))
    raw_data = Column(JSONB)  # store line item JSON

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    order = relationship("Order", back_populates="line_items")
    product = relationship("Product")
