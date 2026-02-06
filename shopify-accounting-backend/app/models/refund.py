import uuid
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class Refund(Base):
    __tablename__ = "refunds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    shopify_refund_id = Column(BigInteger, unique=True)
    total_amount = Column(Numeric)
    currency = Column(String(10), nullable=True)        # new
    refund_reason = Column(String(255), nullable=True)  # new
    processed_at = Column(DateTime, nullable=True)      # optional, for your system
    created_at = Column(DateTime)                       # Shopify created_at
    raw_data = Column(JSONB)

