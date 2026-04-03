from sqlalchemy import Column, Identity, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, Identity(), primary_key=True)
    session_id = Column(String, index=True, nullable=False)
    widget_id = Column(String, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)

    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    timezone = Column(String, nullable=True)

    appointment_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String, nullable=False, default="booked")

# These lines of code are defining two columns in the `Appointment` table:
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
