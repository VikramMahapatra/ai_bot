from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class KnowledgeSourceBase(BaseModel):
    widget_id: str
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
    widget_id: str
    url: str
    max_pages: int = 10
    max_depth: int = 3
    selected_urls: Optional[List[str]] = None


class WebCrawlPreviewRequest(BaseModel):
    url: str
    max_pages: int = 10
    max_depth: int = 3


class CrawlDiscoveredUrl(BaseModel):
    url: str
    depth: int


class WebCrawlPreviewResponse(BaseModel):
    discovered_urls: List[CrawlDiscoveredUrl]
    pages_scanned: int
    message: str


class WebCrawlResponse(BaseModel):
    source: KnowledgeSourceResponse
    pages_crawled: int
    pages_scanned: int
    unchanged: bool
    message: str


class DocumentUploadResponse(BaseModel):
    id: int
    name: str
    source_type: str
    status: str
    widget_id: str
