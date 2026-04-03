from sqlalchemy import Column, Identity, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class HandoffAgentAssignment(Base):
    __tablename__ = "handoff_agent_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "widget_id", name="uq_handoff_agent_user_widget"),
    )

    id = Column(Integer, Identity(), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    widget_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
