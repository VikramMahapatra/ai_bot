from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship

class OrganizationCallingNumber(Base):
    __tablename__ = "organization_calling_numbers"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    calling_number = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    organization = relationship("Organization")