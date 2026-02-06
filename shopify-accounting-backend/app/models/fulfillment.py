import uuid
from sqlalchemy import Boolean, Column, String, DateTime, Numeric, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base
from sqlalchemy.orm import relationship


class Fulfillment(Base):
    __tablename__ = "fulfillments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)

    shopify_fulfillment_id = Column(BigInteger, unique=True)
    status = Column(String)
    tracking_company = Column(String)
    tracking_number = Column(String)
    shipped_at = Column(DateTime)
    location_id = Column(BigInteger, nullable=True)
    notify_customer = Column(Boolean, default=False)
    raw_data = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    shipping_lines = relationship("ShippingLine", back_populates="fulfillment", cascade="all, delete-orphan")




