from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, datetime

from app.models.user import OrganizationStatus


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
    lead_generation_enabled: Optional[bool] = None
    voice_chat_enabled: Optional[bool] = None
    multilingual_text_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    human_handoff_enabled: Optional[bool] = None
    email_campaign_enabled: Optional[bool] = None
    sms_campaign_enabled: Optional[bool] = None
    module_knowledge_enabled: Optional[bool] = None
    module_leads_enabled: Optional[bool] = None
    module_analytics_enabled: Optional[bool] = None
    module_advanced_analytics_enabled: Optional[bool] = None
    module_reports_enabled: Optional[bool] = None
    module_campaigns_enabled: Optional[bool] = None
    module_appointments_enabled: Optional[bool] = None
    module_products_enabled: Optional[bool] = None
    module_users_enabled: Optional[bool] = None

    instagram_chat_enabled: Optional[bool] = None
    facebook_messenger_enabled: Optional[bool] = None
    whatsapp_campaign_enabled: Optional[bool] = None
    call_forwarding_enabled: Optional[bool] = None
    inbound_voice_enabled: Optional[bool] = None
    outbound_voice_enabled: Optional[bool] = None
    ai_assistant_campaign_enabled: Optional[bool] = None
    module_followup_workflow_enabled: Optional[bool] = None

    outbound_call_billing_model: Optional[str] = None
    max_outbound_voice_agents: Optional[int] = None
    max_inbound_voice_agents: Optional[int] = None
    max_outbound_calls: Optional[int] = None


class OrganizationLimitsUpdate(BaseModel):
    lead_generation_enabled: Optional[bool] = None
    voice_chat_enabled: Optional[bool] = None
    multilingual_text_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    human_handoff_enabled: Optional[bool] = None
    email_campaign_enabled: Optional[bool] = None
    sms_campaign_enabled: Optional[bool] = None
    module_knowledge_enabled: Optional[bool] = None
    module_leads_enabled: Optional[bool] = None
    module_analytics_enabled: Optional[bool] = None
    module_advanced_analytics_enabled: Optional[bool] = None
    module_reports_enabled: Optional[bool] = None
    module_campaigns_enabled: Optional[bool] = None
    module_appointments_enabled: Optional[bool] = None
    module_products_enabled: Optional[bool] = None
    module_users_enabled: Optional[bool] = None

    instagram_chat_enabled: Optional[bool] = None
    facebook_messenger_enabled: Optional[bool] = None
    whatsapp_campaign_enabled: Optional[bool] = None
    call_forwarding_enabled: Optional[bool] = None
    inbound_voice_enabled: Optional[bool] = None
    outbound_voice_enabled: Optional[bool] = None
    ai_assistant_campaign_enabled: Optional[bool] = None
    module_followup_workflow_enabled: Optional[bool] = None

    outbound_call_billing_model: Optional[str] = None
    max_outbound_voice_agents: Optional[int] = None
    max_inbound_voice_agents: Optional[int] = None
    max_outbound_calls: Optional[int] = None


