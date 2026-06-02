import uuid
from datetime import datetime
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Identity,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Voice(Base):
    __tablename__ = "voices"

    id = Column(Integer, Identity(), primary_key=True)
    external_id = Column(Integer, unique=True, index=True)
    caller_name = Column(String(100))
    voice_id = Column(String(100), index=True)
    provider = Column(String(50))

    gender = Column(String(20))
    languages = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)

    accent = Column(String(50))
    recording_url = Column(Text)
    voice_types = Column(JSON, nullable=True)

    is_active = Column(Boolean, default=True)
    is_test_voice = Column(Boolean, default=False)

    is_cloned_voice = Column(Boolean, default=False)
    is_vapi_voice = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class VoiceSync(Base):
    __tablename__ = "voice_sync"

    organization_id = Column(Integer, primary_key=True)
    last_synced_at = Column(DateTime(timezone=True))
