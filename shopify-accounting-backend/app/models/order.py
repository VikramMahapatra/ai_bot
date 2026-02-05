import uuid
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, BigInteger, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)

    shopify_order_id = Column(BigInteger, unique=True, nullable=False)
    order_number = Column(String)
    order_date = Column(DateTime(timezone=True))
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    customer_email = Column(String(255), nullable=True)
    customer_name = Column(String(255), nullable=True)

    financial_status = Column(String)
    fulfillment_status = Column(String)

    subtotal_price = Column(Numeric(10, 2))
    total_tax = Column(Numeric(10, 2))
    total_discount = Column(Numeric(10, 2))
    total_price = Column(Numeric(10, 2))

    currency = Column(String)
    raw_data = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())