from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class PriceMatrixItem(Base):
    __tablename__ = "price_matrix_items"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(120), nullable=False, index=True)
    module = Column(String(120), nullable=False, index=True)
    sub_module = Column(String(160), nullable=True)
    feature_code = Column(String(120), nullable=True, unique=True, index=True)
    billing_unit = Column(String(120), nullable=True)
    credits_per_unit = Column(Float, nullable=True)
    min_reserved_credits  = Column(Float, nullable=True)
    credit_formula = Column(Text, nullable=True)
    definition = Column(Text, nullable=True)
    overage_handling = Column(String(160), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
