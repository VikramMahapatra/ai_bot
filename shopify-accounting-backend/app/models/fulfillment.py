import uuid
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class Fulfillment(Base):
    __tablename__ = "fulfillments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)

    shopify_fulfillment_id = Column(BigInteger, unique=True)
    status = Column(String)
    tracking_company = Column(String)
    tracking_number = Column(String)
    shipped_at = Column(DateTime)
    raw_data = Column(JSONB)
