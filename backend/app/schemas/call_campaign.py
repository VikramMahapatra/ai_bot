from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime

from app.enums.campaign_reply_modes import CampaignInstantReplyMode

class EmailTemplate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    
class InstantReplyTemplates(BaseModel):
    whatsapp: Optional[int] = None
    sms: Optional[int] = None
    email: Optional[int] = None

class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    agent_id: int
    product_id: Optional[int] = None
    calling_no: str

    contacts: List[int]

    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    timezone: Optional[str] = None

    call_start_time: Optional[str] = None
    call_end_time: Optional[str] = None
    call_interval: Optional[int] = None

    active_days: Optional[List[str]] = None

    max_retry_attempts: Optional[int] = None
    retry_interval: Optional[int] = None

    retry_on_no_answer: bool = False
    retry_on_busy: bool = False
    retry_on_voicemail: bool = False
    
    instant_reply: Optional[bool] = False
    instant_reply_modes: Optional[List[CampaignInstantReplyMode]] = []
    instant_reply_templates: Optional[InstantReplyTemplates] = None
    
    workflow_id: Optional[int] = None
    
    @field_validator("max_retry_attempts", "retry_interval", mode="before")
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v
    
    
class CampaignUpdate(BaseModel):

    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    agent_id: Optional[int] = None
    product_id: Optional[int] = None
    workflow_id: Optional[int] = None
    calling_no: str

    contacts: Optional[List[int]] = None

    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    timezone: Optional[str] = None

    call_start_time: Optional[str] = None
    call_end_time: Optional[str] = None
    call_interval: Optional[int] = None

    active_days: Optional[List[str]] = None

    max_retry_attempts: Optional[int] = None
    retry_interval: Optional[int] = None

    retry_on_no_answer: Optional[bool] = None
    retry_on_busy: Optional[bool] = None
    retry_on_voicemail: Optional[bool] = None
    
    instant_reply: Optional[bool] = None
    instant_reply_modes: Optional[List[CampaignInstantReplyMode]] = []
    instant_reply_templates: Optional[InstantReplyTemplates] = None
    
    @field_validator("max_retry_attempts", "retry_interval", mode="before")
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v
    
class CampaignStatusUpdate(BaseModel):
    status: str  # Active | Paused | Draft | Cancelled
    
    
class ContactCreate(BaseModel):
    name: str | None
    email: str | None
    phone: str | None
    company: str | None
    contact_list_id: int
    
    
class ContactByIdsRequest(BaseModel):

    ids: list[int]
    
    
class CampaignLookupParameters(BaseModel):
    search: Optional[str] = None
    agent_id: Optional[int] = None