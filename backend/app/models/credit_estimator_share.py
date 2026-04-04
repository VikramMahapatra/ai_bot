from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class CreditEstimatorShare(Base):
    __tablename__ = "credit_estimator_shares"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(96), unique=True, index=True, nullable=False)
    company_name = Column(String(255), nullable=False, default="Untitled Company")
    created_by_superadmin_id = Column(Integer, ForeignKey("super_admins.id"), nullable=True)
    input_json = Column(Text, nullable=False, default="{}")
    estimate_json = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
