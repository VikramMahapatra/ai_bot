from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class FollowUpSequenceCreate(BaseModel):
    sequence_order: int
    delay_value: int
    delay_unit: str
    mode: str

    agent_id: Optional[int]
    subject: Optional[str]
    template: Optional[str]
    agent_prompt: Optional[str]
    
    
class FollowUpWorkflowCreate(BaseModel):
    name: str

    contact_source: str
    campaign_source: Optional[str]

    campaign_id: Optional[int]
    contact_list_id: Optional[int]

    lead_outcome: str

    sequences: List[FollowUpSequenceCreate]