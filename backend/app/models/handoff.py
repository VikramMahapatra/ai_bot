from sqlalchemy import Column, Identity, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.database import Base


class HandoffSession(Base):
    __tablename__ = "handoff_sessions"

    id = Column(Integer, Identity(), primary_key=True)
    chat_id = Column(String, unique=True, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=False)
    widget_id = Column(String, index=True, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    status = Column(String, nullable=False, default="waiting_for_agent", index=True)
    assigned_agent_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    handoff_reason = Column(Text, nullable=True)
    bot_suggested_answer = Column(Text, nullable=True)
    wait_cycle = Column(Integer, nullable=False, default=1)
    waiting_expires_at = Column(DateTime(timezone=True), nullable=True)
    waiting_timeout_notified = Column(Boolean, nullable=False, default=False)
    call_room_id = Column(String, nullable=True)
    call_status = Column(String, nullable=False, default="none", index=True)  # none | requested | active | ended
    call_mode = Column(String, nullable=False, default="video")  # video | audio
    call_requested_at = Column(DateTime(timezone=True), nullable=True)
    call_started_at = Column(DateTime(timezone=True), nullable=True)
    call_ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)


class HandoffMessage(Base):
    __tablename__ = "handoff_messages"

    id = Column(Integer, primary_key=True, index=True)
    handoff_session_id = Column(Integer, ForeignKey("handoff_sessions.id"), index=True, nullable=False)
    sender_type = Column(String, nullable=False, index=True)  # user | agent | bot | system
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