class OrganizationLimitsResponse(OrganizationLimitsBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SuperAdminCreateOrganizationRequest(BaseModel):
    organization_name: str
    description: Optional[str] = None
    joining_date: Optional[date] = None
    effective_joining_date: Optional[date] = None
    admin_username: str
    admin_email: EmailStr
    admin_password: str
    limits: Optional[OrganizationLimitsUpdate] = None
    status: Optional[OrganizationStatus] = OrganizationStatus.TRIAL
    trial_end_date: Optional[date] = None
    industry: Optional[str] = None
    timezone: Optional[str] = None
    commercial_notes: Optional[str] = None
    echoleads_api_key: Optional[str] = None


class SuperAdminUpdateOrganizationRequest(BaseModel):
    organization_name: Optional[str] = None
    description: Optional[str] = None
    joining_date: Optional[date] = None
    effective_joining_date: Optional[date] = None
    admin_username: Optional[str] = None
    admin_email: Optional[EmailStr] = None
    admin_password: Optional[str] = None
    echoleads_api_key: Optional[str] = None
    status: Optional[OrganizationStatus] = None
    trial_end_date: Optional[date] = None
    industry: Optional[str] = None
    timezone: Optional[str] = None
    commercial_notes: Optional[str] = None


class SuperAdminOrganizationResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    joining_date: Optional[date] = None
    effective_joining_date: Optional[date] = None
    admin_username: Optional[str] = None
    admin_email: Optional[str] = None
    limits: Optional[OrganizationLimitsResponse] = None
    echoleads_api_key: Optional[str] = None
    status: OrganizationStatus
    industry: Optional[str] = None
    timezone: Optional[str] = None
    commercial_notes: Optional[str] = None
    trial_end_date: Optional[date] = None

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


class CallingNumberBase(BaseModel):
    calling_number_id: int
    type: str = "outbound"  # 'outbound' or 'inbound'
    is_default: Optional[bool] = False
    is_active: Optional[bool] = True


class CallingNumberCreate(CallingNumberBase):
    pass


class CallingNumberUpdate(CallingNumberBase):
    pass


class CallingNumberResponse(BaseModel):
    id: int
    organization_id: int
    calling_number: str
    type: str
    is_default: bool
    is_active: bool

    class Config:
        from_attributes = True


class OrganizationChannelBase(BaseModel):
    channel_id: int


class OrganizationChannelCreate(OrganizationChannelBase):
    pass


class OrganizationChannelUpdate(OrganizationChannelBase):
    pass


class OrganizationChannelResponse(BaseModel):
    id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class PriceMatrixItemBase(BaseModel):
    category: str
    module: str
    sub_module: Optional[str] = None
    billing_unit: Optional[str] = None
    credits_per_unit: Optional[float] = None
    credit_formula: Optional[str] = None
    definition: Optional[str] = None
    overage_handling: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class PriceMatrixItemCreate(PriceMatrixItemBase):
    pass


class PriceMatrixItemUpdate(BaseModel):
    category: Optional[str] = None
    module: Optional[str] = None
    sub_module: Optional[str] = None
    billing_unit: Optional[str] = None
    credits_per_unit: Optional[float] = None
    credit_formula: Optional[str] = None
    definition: Optional[str] = None
    overage_handling: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class PriceMatrixItemResponse(PriceMatrixItemBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PriceMatrixEstimateLine(BaseModel):
    price_matrix_item_id: int
    quantity: float = Field(ge=0)


class PriceMatrixEstimateRequest(BaseModel):
    lines: List[PriceMatrixEstimateLine] = Field(default_factory=list)
    buffer_percent: float = Field(default=15, ge=0, le=200)
    discount_percent: float = Field(default=0, ge=0, le=100)


class PriceMatrixEstimateBreakdownLine(BaseModel):
    price_matrix_item_id: int
    category: str
    module: str
    sub_module: Optional[str] = None
    billing_unit: Optional[str] = None
    credits_per_unit: float
    quantity: float
    estimated_credits: float


class PriceMatrixEstimateResponse(BaseModel):
    subtotal_credits: float
    buffer_percent: float
    buffer_credits: float
    discount_percent: float
    discount_credits: float
    final_recommended_credits: float
    final_recommended_credits_ceiling: int
    recommended_credits: float
    recommended_credits_ceiling: int
    breakdown: List[PriceMatrixEstimateBreakdownLine]


class CreditEstimatorShareCreateRequest(PriceMatrixEstimateRequest):
    company_name: str = Field(min_length=1, max_length=255)
    valid_for_hours: int = Field(default=8, ge=1, le=168)


class CreditEstimatorShareExtendRequest(BaseModel):
    extra_hours: int = Field(default=8, ge=1, le=168)


class CreditEstimatorShareUpdateRequest(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    lines: Optional[List[PriceMatrixEstimateLine]] = None
    buffer_percent: Optional[float] = Field(default=None, ge=0, le=200)
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)
    valid_for_hours: Optional[int] = Field(default=None, ge=1, le=168)


class CreditEstimatorShareCreateResponse(BaseModel):
    id: int
    company_name: str
    token: str
    share_path: str
    expires_at: datetime
    expires_in_hours: int
    estimate: PriceMatrixEstimateResponse


class CreditEstimatorShareListItemResponse(BaseModel):
    id: int
    company_name: str
    token: str
    share_path: str
    expires_at: datetime
    created_at: datetime
    is_active: bool
    is_expired: bool
    estimator_input: PriceMatrixEstimateRequest
    estimate: PriceMatrixEstimateResponse


class CreditEstimatorSharePublicResponse(BaseModel):
    id: int
    company_name: str
    token: str
    estimate: PriceMatrixEstimateResponse
    created_at: datetime
    expires_at: datetime


class CreditEstimatorShareEmailRequest(BaseModel):
    to_email: EmailStr
    subject: str
    body: str


class OrganizationCreditAllocationLine(BaseModel):
    price_matrix_item_id: int
    quantity: Optional[float] = Field(default=None, ge=0)
    credits_per_unit: Optional[float] = Field(default=None, ge=0)
    allocated_credits: Optional[float] = Field(default=None, ge=0)


class OrganizationCreditProfileInput(BaseModel):
    total_price: Optional[float] = Field(default=None, ge=0)
    buffer_percent: Optional[float] = Field(default=None, ge=0, le=500)
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)
    payment_status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    expiry_days: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


class OrganizationCreditAllocationCreateRequest(BaseModel):
    organization_id: int
    profile: Optional[OrganizationCreditProfileInput] = None
    lines: List[OrganizationCreditAllocationLine] = Field(default_factory=list)


class OrganizationCreditAllocationUpdateRequest(BaseModel):
    quantity: Optional[float] = Field(default=None, ge=0)
    credits_per_unit: Optional[float] = Field(default=None, ge=0)
    allocated_credits: Optional[float] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class OrganizationCreditAllocationResponse(BaseModel):
    id: int
    organization_id: int
    organization_name: str
    price_matrix_item_id: int
    category: str
    module: str
    sub_module: Optional[str] = None
    billing_unit: Optional[str] = None
    quantity: Optional[float] = None
    credits_per_unit: Optional[float] = None
    allocated_credits: float
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


class OrganizationCreditProfileUpdateRequest(BaseModel):
    total_price: Optional[float] = Field(default=None, ge=0)
    buffer_percent: Optional[float] = Field(default=None, ge=0, le=500)
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)
    payment_status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    expiry_days: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


