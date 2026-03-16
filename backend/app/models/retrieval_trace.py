from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float, Boolean
from sqlalchemy.sql import func
from app.database import Base


class RetrievalTrace(Base):
    __tablename__ = "retrieval_traces"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    widget_id = Column(String, nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    user_query = Column(Text, nullable=False)
    retrieval_query = Column(Text, nullable=True)
    query_variants = Column(Text, nullable=True)  # JSON array string
    retrieved_chunks = Column(Text, nullable=True)  # JSON array string
    selected_chunks = Column(Text, nullable=True)  # JSON array string
    source_ids = Column(Text, nullable=True)  # JSON array string

    has_context = Column(Boolean, default=False)
    escalation_triggered = Column(Boolean, default=False)
    top_distance = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
