from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Identity,
    Index,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, Identity(), primary_key=True)
    session_id = Column(String, index=True, nullable=False)
    widget_id = Column(String, index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=True, index=True
    )
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True, index=True)
    source = Column(String(50), nullable=True, index=True)
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    outcome = Column(
        String, nullable=True, index=True
    )  # Session-level outcome status (positive/negative/satisfactory/etc.)
    is_lead = Column(Boolean, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    feedback = relationship(
        "MessageFeedback", back_populates="conversation", cascade="all, delete-orphan"
    )
    contact = relationship("Contact")


class ConversationEvaluation(Base):
    __tablename__ = "conversation_evaluations"

    id = Column(Integer, Identity(), primary_key=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    session_id = Column(
        String,
        nullable=False,
        index=True,
    )

    template_id = Column(
        Integer,
        ForeignKey("qualification_templates.id"),
        nullable=True,
        index=True,
    )

    engine_template_id = Column(
        String,
        nullable=True,
        index=True,
    )

    template_version = Column(
        String(32),
        nullable=True,
    )

    # Qualification Engine evaluation ID.
    # NULL when evaluation was skipped or failed.
    evaluation_id = Column(
        String,
        nullable=True,
        unique=True,
        index=True,
    )

    # evaluated
    # skipped_no_customer_message
    # failed
    evaluation_status = Column(
        String(30),
        nullable=False,
        default="evaluated",
        index=True,
    )

    qualified = Column(
        Boolean,
        nullable=True,
        index=True,
    )

    outcome = Column(
        String(50),
        nullable=True,
        index=True,
    )

    score = Column(
        Integer,
        nullable=True,
    )

    temperature = Column(
        String(32),
        nullable=True,
    )

    evidence_level = Column(
        String(32),
        nullable=True,
    )

    # Exact JSON body sent to Qualification Engine.
    # Do not store authentication headers/API keys here.
    evaluation_request = Column(
        JSON,
        nullable=True,
    )

    # Complete response returned by Qualification Engine.
    evaluation_response = Column(
        JSON,
        nullable=True,
    )

    # Error returned/raised when Engine evaluation fails.
    evaluation_error = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "ix_conversation_evaluations_org_session",
            "organization_id",
            "session_id",
        ),
    )