class OrganizationCreditProfileResponse(BaseModel):
    organization_id: int
    organization_name: str
    total_price: float
    buffer_percent: float
    discount_percent: float
    payment_status: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    expiry_days: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class OrganizationCreditAllocationSummaryResponse(BaseModel):
    organization_id: int
    organization_name: str
    total_allocated_credits: float
    total_price: float
    buffer_percent: float
    discount_percent: float
    payment_status: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    expiry_days: Optional[int] = None
    notes: Optional[str] = None
    row_count: int


class OrganizationCreditChangeLogResponse(BaseModel):
    id: int
    organization_id: int
    price_matrix_item_id: Optional[int] = None
    change_type: str
    previous_json: Optional[str] = None
    new_json: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime


class BillingInvoiceResponse(BaseModel):
    id: int
    organization_id: int
    organization_name: str
    invoice_number: str
    issue_date: datetime
    due_date: Optional[datetime] = None
    billing_start_date: Optional[datetime] = None
    billing_end_date: Optional[datetime] = None
    amount: float
    paid_amount: float
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class BillingPaymentCreateRequest(BaseModel):
    organization_id: int
    invoice_id: Optional[int] = None
    amount: float = Field(ge=0)
    payment_date: Optional[datetime] = None
    method: str = "bank_transfer"
    reference: Optional[str] = None
    status: str = "completed"
    notes: Optional[str] = None


class BillingPaymentResponse(BaseModel):
    id: int
    organization_id: int
    organization_name: str
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    amount: float
    payment_date: datetime
    method: str
    reference: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime


class BillingInvoiceItemResponse(BaseModel):
    id: int
    invoice_id: int
    organization_id: int
    price_matrix_item_id: Optional[int] = None
    category: str
    module: str
    sub_module: Optional[str] = None
    billing_unit: Optional[str] = None
    quantity: Optional[float] = None
    credits_per_unit: Optional[float] = None
    allocated_credits: float
    created_at: datetime


class BillingBillResponse(BaseModel):
    id: int
    organization_id: int
    organization_name: str
    invoice_id: int
    invoice_number: str
    payment_id: Optional[int] = None
    bill_number: str
    issued_date: datetime
    amount: float
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class BillingInvoiceDetailResponse(BillingInvoiceResponse):
    items: List[BillingInvoiceItemResponse] = Field(default_factory=list)
    bills: List[BillingBillResponse] = Field(default_factory=list)


class BillingInvoiceMarkPaidRequest(BaseModel):
    payment_date: Optional[datetime] = None
    method: str = "bank_transfer"
    reference: Optional[str] = None
    notes: Optional[str] = None
    amount_paid: Optional[float] = Field(default=None, ge=0)


class BillingInvoiceMarkPaidResponse(BaseModel):
    invoice: BillingInvoiceResponse
    payment: BillingPaymentResponse
    bill: BillingBillResponse
    partial_invoice: Optional[BillingInvoiceResponse] = None
    credit_note: Optional[float] = None
    credit_applied: Optional[float] = None


class RepublishAgentRequest(BaseModel):
    external_agent_name: Optional[str] = None
    organization_id: Optional[int] = None
