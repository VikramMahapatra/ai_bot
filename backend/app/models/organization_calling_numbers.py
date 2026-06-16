from sqlalchemy import (
    Column,
    Identity,
    Index,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    String,
)
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship


class OrganizationCallingNumber(Base):
    __tablename__ = "organization_calling_numbers"

    id = Column(Integer, Identity(), primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    calling_number_id = Column(
        Integer, ForeignKey("calling_numbers.id"), nullable=False
    )
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    type = Column(String, nullable=False, default="outbound")  # 'outbound' or 'inbound'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    organization = relationship("Organization")
    calling_number = relationship("CallingNumber")

    __table_args__ = (
        Index(
            "uq_inbound_number",
            "calling_number_id",
            unique=True,
            postgresql_where=((type == "inbound") & (is_active.is_(True))),
        ),
    )
