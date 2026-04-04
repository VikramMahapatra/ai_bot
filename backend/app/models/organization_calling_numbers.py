from sqlalchemy import Column, Identity, Integer, Boolean, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship

class OrganizationCallingNumber(Base):
    __tablename__ = "organization_calling_numbers"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    calling_number = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    type = Column(String, nullable=False, default="outbound") # 'outbound' or 'inbound'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization")