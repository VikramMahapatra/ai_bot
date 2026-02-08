from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ConversationMetricsResponse(BaseModel):
    id: int
    session_id: str
    organization_id: int
    widget_id: Optional[str]
    total_messages: int
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    average_response_time: float
    conversation_duration: float
    user_satisfaction: Optional[float]
    has_lead: int
    lead_name: Optional[str]
    lead_email: Optional[str]
    conversation_start: Optional[datetime]
    conversation_end: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ReportFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    widget_id: Optional[str] = None
    min_tokens: Optional[int] = None
    max_tokens: Optional[int] = None
    has_lead: Optional[int] = None  # 0 or 1
    min_satisfaction: Optional[float] = None  # 1-5


class PlanUsageLimits(BaseModel):
    monthly_conversation_limit: Optional[int]
    monthly_message_limit: Optional[int]
    monthly_token_limit: Optional[int]
    monthly_crawl_pages_limit: Optional[int]
    monthly_document_limit: Optional[int]


class PlanUsageCounts(BaseModel):
    conversations_used: int
    messages_used: int
    tokens_used: int
    crawl_pages_used: int
    documents_used: int


class PlanUsageRemaining(BaseModel):
    conversations_remaining: Optional[int]
    messages_remaining: Optional[int]
    tokens_remaining: Optional[int]
    crawl_pages_remaining: Optional[int]
    documents_remaining: Optional[int]


class PlanUsageSummary(BaseModel):
    plan_id: Optional[int]
    plan_name: Optional[str]
    billing_cycle: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    days_left: Optional[int]
    status: Optional[str]
    limits: PlanUsageLimits
    used: PlanUsageCounts
    remaining: PlanUsageRemaining


class ReportResponse(BaseModel):
    total_conversations: int
    total_messages: int
    total_tokens: int
    average_tokens_per_conversation: float
    total_leads_captured: int
    average_conversation_duration: float
    average_satisfaction_rating: Optional[float]
    plan_usage: Optional[PlanUsageSummary] = None
    
    class Config:
        from_attributes = True


class DetailedReportResponse(BaseModel):
    summary: ReportResponse
    metrics: List[ConversationMetricsResponse]
    pagination: dict  # {"skip": int, "limit": int, "total": int}


class TokenUsageReport(BaseModel):
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    average_tokens_per_conversation: float
    conversations_count: int
    cost_estimate: Optional[float] = None  # If pricing is known


class LeadReportResponse(BaseModel):
    total_leads: int
    leads_by_widget: dict  # {"widget_id": count}
    leads_by_date: dict  # {"date": count}
    leads_with_email: int
    conversion_rate: float  # (leads / total_conversations) * 100
