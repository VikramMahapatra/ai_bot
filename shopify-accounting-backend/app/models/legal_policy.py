import uuid
from sqlalchemy import (
    Column, String, Boolean, ForeignKey, DateTime, BigInteger, Text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class LegalPolicy(Base):
    __tablename__ = "legal_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)

    policy_type = Column(String(50), nullable=False)  
    # refund, privacy, terms_of_service, shipping_policy

    title = Column(String(255))
    body = Column(Text)

    shopify_updated_at = Column(DateTime(timezone=True))

    raw_data = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    shop = relationship("Shop", back_populates="legal_policies")
