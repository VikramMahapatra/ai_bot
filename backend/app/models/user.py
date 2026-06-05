from sqlalchemy import (
    Column,
    Identity,
    Integer,
    String,
    Date,
    DateTime,
    Enum as SQLEnum,
    Boolean,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    USER = "USER"
    USER_HANDOFF = "USER_HANDOFF"


class OrganizationStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TRIAL = "trial"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, Identity(), primary_key=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    joining_date = Column(Date, nullable=True)
    effective_joining_date = Column(Date, nullable=True)
    default_meet_link = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    org_domain = Column(String, unique=True, nullable=False)
    access_token = Column(String, nullable=True)
    status = Column(
        SQLEnum(
            OrganizationStatus,
            values_callable=lambda obj: [e.value for e in obj],
            name="organization_status",
        ),
        nullable=False,
        default=OrganizationStatus.TRIAL,
    )
    trial_end_date = Column(Date, nullable=True)
    echoleads_api_key = Column(String)
    timezone = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    commercial_notes = Column(Text, nullable=True)

    # Relationship
    users = relationship("User", back_populates="organization")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("organization_id", "username", name="uq_users_org_username"),
        UniqueConstraint("organization_id", "email", name="uq_users_org_email"),
    )

    id = Column(Integer, Identity(), primary_key=True)
    username = Column(String, index=True, nullable=False)
    email = Column(
        String, index=True, nullable=False
    )  # Removed unique=True to allow same email across orgs
    hashed_password = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    organization = relationship("Organization", back_populates="users")
