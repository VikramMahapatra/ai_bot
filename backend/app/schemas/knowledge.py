from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class KnowledgeSourceBase(BaseModel):
    name: str
    source_type: str
    url: Optional[str] = None
    source_metadata: Optional[str] = None


class KnowledgeSourceCreate(KnowledgeSourceBase):
    pass


class KnowledgeSourceResponse(KnowledgeSourceBase):
    id: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class WebCrawlRequest(BaseModel):
    url: str
    max_pages: int = 10
    max_depth: int = 3


class DocumentUploadResponse(BaseModel):
    id: int
    name: str
    source_type: str
    status: str
