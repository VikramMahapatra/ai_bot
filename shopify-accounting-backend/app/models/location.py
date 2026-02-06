import uuid
from sqlalchemy import (
    Column, String, Boolean, ForeignKey, DateTime, BigInteger, Text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Location(Base):
    __tablename__ = "locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)

    shopify_location_id = Column(BigInteger, nullable=False, unique=True)

    name = Column(String(255))
    active = Column(Boolean)

    address1 = Column(String(255))
    city = Column(String(100))
    country = Column(String(100))

    raw_data = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shop = relationship("Shop", back_populates="locations")
