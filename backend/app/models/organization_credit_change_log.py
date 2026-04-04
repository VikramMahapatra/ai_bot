from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class OrganizationCreditChangeLog(Base):
    __tablename__ = "organization_credit_change_logs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    price_matrix_item_id = Column(Integer, ForeignKey("price_matrix_items.id"), nullable=True, index=True)
    change_type = Column(String(64), nullable=False, index=True)
    previous_json = Column(Text, nullable=True)
    new_json = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
