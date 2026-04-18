from typing import Optional
from pydantic import BaseModel

class WorkflowRequest(BaseModel):
    search: Optional[str] = None
    skip: Optional[int] = None
    limit: Optional[int] = None