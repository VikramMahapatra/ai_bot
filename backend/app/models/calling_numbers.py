from sqlalchemy import Column, Identity, Integer, Boolean, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship


class CallingNumber(Base):
    __tablename__ = "calling_numbers"

    id = Column(Integer, Identity(), primary_key=True)
    type = Column(String, nullable=False, default="outbound")
    phone_number = Column(String, unique=True, nullable=False)

    provider = Column(String)
    country_code = Column(String)

    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
