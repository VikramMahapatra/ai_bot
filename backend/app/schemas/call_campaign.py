from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime

class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    agent_id: int

    contacts: List[int]

    start_datetime: str
    timezone: str

    call_start_time: str
    call_end_time: str
    call_interval: int

    active_days: List[str]

    max_retry_attempts: Optional[int] = None
    retry_interval: Optional[int] = None

    retry_on_no_answer: bool = False
    retry_on_busy: bool = False
    retry_on_voicemail: bool = False
    
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

    contacts: Optional[List[int]] = None

    start_datetime: Optional[str] = None
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
    
    @field_validator("max_retry_attempts", "retry_interval", mode="before")
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v
    
    
class ContactCreate(BaseModel):
    name: str | None
    email: str | None
    phone: str | None
    contact_list_id: int
    
    
class ContactByIdsRequest(BaseModel):

    ids: list[int]