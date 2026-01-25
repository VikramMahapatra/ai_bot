from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LeadCreate(BaseModel):
    session_id: str
    widget_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    custom_fields: Optional[str] = None


class LeadResponse(BaseModel):
    id: int
    session_id: str
    widget_id: Optional[str]
    name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    company: Optional[str]
    custom_fields: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class WidgetConfigBase(BaseModel):
    name: str
    welcome_message: Optional[str] = "Hi! How can I help you?"
    logo_url: Optional[str] = None
    primary_color: str = "#007bff"
    secondary_color: str = "#6c757d"
    position: str = "bottom-right"
    lead_capture_enabled: bool = True
    lead_fields: Optional[str] = None


class WidgetConfigCreate(WidgetConfigBase):
    widget_id: str


class WidgetConfigUpdate(WidgetConfigBase):
    pass


class WidgetConfigResponse(WidgetConfigBase):
    id: int
    widget_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True
