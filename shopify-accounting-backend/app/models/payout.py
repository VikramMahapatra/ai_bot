import uuid
from sqlalchemy import Column, String, Numeric, Date, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.base import Base

class Payout(Base):
    __tablename__ = "payouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id = Column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)

    shopify_payout_id = Column(BigInteger)
    status = Column(String)
    currency = Column(String)

    amount = Column(Numeric(10, 2))
    fee = Column(Numeric(10, 2))
    net_amount = Column(Numeric(10, 2))

    payout_date = Column(Date)
    raw_data = Column(JSONB)