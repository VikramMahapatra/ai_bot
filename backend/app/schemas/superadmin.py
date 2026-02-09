from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class SuperAdminLoginRequest(BaseModel):
    username: str
    password: str


class SuperAdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "SUPERADMIN"
    superadmin_id: int


class SuperAdminBootstrapRequest(BaseModel):
    username: str
    password: str
    email: Optional[EmailStr] = None


class OrganizationLimitsBase(BaseModel):
    monthly_conversation_limit: Optional[int] = None
    monthly_crawl_pages_limit: Optional[int] = None
    max_crawl_depth: Optional[int] = None
    monthly_document_limit: Optional[int] = None
    max_document_size_mb: Optional[int] = None
    monthly_token_limit: Optional[int] = None
    max_query_words: Optional[int] = None
    lead_generation_enabled: Optional[bool] = None
    voice_chat_enabled: Optional[bool] = None
    multilingual_text_enabled: Optional[bool] = None


class OrganizationLimitsUpdate(BaseModel):
    monthly_conversation_limit: Optional[int] = None
    monthly_crawl_pages_limit: Optional[int] = None
    max_crawl_depth: Optional[int] = None
    monthly_document_limit: Optional[int] = None
    max_document_size_mb: Optional[int] = None
    monthly_token_limit: Optional[int] = None
    max_query_words: Optional[int] = None
    lead_generation_enabled: Optional[bool] = None
    voice_chat_enabled: Optional[bool] = None
    multilingual_text_enabled: Optional[bool] = None


class OrganizationLimitsResponse(OrganizationLimitsBase):
    id: int
    organization_id: int
    plan_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SuperAdminCreateOrganizationRequest(BaseModel):
    organization_name: str
    description: Optional[str] = None
    admin_username: str
    admin_email: EmailStr
    admin_password: str
    plan_id: int
    billing_cycle: str = "monthly"
    trial_days: Optional[int] = None
    limits: Optional[OrganizationLimitsUpdate] = None


class SuperAdminOrganizationResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    admin_username: Optional[str] = None
    admin_email: Optional[str] = None
    limits: Optional[OrganizationLimitsResponse] = None
    plan: Optional["PlanResponse"] = None
    subscription: Optional["SubscriptionResponse"] = None

    class Config:
        from_attributes = True


class OrganizationUsageResponse(BaseModel):
    organization_id: int
    year: int
    month: int
    conversations_count: int
    messages_count: int
    crawl_pages_count: int
    documents_count: int
    tokens_used: int
    leads_count: int


class SuperAdminOverviewResponse(BaseModel):
    total_organizations: int
    total_conversations: int
    total_tokens: int
    total_leads: int
    total_documents: int
    total_crawl_pages: int


class PlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_inr: int
    billing_cycle: str = "monthly"
    is_active: bool = True
    monthly_conversation_limit: int
    monthly_crawl_pages_limit: int
    max_crawl_depth: int
    monthly_document_limit: int
    max_document_size_mb: int
    monthly_token_limit: int
    max_query_words: int
    lead_generation_enabled: bool
    voice_chat_enabled: bool
    multilingual_text_enabled: bool


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_inr: Optional[int] = None
    billing_cycle: Optional[str] = None
    is_active: Optional[bool] = None
    monthly_conversation_limit: Optional[int] = None
    monthly_crawl_pages_limit: Optional[int] = None
    max_crawl_depth: Optional[int] = None
    monthly_document_limit: Optional[int] = None
    max_document_size_mb: Optional[int] = None
    monthly_token_limit: Optional[int] = None
    max_query_words: Optional[int] = None
    lead_generation_enabled: Optional[bool] = None
    voice_chat_enabled: Optional[bool] = None
    multilingual_text_enabled: Optional[bool] = None


class PlanResponse(PlanCreate):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscriptionCreate(BaseModel):
    plan_id: int
    billing_cycle: str = "monthly"
    trial_days: Optional[int] = None


class SubscriptionResponse(BaseModel):
    id: int
    organization_id: int
    plan_id: int
    status: str
    billing_cycle: str
    start_date: datetime
    end_date: datetime
    trial_end: Optional[datetime] = None
    is_active: bool
    days_left: int

    class Config:
        from_attributes = True


SuperAdminOrganizationResponse.model_rebuild()
