from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
import enum


class SourceType(str, enum.Enum):
    WEB = "WEB"
    PDF = "PDF"
    DOCX = "DOCX"
    XLSX = "XLSX"
    TEXT = "TEXT"


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    widget_id = Column(String, nullable=True, index=True)
    source_type = Column(SQLEnum(SourceType), nullable=False)
    name = Column(String, nullable=False)
    url = Column(String, nullable=True)  # For web sources
    file_path = Column(String, nullable=True)  # For uploaded files
    source_metadata = Column(Text, nullable=True)  # JSON string for additional metadata
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
