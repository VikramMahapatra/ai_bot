from pydantic import BaseModel
from typing import Dict, Optional
from enum import Enum


class TemplateType(str, Enum):
    sms = "sms"
    whatsapp = "whatsapp"
    email = "email"


class VariableMapping(BaseModel):
    field: Optional[str] = None
    sample: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    type: TemplateType
    subject: Optional[str] = None
    content: str
    category: Optional[str] = None
    language: Optional[str] = None
    variable_mappings: Optional[Dict[str, VariableMapping]] = None


class TemplateUpdate(BaseModel):
    name: Optional[str]
    subject: Optional[str]
    content: Optional[str]
    category: Optional[str] = None
    language: Optional[str] = None
    variable_mappings: Optional[dict] = None
    update_linked_campaigns: bool = False


class TemplateRequest(BaseModel):
    type: Optional[str] = None
    search: Optional[str] = None
    skip: Optional[int] = None
    limit: Optional[int] = None


class StatusUpdateRequest(BaseModel):
    status: str
