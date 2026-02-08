import uuid
from sqlalchemy import (
    Column, String, Boolean, ForeignKey, DateTime, BigInteger, Text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Page(Base):
    __tablename__ = "pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)

    shopify_page_id = Column(BigInteger, nullable=False, unique=True)

    title = Column(String(255))
    handle = Column(String(255))
    published_at = Column(DateTime(timezone=True))

    raw_data = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shop = relationship("Shop", back_populates="pages")
