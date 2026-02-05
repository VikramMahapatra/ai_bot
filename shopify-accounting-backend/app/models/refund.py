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
    created_at = Column(DateTime)
    raw_data = Column(JSONB)
