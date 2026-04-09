from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth import require_superadmin
from app.database import get_db
from app.models import SuperAdmin
from app.schemas.org_credit_billing import (
    OrgCreditAutomationRunResponse,
    OrgCreditBalanceResponse,
    OrgCreditCreateRequest,
    OrgCreditCreateResponse,
    OrgCreditInvoiceGenerateRequest,
    OrgCreditInvoicePaymentStatusRequest,
    OrgCreditInvoiceResponse,
    OrgCreditPaymentCreateRequest,
    OrgCreditPaymentCreateResponse,
    OrgCreditPaymentResponse,
    OrgCreditResponse,
    OrgCreditTopupRequest,
    OrgCreditUsageTrackRequest,
)
from app.services import org_credit_billing_service

router = APIRouter(prefix="/api/superadmin/org-credit", tags=["superadmin-org-credit"])


@router.post("/org-credits", response_model=OrgCreditCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_org_credit_entry(
    payload: OrgCreditCreateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    row, invoice = org_credit_billing_service.create_org_credit_entry(
        db=db,
        organization_id=payload.organization_id,
        estimator_id=payload.estimator_id,
        billing_cycle=payload.billing_cycle,
        payment_status=payload.payment_status,
        billing_start_date=payload.billing_start_date,
        notes=payload.notes,
    )
    return OrgCreditCreateResponse(org_credit=row, invoice=invoice)


@router.get("/org-credits", response_model=List[OrgCreditResponse])
async def list_org_credit_entries(
    organization_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.list_org_credits(
        db=db,
        organization_id=organization_id,
    )


@router.post("/org-credits/{org_credit_id}/topups", response_model=OrgCreditCreateResponse, status_code=status.HTTP_201_CREATED)
async def add_org_credit_topup(
    org_credit_id: int,
    payload: OrgCreditTopupRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    row, invoice = org_credit_billing_service.add_topup_credit(
        db=db,
        org_credit_id=org_credit_id,
        topup_credit=payload.topup_credit,
        payment_status=payload.payment_status,
        notes=payload.notes,
    )
    return OrgCreditCreateResponse(org_credit=row, invoice=invoice)


@router.post("/invoices/generate", response_model=OrgCreditInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def generate_org_credit_invoice(
    payload: OrgCreditInvoiceGenerateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.generate_invoice(
        db=db,
        org_credit_id=payload.org_credit_id,
        invoice_date=payload.invoice_date,
        notes=payload.notes,
    )


@router.get("/invoices", response_model=List[OrgCreditInvoiceResponse])
async def list_org_credit_invoices(
    organization_id: Optional[int] = Query(default=None),
    org_credit_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.list_invoices(
        db=db,
        organization_id=organization_id,
        org_credit_id=org_credit_id,
    )


@router.put("/invoices/{invoice_id}/payment-status", response_model=OrgCreditInvoiceResponse)
async def mark_org_credit_invoice_payment_status(
    invoice_id: int,
    payload: OrgCreditInvoicePaymentStatusRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.mark_invoice_payment_status(
        db=db,
        invoice_id=invoice_id,
        payment_done_flag=payload.payment_done_flag,
    )


@router.post("/payments", response_model=OrgCreditPaymentCreateResponse, status_code=status.HTTP_201_CREATED)
async def add_org_credit_payment(
    payload: OrgCreditPaymentCreateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    payment, invoice, generated_invoice = org_credit_billing_service.add_payment(
        db=db,
        invoice_id=payload.invoice_id,
        actual_payment=payload.actual_payment,
        actual_credit=payload.actual_credit,
        payment_date=payload.payment_date,
        payment_details=payload.payment_details,
        partial_strategy=payload.partial_strategy,
    )
    return OrgCreditPaymentCreateResponse(
        payment=payment,
        invoice=invoice,
        generated_invoice=generated_invoice,
    )


@router.get("/payments", response_model=List[OrgCreditPaymentResponse])
async def list_org_credit_payments(
    organization_id: Optional[int] = Query(default=None),
    invoice_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.list_payments(
        db=db,
        organization_id=organization_id,
        invoice_id=invoice_id,
    )


@router.get("/credits/availability", response_model=OrgCreditBalanceResponse)
async def get_org_available_credit(
    organization_id: int = Query(...),
    billing_period: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.get_available_credit(
        db=db,
        organization_id=organization_id,
        billing_period=billing_period,
    )


@router.post("/credits/usage", response_model=OrgCreditBalanceResponse)
async def track_org_credit_usage(
    payload: OrgCreditUsageTrackRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.track_credit_usage(
        db=db,
        organization_id=payload.organization_id,
        used_credit=payload.used_credit,
        billing_period=payload.billing_period,
    )


@router.post("/automation/run", response_model=OrgCreditAutomationRunResponse)
async def run_org_credit_automation(
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    result = org_credit_billing_service.run_billing_automation(db=db)
    return OrgCreditAutomationRunResponse(**result)
