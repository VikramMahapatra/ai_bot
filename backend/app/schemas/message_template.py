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


class TemplateUpdate(BaseModel):
    name: Optional[str]
    subject: Optional[str]
    content: Optional[str]
    
    
class TemplateRequest(BaseModel):
    search: Optional[str] = None
    skip: Optional[int] = None
    limit: Optional[int] = None
   