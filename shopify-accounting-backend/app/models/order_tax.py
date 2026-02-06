import uuid
from sqlalchemy import Column, String, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class OrderTaxLine(Base):
    __tablename__ = "order_tax_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)

    title = Column(String)  # CGST / SGST / IGST
    rate = Column(Numeric(5, 2))
    amount = Column(Numeric(10, 2))