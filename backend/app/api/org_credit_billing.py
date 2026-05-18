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
    OrgCreditDeleteResponse,
    OrgCreditDocumentEmailRequest,
    OrgCreditInvoiceGenerateRequest,
    OrgCreditInvoiceDeleteResponse,
    OrgCreditInvoiceDocumentResponse,
    OrgCreditInvoicePaymentStatusRequest,
    OrgCreditInvoiceResponse,
    OrgCreditLapseReportResponse,
    OrgCreditPaymentDeleteResponse,
    OrgCreditPaymentCreateRequest,
    OrgCreditPaymentCreateResponse,
    OrgCreditPaymentReceiptResponse,
    OrgCreditPaymentResponse,
    OrgCreditResponse,
    OrgCreditTopupRequest,
    OrgCreditUsageTrackRequest,
)
from app.services import org_credit_billing_service

router = APIRouter(prefix="/api/superadmin/org-credit", tags=["superadmin-org-credit"])


@router.post(
    "/org-credits",
    response_model=OrgCreditCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_org_credit_entry(
    payload: OrgCreditCreateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    row, invoice = org_credit_billing_service.create_org_credit_entry(
        db=db,
        organization_id=payload.organization_id,
        estimator_id=payload.estimator_id,
        credits=payload.total_credits,
        billing_cycle=payload.billing_cycle,
        payment_status=payload.payment_status,
        billing_start_date=payload.billing_start_date,
        notes=payload.notes,
    )
    return OrgCreditCreateResponse(org_credit=row, invoice=invoice)


@router.put(
    "/org-credits/{org_credit_id}",
    response_model=OrgCreditCreateResponse,
)
async def update_org_credit_entry(
    org_credit_id: int,
    payload: OrgCreditCreateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    row, invoice = org_credit_billing_service.update_org_credit_entry(
        db=db,
        org_credit_id=org_credit_id,
        estimator_id=payload.estimator_id,
        credits=payload.total_credits,
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


@router.delete("/org-credits/{org_credit_id}", response_model=OrgCreditDeleteResponse)
async def delete_org_credit_entry(
    org_credit_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    deleted_id = org_credit_billing_service.delete_org_credit_entry(
        db=db, org_credit_id=org_credit_id
    )
    return OrgCreditDeleteResponse(deleted_org_credit_id=deleted_id)


@router.post(
    "/org-credits/{org_credit_id}/topups",
    response_model=OrgCreditCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
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


@router.post(
    "/invoices/generate",
    response_model=OrgCreditInvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
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


@router.delete("/invoices/{invoice_id}", response_model=OrgCreditInvoiceDeleteResponse)
async def delete_org_credit_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    deleted_id = org_credit_billing_service.delete_invoice(db=db, invoice_id=invoice_id)
    return OrgCreditInvoiceDeleteResponse(deleted_invoice_id=deleted_id)


@router.get(
    "/invoices/{invoice_id}/document", response_model=OrgCreditInvoiceDocumentResponse
)
async def get_org_credit_invoice_document(
    invoice_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    payload = org_credit_billing_service.get_invoice_document(
        db=db, invoice_id=invoice_id
    )
    return OrgCreditInvoiceDocumentResponse(**payload)


@router.post("/invoices/{invoice_id}/email")
async def send_org_credit_invoice_email(
    invoice_id: int,
    payload: OrgCreditDocumentEmailRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.send_invoice_email(
        db=db,
        invoice_id=invoice_id,
        to_email=str(payload.to_email),
        subject=payload.subject,
        body=payload.body,
    )


@router.put(
    "/invoices/{invoice_id}/payment-status", response_model=OrgCreditInvoiceResponse
)
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
        payment_date=payload.payment_date,
        payment_mode=payload.payment_mode,
        payment_reference=payload.payment_reference,
        payment_other_details=payload.payment_other_details,
    )


@router.post(
    "/payments",
    response_model=OrgCreditPaymentCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
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
        payment_mode=payload.payment_mode,
        payment_reference=payload.payment_reference,
        payment_other_details=payload.payment_other_details,
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


@router.delete("/payments/{payment_id}", response_model=OrgCreditPaymentDeleteResponse)
async def delete_org_credit_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    deleted_id = org_credit_billing_service.delete_payment(db=db, payment_id=payment_id)
    return OrgCreditPaymentDeleteResponse(deleted_payment_id=deleted_id)


@router.get(
    "/payments/{payment_id}/receipt", response_model=OrgCreditPaymentReceiptResponse
)
async def get_org_credit_payment_receipt(
    payment_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    payload = org_credit_billing_service.get_payment_receipt(
        db=db, payment_id=payment_id
    )
    return OrgCreditPaymentReceiptResponse(**payload)


@router.post("/payments/{payment_id}/email")
async def send_org_credit_payment_receipt_email(
    payment_id: int,
    payload: OrgCreditDocumentEmailRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return org_credit_billing_service.send_payment_receipt_email(
        db=db,
        payment_id=payment_id,
        to_email=str(payload.to_email),
        subject=payload.subject,
        body=payload.body,
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


@router.get("/reports/lapse", response_model=OrgCreditLapseReportResponse)
async def get_org_credit_lapse_report(
    billing_period: Optional[str] = Query(default=None),
    months: int = Query(default=6, ge=1, le=24),
    organization_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    payload = org_credit_billing_service.get_lapse_report(
        db=db,
        billing_period=billing_period,
        months=months,
        organization_id=organization_id,
    )
    return OrgCreditLapseReportResponse(**payload)
