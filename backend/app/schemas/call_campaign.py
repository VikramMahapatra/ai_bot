from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CampaignCreate(BaseModel):

    name: str
    description: str | None
    category: str
    priority: str
    agent_id: int
    contacts: list[str]
    schedule: dict
    
    
class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    agent_id: Optional[str] = None
    contacts: Optional[List[str]] = None
    schedule: Optional[dict] = None
    
    
class ContactCreate(BaseModel):
    name: str | None
    email: str | None
    phone: str | None
    contact_list_id: int