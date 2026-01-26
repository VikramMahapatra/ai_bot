from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class WidgetConfig(Base):
    __tablename__ = "widget_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    widget_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    welcome_message = Column(Text, nullable=True)
    logo_url = Column(String, nullable=True)
    primary_color = Column(String, default="#007bff")
    secondary_color = Column(String, default="#6c757d")
    position = Column(String, default="bottom-right")
    lead_capture_enabled = Column(Boolean, default=True)
    lead_fields = Column(Text, nullable=True)  # JSON array string
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
