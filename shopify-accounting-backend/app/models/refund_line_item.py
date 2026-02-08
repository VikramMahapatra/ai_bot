import uuid
from sqlalchemy import (
    Column, String, Boolean, ForeignKey, DateTime, BigInteger, Text, Integer, Numeric
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class RefundLineItem(Base):
    __tablename__ = "refund_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    refund_id = Column(UUID(as_uuid=True), ForeignKey("refunds.id"), nullable=False)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)

    shopify_line_item_id = Column(BigInteger, index=True)

    product_id = Column(BigInteger, nullable=True)
    variant_id = Column(BigInteger, nullable=True)

    title = Column(String(255))
    sku = Column(String(100))

    quantity = Column(Integer)
    price = Column(Numeric(10,2))
    total = Column(Numeric(10,2))

    reason = Column(String(255))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    refund = relationship("Refund", backref="line_items")

