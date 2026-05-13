from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ConversationMetricsResponse(BaseModel):
    id: int
    session_id: str
    contact_name: str
    source: Optional[str] = None
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
    lead_conversion: str
    lead_name: Optional[str]
    lead_email: Optional[str]
    outcome: Optional[str] = None
    ai_funnel: Optional[str] = None
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


class PlanUsageCounts(BaseModel):
    conversations_used: int
    messages_used: int
    tokens_used: int
    crawl_pages_used: int
    documents_used: int


class PlanUsageSummary(BaseModel):
    used: PlanUsageCounts


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


class VoiceCampaignReportRow(BaseModel):
    agent_name: str
    customer_name: Optional[str]
    email: Optional[str]
    company: Optional[str]
    organization_name: str
    campaign_name: str
    campaign_source: str
    funnel_stage: Optional[str]
    lead_outcome: Optional[str]
    sentiment: Optional[str]
    outcome: Optional[str]
    created_at: Optional[datetime]
    product_name: Optional[str]
    campaign_start_date: Optional[datetime]


class VoiceCampaignReportSummary(BaseModel):
    total_calls: int
    successful_attempts: int
    sum_call_duration_seconds: int
    sum_call_duration_minutes: float
    sum_call_duration_label: str
    campaign_duration_seconds: int
    campaign_duration_minutes: float
    campaign_duration_label: str


class VoiceCampaignReportResponse(BaseModel):
    total: int
    summary: VoiceCampaignReportSummary
    items: List[VoiceCampaignReportRow]


class VoiceCampaignFilterOptionsResponse(BaseModel):
    agent_names: List[str]
    campaign_names: List[str]
    lead_outcomes: List[str]
    default_campaign_name: Optional[str] = None
