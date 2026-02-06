import uuid
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base

class OrderTransaction(Base):
    __tablename__ = "order_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)

    shopify_transaction_id = Column(BigInteger)
    gateway = Column(String)
    kind = Column(String)
    status = Column(String)
    amount = Column(Numeric(10, 2))

    processed_at = Column(DateTime(timezone=True))
    raw_data = Column(JSONB)
    
    order = relationship("Order")