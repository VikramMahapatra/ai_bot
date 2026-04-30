from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Identity,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True)
    name = Column(String)

    channel_type = Column(String)
    # "free" | "paid"
    is_active = Column(Boolean, default=True)


class OrganizationChannel(Base):
    __tablename__ = "organization_channels"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id"))


class ChannelReservation(Base):
    __tablename__ = "channel_reservations"

    id = Column(Integer, primary_key=True)

    organization_id = Column(Integer, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id"), index=True)

    call_type = Column(String)  # "test" | "campaign"

    reference_id = Column(Integer)
    # can store your internal call id / external id

    is_active = Column(Boolean, default=True, index=True)

    reserved_at = Column(DateTime, default=datetime.utcnow)
    released_at = Column(DateTime, nullable=True)
