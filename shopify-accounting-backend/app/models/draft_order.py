from sqlalchemy import Column, String, JSON, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, BIGINT
from sqlalchemy.sql import func

from app.db.base import Base


class DraftOrder(Base):
    __tablename__ = "draft_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    shop_id = Column(UUID(as_uuid=True), nullable=False)
    shopify_draft_order_id = Column(BIGINT, unique=True, nullable=False)
    customer_email = Column(String(255))
    total_price = Column(String(50))
    currency = Column(String(10))
    line_items = Column(JSON)
    raw_data = Column(JSON)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
