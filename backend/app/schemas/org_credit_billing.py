from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


PaymentStatus = Literal["paid", "unpaid"]
BillingCycle = Literal["monthly"]
PartialPaymentStrategy = Literal["keep_open", "create_invoice"]


class OrgCreditCreateRequest(BaseModel):
    organization_id: int
    estimator_id: int
    billing_cycle: BillingCycle = "monthly"
    payment_status: PaymentStatus = "unpaid"
    billing_start_date: Optional[date] = None
    notes: Optional[str] = None


class OrgCreditTopupRequest(BaseModel):
    topup_credit: float = Field(gt=0)
    payment_status: PaymentStatus = "unpaid"
    notes: Optional[str] = None


class OrgCreditResponse(BaseModel):
    id: int
    organization_id: int
    estimator_id: int
    parent_org_credit_id: Optional[int] = None
    total_credit: float
    billing_cycle: str
    payment_status: str
    billing_start_date: date
    billing_end_date: date
    billing_month: str
    is_topup: bool
    topup_credit: Optional[float] = None
    is_auto_generated: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrgCreditInvoiceGenerateRequest(BaseModel):
    org_credit_id: int
    invoice_date: Optional[date] = None
    notes: Optional[str] = None


class OrgCreditInvoicePaymentStatusRequest(BaseModel):
    payment_done_flag: bool


class OrgCreditInvoiceResponse(BaseModel):
    id: int
    organization_id: int
    org_credit_id: int
    reference_invoice_id: Optional[int] = None
    total_credit: float
    invoice_amount: float
    paid_amount: float
    billing_month: str
    invoice_date: date
    payment_done_flag: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrgCreditPaymentCreateRequest(BaseModel):
    invoice_id: int
    actual_payment: float = Field(gt=0)
    actual_credit: Optional[float] = Field(default=None, gt=0)
    payment_date: Optional[date] = None
    payment_details: Optional[str] = None
    partial_strategy: PartialPaymentStrategy = "keep_open"


class OrgCreditPaymentResponse(BaseModel):
    id: int
    organization_id: int
    invoice_id: int
    full_partial: str
    invoice_amount: float
    actual_payment: float
    actual_credit: float
    payment_date: date
    payment_details: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrgCreditBalanceResponse(BaseModel):
    id: Optional[int] = None
    organization_id: int
    billing_period: str
    total_credit: float
    used_credit: float
    remaining_credit: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrgCreditUsageTrackRequest(BaseModel):
    organization_id: int
    used_credit: float = Field(gt=0)
    billing_period: Optional[str] = None  # YYYY-MM


class OrgCreditAutomationRunResponse(BaseModel):
    evaluated_entries: int
    generated_entries: int
    generated_invoices: int


class OrgCreditCreateResponse(BaseModel):
    org_credit: OrgCreditResponse
    invoice: OrgCreditInvoiceResponse


class OrgCreditPaymentCreateResponse(BaseModel):
    payment: OrgCreditPaymentResponse
    invoice: OrgCreditInvoiceResponse
    generated_invoice: Optional[OrgCreditInvoiceResponse] = None
