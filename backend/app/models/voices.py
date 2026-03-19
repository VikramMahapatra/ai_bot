import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database import Base

class Voice(Base):
    __tablename__ = "voices"

    id = Column(Integer, primary_key=True, index=True)
    caller_name = Column(String(100))
    voice_id = Column(String(100), index=True)
    provider = Column(String(50))

    gender = Column(String(20))
    language = Column(String(50))
    accent = Column(String(50))

    recording_url = Column(Text)

    is_active = Column(Boolean, default=True)
    is_test_voice = Column(Boolean, default=False)

    created_at = Column(DateTime)
    updated_at = Column(DateTime)