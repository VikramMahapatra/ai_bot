import uuid
from sqlalchemy import (
    Column, String, Boolean, ForeignKey, DateTime, BigInteger, Text, Numeric
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ShippingLine(Base):
    __tablename__ = "shipping_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fulfillment_id = Column(UUID(as_uuid=True), ForeignKey("fulfillments.id"), nullable=False)

    title = Column(String(255))
    price = Column(Numeric(10,2))
    code = Column(String(50))
    carrier_identifier = Column(String(255))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    fulfillment = relationship("Fulfillment", back_populates="shipping_lines")
