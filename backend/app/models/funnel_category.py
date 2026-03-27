from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class FunnelCategory(Base):
    __tablename__ = "funnel_categories"
    __table_args__ = (
        UniqueConstraint("organization_id", "key", name="uq_funnel_categories_org_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    key = Column(String, nullable=False, index=True)
    color = Column(String, nullable=False, default="#4e89d5")
    position = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
