from pydantic import BaseModel
from typing import Optional
from enum import Enum


class TemplateType(str, Enum):
    sms = "sms"
    whatsapp = "whatsapp"
    email = "email"


class TemplateCreate(BaseModel):
    name: str
    type: TemplateType
    subject: Optional[str] = None
    content: str
    category: Optional[str] = None
    language: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str]
    subject: Optional[str]
    content: Optional[str]
    category: Optional[str] = None
    language: Optional[str] = None


class TemplateRequest(BaseModel):
    type: Optional[str] = None
    search: Optional[str] = None
    skip: Optional[int] = None
    limit: Optional[int] = None
    
class StatusUpdateRequest(BaseModel):
    status: str
