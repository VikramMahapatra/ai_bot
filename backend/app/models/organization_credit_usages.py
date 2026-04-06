from sqlalchemy import Column, Float, Identity, Integer, Boolean, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.database import Base

class OrganizationCreditUsage(Base):
    __tablename__ = "organization_credit_usages"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    price_matrix_item_id = Column(Integer, ForeignKey("price_matrix_items.id"), nullable=False, index=True)

    used_quantity = Column(Float, nullable=False, default=0)
    credits_used = Column(Float, nullable=False, default=0)

    reference_type = Column(String(64), nullable=True)  
    # ex: "call", "email", "api", "campaign"

    reference_id = Column(String(128), nullable=True)
    # ex: call_id / message_id / campaign_id

    created_at = Column(DateTime(timezone=True), server_default=func.now())