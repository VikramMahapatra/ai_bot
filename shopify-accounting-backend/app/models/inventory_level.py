import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, BigInteger, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class InventoryLevel(Base):
    __tablename__ = "inventory_levels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    inventory_item_id = Column(BigInteger, index=True)
    location_id = Column(BigInteger)
    available = Column(Integer)
    updated_at = Column(DateTime)
    raw_data = Column(JSONB)
