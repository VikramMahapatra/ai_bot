from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Union
import math
import json
from datetime import datetime, timedelta, timezone
import re
import secrets
from app.database import get_db
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    require_superadmin,
)
from app.models import (
    Organization,
    User,
    UserRole,
    SuperAdmin,
    OrganizationLimits,
    OrganizationSubscriptionUsage,
    PriceMatrixItem,
    CreditEstimatorShare,
    OrganizationCreditAllocation,
    OrganizationCreditProfile,
    OrganizationCreditChangeLog,
    BillingInvoice,
    BillingPayment,
    BillingInvoiceItem,
    BillingBill,
)
from app.schemas.superadmin import (
    CallingNumberCreate,
    CallingNumberUpdate,
    OrganizationChannelCreate,
    OrganizationChannelUpdate,
    SuperAdminLoginRequest,
    SuperAdminLoginResponse,
    SuperAdminBootstrapRequest,
    SuperAdminCreateOrganizationRequest,
    SuperAdminUpdateOrganizationRequest,
    SuperAdminOrganizationResponse,
    OrganizationLimitsUpdate,
    OrganizationLimitsResponse,
    SuperAdminOverviewResponse,
    PriceMatrixItemCreate,
    PriceMatrixItemUpdate,
    PriceMatrixItemResponse,
    PriceMatrixEstimateRequest,
    PriceMatrixEstimateResponse,
    PriceMatrixEstimateBreakdownLine,
    CreditEstimatorShareCreateRequest,
    CreditEstimatorShareExtendRequest,
    CreditEstimatorShareUpdateRequest,
    CreditEstimatorShareCreateResponse,
    CreditEstimatorShareListItemResponse,
    CreditEstimatorSharePublicResponse,
    CreditEstimatorShareEmailRequest,
    OrganizationCreditProfileInput,
    OrganizationCreditAllocationCreateRequest,
    OrganizationCreditAllocationUpdateRequest,
    OrganizationCreditAllocationResponse,
    OrganizationCreditProfileUpdateRequest,
    OrganizationCreditProfileResponse,
    OrganizationCreditAllocationSummaryResponse,
    OrganizationCreditChangeLogResponse,
    BillingInvoiceResponse,
    BillingPaymentCreateRequest,
    BillingPaymentResponse,
    BillingInvoiceItemResponse,
    BillingBillResponse,
    BillingInvoiceDetailResponse,
    BillingInvoiceMarkPaidRequest,
    BillingInvoiceMarkPaidResponse,
)
from app.services.limits_service import (
    get_or_create_limits,
    update_limits,
)
from sqlalchemy import func, insert, or_, select, text
from app.config import settings
from app.services.conversation_outcome_service import run_outcome_processing_batches
from app.services.email_service import send_widget_test_link_email
import logging
from sqlalchemy.exc import IntegrityError

from app.models.organization_calling_numbers import OrganizationCallingNumber
from app.models.call_campaigns import CallCampaign
from app.models.call_logs import CallLog
from app.models.calling_agents import CallingAgent
from app.api.organization_setting import get_settings
from app.models.organization_settings import OrganizationSettings
from app.schemas.org_credit_billing import OrgCreditAdminMonthSummaryResponse
from app.services import org_credit_billing_service
from app.models.channels import Channel, OrganizationChannel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])

ORG_DELETE_BLOCKING_TABLES = [
    "widget_configs",
    "knowledge_sources",
    "conversations",
    "leads",
    "campaigns",
    "contact_lists",
    "campaign_lead_rules",
    "campaign_lead_conversions",
    "call_campaigns",
    "call_logs",
    "calling_agents",
    "appointments",
    "appointment_intakes",
    "handoff_sessions",
    "products",
    "message_feedback",
    "conversation_metrics",
    "retrieval_traces",
    "funnel_categories",
]

ORG_DELETE_CLEANUP_TABLES = [
    "organization_calling_numbers",
    "organization_limits",
    "organization_subscription_usage",
    "organization_subscriptions",
    "organization_usage",
    "twilio_sms_channels",
    "whatsapp_channels",
    "users",
]


def _build_org_domain(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-") or "org"
    return f"{base}-{secrets.token_hex(3)}"


def _build_org_response(
    db: Session, org: Organization, admin_user: Optional[User] = None
) -> SuperAdminOrganizationResponse:
    if not admin_user:
        admin_user = (
            db.query(User)
            .filter(
                User.organization_id == org.id,
                User.role == UserRole.ADMIN,
            )
            .first()
        )
    limits = get_or_create_limits(db, org.id)

    return SuperAdminOrganizationResponse(
        id=org.id,
        name=org.name,
        description=org.description,
        joining_date=org.joining_date,
        effective_joining_date=org.effective_joining_date,
        admin_username=admin_user.username if admin_user else None,
        admin_email=admin_user.email if admin_user else None,
        limits=limits,
        echoleads_api_key=org.echoleads_api_key,
    )


def _table_exists(db: Session, table_name: str) -> bool:
    try:
        db.execute(text(f"SELECT 1 FROM {table_name} LIMIT 1"))
        return True
    except Exception:
        return False


def _to_utc(dt_value: datetime) -> datetime:
    if dt_value.tzinfo is None:
        return dt_value.replace(tzinfo=timezone.utc)
    return dt_value.astimezone(timezone.utc)


def _calculate_price_matrix_estimate(
    db: Session,
    payload: PriceMatrixEstimateRequest,
) -> PriceMatrixEstimateResponse:
    if not payload.lines:
        return PriceMatrixEstimateResponse(
            subtotal_credits=0,
            buffer_percent=payload.buffer_percent,
            buffer_credits=0,
            discount_percent=payload.discount_percent,
            discount_credits=0,
            final_recommended_credits=0,
            final_recommended_credits_ceiling=0,
            recommended_credits=0,
            recommended_credits_ceiling=0,
            breakdown=[],
        )

    requested_ids = {line.price_matrix_item_id for line in payload.lines}
    items = (
        db.query(PriceMatrixItem).filter(PriceMatrixItem.id.in_(requested_ids)).all()
    )
    item_by_id = {item.id: item for item in items}

    missing_ids = sorted(requested_ids - set(item_by_id.keys()))
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Price matrix item(s) not found: {', '.join(map(str, missing_ids))}",
        )

    breakdown: List[PriceMatrixEstimateBreakdownLine] = []
    subtotal_credits = 0.0

    for line in payload.lines:
        item = item_by_id[line.price_matrix_item_id]
        if item.credits_per_unit is None:
            raise HTTPException(
                status_code=400,
                detail=f"Item '{item.category} / {item.module} / {item.sub_module or '-'}' has no numeric credits_per_unit",
            )

        line_credits = float(item.credits_per_unit) * float(line.quantity)
        subtotal_credits += line_credits

        breakdown.append(
            PriceMatrixEstimateBreakdownLine(
                price_matrix_item_id=item.id,
                category=item.category,
                module=item.module,
                sub_module=item.sub_module,
                billing_unit=item.billing_unit,
                credits_per_unit=float(item.credits_per_unit),
                quantity=float(line.quantity),
                estimated_credits=round(line_credits, 2),
            )
        )

    buffer_credits = subtotal_credits * (payload.buffer_percent / 100)
    recommended_credits = subtotal_credits + buffer_credits
    discount_credits = recommended_credits * (payload.discount_percent / 100)
    final_recommended_credits = max(0.0, recommended_credits - discount_credits)

    return PriceMatrixEstimateResponse(
        subtotal_credits=round(subtotal_credits, 2),
        buffer_percent=payload.buffer_percent,
        buffer_credits=round(buffer_credits, 2),
        discount_percent=payload.discount_percent,
        discount_credits=round(discount_credits, 2),
        final_recommended_credits=round(final_recommended_credits, 2),
        final_recommended_credits_ceiling=int(math.ceil(final_recommended_credits)),
        recommended_credits=round(recommended_credits, 2),
        recommended_credits_ceiling=int(math.ceil(recommended_credits)),
        breakdown=breakdown,
    )


def _build_credit_estimate_share_path(token: str) -> str:
    return f"/credit-estimator/share/{token}"


def _load_credit_estimate_share(
    db: Session,
    token: str,
    enforce_active: bool = True,
    enforce_not_expired: bool = True,
) -> CreditEstimatorShare:
    share = (
        db.query(CreditEstimatorShare)
        .filter(CreditEstimatorShare.token == token)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Shared estimate not found")

    if enforce_active and not share.is_active:
        raise HTTPException(status_code=401, detail="Shared estimate link has expired")

    if enforce_not_expired:
        now = datetime.now(timezone.utc)
        expires_at = _to_utc(share.expires_at)
        if expires_at <= now:
            raise HTTPException(
                status_code=401, detail="Shared estimate link has expired"
            )

    return share


def _parse_estimate_payload(raw_value: Optional[str]) -> PriceMatrixEstimateResponse:
    try:
        estimate_payload = json.loads(raw_value or "{}")
    except Exception:
        estimate_payload = {}
    return PriceMatrixEstimateResponse.model_validate(estimate_payload)


def _parse_input_payload(raw_value: Optional[str]) -> PriceMatrixEstimateRequest:
    try:
        input_payload = json.loads(raw_value or "{}")
    except Exception:
        input_payload = {}
    return PriceMatrixEstimateRequest.model_validate(input_payload)


def _build_credit_share_create_response(
    share: CreditEstimatorShare,
    estimate: PriceMatrixEstimateResponse,
    expires_in_hours: int,
) -> CreditEstimatorShareCreateResponse:
    return CreditEstimatorShareCreateResponse(
        id=share.id,
        company_name=share.company_name,
        token=share.token,
        share_path=_build_credit_estimate_share_path(share.token),
        expires_at=_to_utc(share.expires_at),
        expires_in_hours=expires_in_hours,
        estimate=estimate,
    )


def _build_credit_share_list_item_response(
    share: CreditEstimatorShare,
) -> CreditEstimatorShareListItemResponse:
    created_at = (
        _to_utc(share.created_at) if share.created_at else datetime.now(timezone.utc)
    )
    expires_at = _to_utc(share.expires_at)
    estimate = _parse_estimate_payload(share.estimate_json)
    estimator_input = _parse_input_payload(share.input_json)
    is_expired = expires_at <= datetime.now(timezone.utc)
    return CreditEstimatorShareListItemResponse(
        id=share.id,
        company_name=share.company_name,
        token=share.token,
        share_path=_build_credit_estimate_share_path(share.token),
        expires_at=expires_at,
        created_at=created_at,
        is_active=bool(share.is_active),
        is_expired=is_expired,
        estimator_input=estimator_input,
        estimate=estimate,
    )


def _build_org_credit_allocation_response(
    allocation: OrganizationCreditAllocation,
    org_name_by_id: dict,
    matrix_item_by_id: dict,
) -> OrganizationCreditAllocationResponse:
    matrix_item = matrix_item_by_id.get(allocation.price_matrix_item_id)

    return OrganizationCreditAllocationResponse(
        id=allocation.id,
        organization_id=allocation.organization_id,
        organization_name=org_name_by_id.get(
            allocation.organization_id, f"Org #{allocation.organization_id}"
        ),
        price_matrix_item_id=allocation.price_matrix_item_id,
        category=matrix_item.category if matrix_item else "Unknown",
        module=matrix_item.module if matrix_item else "Unknown",
        sub_module=matrix_item.sub_module if matrix_item else None,
        billing_unit=matrix_item.billing_unit if matrix_item else None,
        quantity=allocation.quantity,
        credits_per_unit=allocation.credits_per_unit,
        allocated_credits=allocation.allocated_credits,
        is_active=allocation.is_active,
        created_at=(
            _to_utc(allocation.created_at)
            if allocation.created_at
            else datetime.now(timezone.utc)
        ),
        updated_at=_to_utc(allocation.updated_at) if allocation.updated_at else None,
    )


def _build_org_credit_profile_response(
    profile: OrganizationCreditProfile,
    org_name_by_id: dict,
) -> OrganizationCreditProfileResponse:
    return OrganizationCreditProfileResponse(
        organization_id=profile.organization_id,
        organization_name=org_name_by_id.get(
            profile.organization_id, f"Org #{profile.organization_id}"
        ),
        total_price=float(profile.total_price or 0),
        buffer_percent=float(profile.buffer_percent or 0),
        discount_percent=float(profile.discount_percent or 0),
        payment_status=_normalize_payment_status(profile.payment_status),
        start_date=_to_utc(profile.start_date) if profile.start_date else None,
        end_date=_to_utc(profile.end_date) if profile.end_date else None,
        expiry_days=profile.expiry_days,
        notes=profile.notes,
        created_at=(
            _to_utc(profile.created_at)
            if profile.created_at
            else datetime.now(timezone.utc)
        ),
        updated_at=_to_utc(profile.updated_at) if profile.updated_at else None,
    )


def _normalize_payment_status(status: Optional[str]) -> str:
    value = (status or "pending").strip().lower()
    if value in {"paid", "pending", "partial", "failed"}:
        return value
    return "pending"


def _json_dump_stable(payload: Optional[dict]) -> Optional[str]:
    if payload is None:
        return None
    return json.dumps(payload, sort_keys=True, default=str)


def _create_credit_change_log(
    db: Session,
    organization_id: int,
    change_type: str,
    description: str,
    price_matrix_item_id: Optional[int] = None,
    previous_payload: Optional[dict] = None,
    new_payload: Optional[dict] = None,
):
    db.add(
        OrganizationCreditChangeLog(
            organization_id=organization_id,
            price_matrix_item_id=price_matrix_item_id,
            change_type=change_type,
            previous_json=_json_dump_stable(previous_payload),
            new_json=_json_dump_stable(new_payload),
            description=description,
        )
    )


def _build_invoice_response(
    invoice: BillingInvoice,
    org_name_by_id: dict,
) -> BillingInvoiceResponse:
    return BillingInvoiceResponse(
        id=invoice.id,
        organization_id=invoice.organization_id,
        organization_name=org_name_by_id.get(
            invoice.organization_id, f"Org #{invoice.organization_id}"
        ),
        invoice_number=invoice.invoice_number,
        issue_date=_to_utc(invoice.issue_date),
        due_date=_to_utc(invoice.due_date) if invoice.due_date else None,
        billing_start_date=(
            _to_utc(invoice.billing_start_date) if invoice.billing_start_date else None
        ),
        billing_end_date=(
            _to_utc(invoice.billing_end_date) if invoice.billing_end_date else None
        ),
        amount=float(invoice.amount or 0),
        paid_amount=float(invoice.paid_amount or 0),
        status=invoice.status or "pending",
        notes=invoice.notes,
        created_at=(
            _to_utc(invoice.created_at)
            if invoice.created_at
            else datetime.now(timezone.utc)
        ),
        updated_at=_to_utc(invoice.updated_at) if invoice.updated_at else None,
    )


def _build_payment_response(
    payment: BillingPayment,
    org_name_by_id: dict,
    invoice_by_id: dict,
) -> BillingPaymentResponse:
    invoice = invoice_by_id.get(payment.invoice_id) if payment.invoice_id else None
    return BillingPaymentResponse(
        id=payment.id,
        organization_id=payment.organization_id,
        organization_name=org_name_by_id.get(
            payment.organization_id, f"Org #{payment.organization_id}"
        ),
        invoice_id=payment.invoice_id,
        invoice_number=invoice.invoice_number if invoice else None,
        amount=float(payment.amount or 0),
        payment_date=_to_utc(payment.payment_date),
        method=payment.method or "bank_transfer",
        reference=payment.reference,
        status=payment.status or "completed",
        notes=payment.notes,
        created_at=(
            _to_utc(payment.created_at)
            if payment.created_at
            else datetime.now(timezone.utc)
        ),
    )


def _build_invoice_item_response(
    item: BillingInvoiceItem,
) -> BillingInvoiceItemResponse:
    return BillingInvoiceItemResponse(
        id=item.id,
        invoice_id=item.invoice_id,
        organization_id=item.organization_id,
        price_matrix_item_id=item.price_matrix_item_id,
        category=item.category or "",
        module=item.module or "",
        sub_module=item.sub_module,
        billing_unit=item.billing_unit,
        quantity=item.quantity,
        credits_per_unit=item.credits_per_unit,
        allocated_credits=float(item.allocated_credits or 0),
        created_at=(
            _to_utc(item.created_at) if item.created_at else datetime.now(timezone.utc)
        ),
    )


def _build_bill_response(
    bill: BillingBill,
    org_name_by_id: dict,
    invoice_by_id: dict,
) -> BillingBillResponse:
    invoice = invoice_by_id.get(bill.invoice_id)
    return BillingBillResponse(
        id=bill.id,
        organization_id=bill.organization_id,
        organization_name=org_name_by_id.get(
            bill.organization_id, f"Org #{bill.organization_id}"
        ),
        invoice_id=bill.invoice_id,
        invoice_number=(
            invoice.invoice_number if invoice else f"Invoice #{bill.invoice_id}"
        ),
        payment_id=bill.payment_id,
        bill_number=bill.bill_number,
        issued_date=_to_utc(bill.issued_date),
        amount=float(bill.amount or 0),
        payment_method=bill.payment_method,
        payment_reference=bill.payment_reference,
        notes=bill.notes,
        created_at=(
            _to_utc(bill.created_at) if bill.created_at else datetime.now(timezone.utc)
        ),
    )


def _snapshot_invoice_items(
    db: Session,
    invoice: BillingInvoice,
):
    rows = (
        db.query(OrganizationCreditAllocation)
        .filter(
            OrganizationCreditAllocation.organization_id == invoice.organization_id,
            OrganizationCreditAllocation.is_active == True,
        )
        .all()
    )
    if not rows:
        return

    matrix_ids = {row.price_matrix_item_id for row in rows}
    matrix_items = (
        db.query(PriceMatrixItem).filter(PriceMatrixItem.id.in_(matrix_ids)).all()
        if matrix_ids
        else []
    )
    matrix_by_id = {item.id: item for item in matrix_items}

    for row in rows:
        matrix = matrix_by_id.get(row.price_matrix_item_id)
        db.add(
            BillingInvoiceItem(
                invoice_id=invoice.id,
                organization_id=invoice.organization_id,
                price_matrix_item_id=row.price_matrix_item_id,
                category=matrix.category if matrix else "",
                module=matrix.module if matrix else "",
                sub_module=matrix.sub_module if matrix else None,
                billing_unit=matrix.billing_unit if matrix else None,
                quantity=row.quantity,
                credits_per_unit=row.credits_per_unit,
                allocated_credits=float(row.allocated_credits or 0),
            )
        )


def _generate_or_update_receipt_for_payment(
    db: Session,
    invoice: BillingInvoice,
    payment: Optional[BillingPayment],
    payment_amount: float,
    reason_note: Optional[str] = None,
) -> BillingBill:
    """Create or update the receipt (bill) record for a payment on an invoice."""
    existing = (
        db.query(BillingBill).filter(BillingBill.invoice_id == invoice.id).first()
    )
    now_utc = datetime.now(timezone.utc)
    if existing:
        existing.amount = round(payment_amount, 2)
        if payment:
            existing.payment_id = payment.id
            existing.payment_method = payment.method or existing.payment_method
            existing.payment_reference = payment.reference or existing.payment_reference
        existing.notes = reason_note or existing.notes
        _create_credit_change_log(
            db=db,
            organization_id=invoice.organization_id,
            change_type="receipt_updated",
            description=f"Receipt {existing.bill_number} updated for invoice {invoice.invoice_number}",
            previous_payload=None,
            new_payload={
                "bill_number": existing.bill_number,
                "amount": float(existing.amount or 0),
            },
        )
        return existing

    bill = BillingBill(
        organization_id=invoice.organization_id,
        invoice_id=invoice.id,
        payment_id=payment.id if payment else None,
        bill_number=f"RCP-{invoice.organization_id}-{int(now_utc.timestamp())}-{secrets.token_hex(2).upper()}",
        issued_date=now_utc,
        amount=round(payment_amount, 2),
        payment_method=payment.method if payment else None,
        payment_reference=payment.reference if payment else None,
        notes=reason_note or "Receipt generated for payment received",
    )
    db.add(bill)
    _create_credit_change_log(
        db=db,
        organization_id=invoice.organization_id,
        change_type="receipt_generated",
        description=f"Receipt {bill.bill_number} generated for invoice {invoice.invoice_number}",
        previous_payload=None,
        new_payload={
            "bill_number": bill.bill_number,
            "invoice_number": invoice.invoice_number,
            "amount": round(payment_amount, 2),
        },
    )
    return bill


def _generate_bill_for_paid_invoice(
    db: Session,
    invoice: BillingInvoice,
    payment: Optional[BillingPayment],
    reason_note: Optional[str] = None,
) -> BillingBill:
    """Legacy wrapper kept for compatibility with other callers."""
    payment_amount = float(invoice.paid_amount or invoice.amount or 0)
    return _generate_or_update_receipt_for_payment(
        db=db,
        invoice=invoice,
        payment=payment,
        payment_amount=payment_amount,
        reason_note=reason_note or "Auto-generated receipt for paid invoice",
    )


def _build_change_log_response(
    change: OrganizationCreditChangeLog,
) -> OrganizationCreditChangeLogResponse:
    return OrganizationCreditChangeLogResponse(
        id=change.id,
        organization_id=change.organization_id,
        price_matrix_item_id=change.price_matrix_item_id,
        change_type=change.change_type,
        previous_json=change.previous_json,
        new_json=change.new_json,
        description=change.description,
        created_at=(
            _to_utc(change.created_at)
            if change.created_at
            else datetime.now(timezone.utc)
        ),
    )


def _compute_invoice_status(amount: float, paid_amount: float) -> str:
    if paid_amount <= 0:
        return "pending"
    if paid_amount >= amount:
        return "paid"
    return "partial"


def _recompute_total_price_from_active_rows(
    db: Session,
    organization_id: int,
    profile: Optional[OrganizationCreditProfile],
) -> float:
    active_rows = (
        db.query(OrganizationCreditAllocation)
        .filter(
            OrganizationCreditAllocation.organization_id == organization_id,
            OrganizationCreditAllocation.is_active == True,
        )
        .all()
    )
    subtotal = sum(float(row.allocated_credits or 0) for row in active_rows)
    buffer_percent = float(profile.buffer_percent or 0) if profile else 0.0
    discount_percent = float(profile.discount_percent or 0) if profile else 0.0

    buffer_amount = subtotal * (buffer_percent / 100.0)
    after_buffer = subtotal + buffer_amount
    discount_amount = after_buffer * (discount_percent / 100.0)
    final_total = max(0.0, after_buffer - discount_amount)
    return round(final_total, 2)


def _auto_generate_invoice_for_org_change(
    db: Session,
    organization_id: int,
    profile: Optional[OrganizationCreditProfile],
    reason: str,
):
    if profile is None:
        profile = (
            db.query(OrganizationCreditProfile)
            .filter(OrganizationCreditProfile.organization_id == organization_id)
            .first()
        )
    if profile is None:
        profile = OrganizationCreditProfile(
            organization_id=organization_id,
            total_price=0,
            buffer_percent=0,
            discount_percent=0,
            payment_status="pending",
        )
        db.add(profile)

    computed_total = _recompute_total_price_from_active_rows(
        db, organization_id, profile
    )
    if profile is not None:
        profile.total_price = computed_total

    if computed_total <= 0:
        return

    now_utc = datetime.now(timezone.utc)
    normalized_payment_status = _normalize_payment_status(
        profile.payment_status if profile else "pending"
    )
    paid_amount = computed_total if normalized_payment_status == "paid" else 0.0
    invoice_status = _compute_invoice_status(computed_total, paid_amount)

    invoice = BillingInvoice(
        organization_id=organization_id,
        invoice_number=f"INV-{organization_id}-{int(now_utc.timestamp())}-{secrets.token_hex(2).upper()}",
        issue_date=now_utc,
        due_date=now_utc + timedelta(days=7),
        billing_start_date=profile.start_date if profile else None,
        billing_end_date=profile.end_date if profile else None,
        amount=computed_total,
        paid_amount=paid_amount,
        status=invoice_status,
        notes=reason,
    )
    db.add(invoice)
    db.flush()
    _snapshot_invoice_items(db, invoice)
    _create_credit_change_log(
        db=db,
        organization_id=organization_id,
        change_type="invoice_generated",
        description=f"Billing invoice {invoice.invoice_number} generated",
        previous_payload=None,
        new_payload={
            "invoice_number": invoice.invoice_number,
            "amount": computed_total,
            "status": invoice_status,
            "reason": reason,
        },
    )


def _apply_profile_patch(
    profile: OrganizationCreditProfile,
    patch: Union[
        OrganizationCreditProfileInput, OrganizationCreditProfileUpdateRequest
    ],
):
    data = patch.model_dump(exclude_unset=True)
    if "total_price" in data and data["total_price"] is not None:
        profile.total_price = float(data["total_price"])
    if "buffer_percent" in data and data["buffer_percent"] is not None:
        profile.buffer_percent = float(data["buffer_percent"])
    if "discount_percent" in data and data["discount_percent"] is not None:
        profile.discount_percent = float(data["discount_percent"])
    if "payment_status" in data and data["payment_status"] is not None:
        profile.payment_status = _normalize_payment_status(data["payment_status"])
    if "start_date" in data:
        profile.start_date = data["start_date"]
    if "end_date" in data:
        profile.end_date = data["end_date"]
    if "expiry_days" in data:
        profile.expiry_days = data["expiry_days"]
    if "notes" in data:
        profile.notes = data["notes"]


@router.post("/bootstrap", status_code=status.HTTP_201_CREATED)
async def bootstrap_superadmin(
    request: SuperAdminBootstrapRequest, db: Session = Depends(get_db)
):
    """Create the first superadmin (only if none exists)."""
    existing = db.query(SuperAdmin).first()
    if existing:
        raise HTTPException(status_code=400, detail="Superadmin already exists")

    superadmin = SuperAdmin(
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        is_active=True,
    )
    db.add(superadmin)
    db.commit()
    db.refresh(superadmin)

    return {"message": "Superadmin created", "superadmin_id": superadmin.id}


@router.post("/login", response_model=SuperAdminLoginResponse)
async def superadmin_login(
    request: SuperAdminLoginRequest, db: Session = Depends(get_db)
):
    superadmin = (
        db.query(SuperAdmin).filter(SuperAdmin.username == request.username).first()
    )

    if (
        not superadmin
        or not verify_password(request.password, superadmin.hashed_password)
        or not superadmin.is_active
    ):
        raise HTTPException(
            status_code=401, detail="Invalid credentials or inactive superadmin"
        )

    access_token = create_access_token(data={"sa": superadmin.id, "role": "SUPERADMIN"})
    return SuperAdminLoginResponse(
        access_token=access_token,
        superadmin_id=superadmin.id,
    )


@router.post(
    "/organizations",
    response_model=SuperAdminOrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_organization_with_admin(
    request: SuperAdminCreateOrganizationRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    org_name = (request.organization_name or "").strip()
    admin_username = (request.admin_username or "").strip()

    if not org_name:
        raise HTTPException(status_code=400, detail="Organization name is required")
    if not admin_username:
        raise HTTPException(status_code=400, detail="Admin username is required")

    existing_org = (
        db.query(Organization)
        .filter(func.lower(Organization.name) == org_name.lower())
        .first()
    )
    if existing_org:
        raise HTTPException(status_code=400, detail="Organization already exists")

    org = Organization(
        name=org_name,
        description=request.description,
        joining_date=request.joining_date,
        effective_joining_date=request.effective_joining_date,
        org_domain=_build_org_domain(org_name),
        access_token=secrets.token_urlsafe(32),
        echoleads_api_key=request.echoleads_api_key,
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    try:
        admin_user = User(
            username=admin_username,
            email=request.admin_email,
            hashed_password=get_password_hash(request.admin_password),
            role=UserRole.ADMIN,
            organization_id=org.id,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    except IntegrityError:
        db.rollback()
        db.delete(org)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Admin username or email already exists in this organization",
        )

    limits_payload = request.limits.dict(exclude_unset=True) if request.limits else {}
    limits = update_limits(db, org.id, limits_payload)

    return SuperAdminOrganizationResponse(
        id=org.id,
        name=org.name,
        description=org.description,
        joining_date=org.joining_date,
        effective_joining_date=org.effective_joining_date,
        admin_username=admin_user.username,
        admin_email=admin_user.email,
        limits=limits,
        echoleads_api_key=org.echoleads_api_key,
    )


@router.get("/organizations", response_model=List[SuperAdminOrganizationResponse])
async def list_organizations(
    db: Session = Depends(get_db), superadmin: SuperAdmin = Depends(require_superadmin)
):
    orgs = db.query(Organization).all()
    return [_build_org_response(db, org) for org in orgs]


@router.put("/organizations/{org_id}", response_model=SuperAdminOrganizationResponse)
async def update_organization_with_admin(
    org_id: int,
    request: SuperAdminUpdateOrganizationRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    admin_user = (
        db.query(User)
        .filter(
            User.organization_id == org.id,
            User.role == UserRole.ADMIN,
        )
        .first()
    )

    if request.organization_name is not None:
        org_name = request.organization_name.strip()
        if not org_name:
            raise HTTPException(status_code=400, detail="Organization name is required")
        duplicate_org = (
            db.query(Organization)
            .filter(
                func.lower(Organization.name) == org_name.lower(),
                Organization.id != org.id,
            )
            .first()
        )
        if duplicate_org:
            raise HTTPException(status_code=400, detail="Organization already exists")
        org.name = org_name

    if request.description is not None:
        org.description = request.description
    if request.joining_date is not None:
        org.joining_date = request.joining_date
    if request.effective_joining_date is not None:
        org.effective_joining_date = request.effective_joining_date
    if request.echoleads_api_key is not None:
        org.echoleads_api_key = request.echoleads_api_key

    admin_username = (
        request.admin_username.strip() if request.admin_username is not None else None
    )
    admin_email = (
        str(request.admin_email).strip() if request.admin_email is not None else None
    )
    admin_password = (
        request.admin_password.strip() if request.admin_password is not None else None
    )

    if not admin_user:
        if not admin_username:
            raise HTTPException(
                status_code=400,
                detail="Admin username is required to create missing admin",
            )
        if not admin_email:
            raise HTTPException(
                status_code=400,
                detail="Admin email is required to create missing admin",
            )
        if not admin_password:
            raise HTTPException(
                status_code=400,
                detail="Admin password is required to create missing admin",
            )

        existing_username = (
            db.query(User)
            .filter(
                User.organization_id == org.id,
                func.lower(User.username) == admin_username.lower(),
            )
            .first()
        )
        if existing_username:
            raise HTTPException(
                status_code=400,
                detail="Admin username already exists in this organization",
            )

        existing_email = (
            db.query(User)
            .filter(
                User.organization_id == org.id,
                func.lower(User.email) == admin_email.lower(),
            )
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="Admin email already exists in this organization",
            )

        admin_user = User(
            username=admin_username,
            email=admin_email,
            hashed_password=get_password_hash(admin_password),
            role=UserRole.ADMIN,
            organization_id=org.id,
            is_active=True,
        )
        db.add(admin_user)
    else:
        if (
            request.admin_email is not None or request.admin_password is not None
        ) and request.admin_username is None:
            raise HTTPException(
                status_code=400,
                detail="Admin username is required when updating admin credentials",
            )

        if request.admin_username is not None:
            if not admin_username:
                raise HTTPException(
                    status_code=400, detail="Admin username is required"
                )
            existing_username = (
                db.query(User)
                .filter(
                    User.organization_id == org.id,
                    func.lower(User.username) == admin_username.lower(),
                    User.id != admin_user.id,
                )
                .first()
            )
            if existing_username:
                raise HTTPException(
                    status_code=400,
                    detail="Admin username already exists in this organization",
                )
            admin_user.username = admin_username

        if request.admin_email is not None:
            if not admin_email:
                raise HTTPException(status_code=400, detail="Admin email is required")
            existing_email = (
                db.query(User)
                .filter(
                    User.organization_id == org.id,
                    func.lower(User.email) == admin_email.lower(),
                    User.id != admin_user.id,
                )
                .first()
            )
            if existing_email:
                raise HTTPException(
                    status_code=400,
                    detail="Admin email already exists in this organization",
                )
            admin_user.email = admin_email

        if request.admin_password is not None:
            if not admin_password:
                raise HTTPException(
                    status_code=400, detail="Admin password cannot be empty"
                )
            admin_user.hashed_password = get_password_hash(admin_password)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Failed to update organization details due to duplicate data",
        )

    db.refresh(org)
    db.refresh(admin_user)
    return _build_org_response(db, org, admin_user)


@router.get("/organizations/{org_id}/limits", response_model=OrganizationLimitsResponse)
async def get_organization_limits(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    limits = get_or_create_limits(db, org_id)
    return limits


@router.put("/organizations/{org_id}/limits", response_model=OrganizationLimitsResponse)
async def update_organization_limits(
    org_id: int,
    updates: OrganizationLimitsUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    update_data = updates.dict(exclude_unset=True)
    limits = update_limits(db, org_id, update_data)
    return limits


@router.get("/price-matrix", response_model=List[PriceMatrixItemResponse])
async def list_price_matrix_items(
    active_only: bool = False,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    query = db.query(PriceMatrixItem)
    if active_only:
        query = query.filter(PriceMatrixItem.is_active == True)

    return query.order_by(
        PriceMatrixItem.sort_order.asc(),
        PriceMatrixItem.category.asc(),
        PriceMatrixItem.module.asc(),
        PriceMatrixItem.id.asc(),
    ).all()


def _sync_price_matrix_id_sequence(db: Session) -> None:
    """Ensure Postgres sequence for price_matrix_items.id is aligned with table data."""
    db.execute(
        text(
            """
            SELECT setval(
                pg_get_serial_sequence('price_matrix_items', 'id'),
                COALESCE((SELECT MAX(id) FROM price_matrix_items), 0) + 1,
                false
            )
            """
        )
    )


@router.post(
    "/price-matrix",
    response_model=PriceMatrixItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_price_matrix_item(
    payload: PriceMatrixItemCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    # Keep sequence aligned even when legacy/manual inserts advanced IDs.
    _sync_price_matrix_id_sequence(db)

    item = PriceMatrixItem(**payload.model_dump())
    db.add(item)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        error_text = str(exc).lower()

        # Retry once if the primary key sequence is stale.
        if (
            "price_matrix_items_pkey" in error_text
            and "duplicate key value" in error_text
        ):
            _sync_price_matrix_id_sequence(db)
            retry_item = PriceMatrixItem(**payload.model_dump())
            db.add(retry_item)
            try:
                db.commit()
                db.refresh(retry_item)
                return retry_item
            except IntegrityError:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail="Could not create price matrix item due to duplicate key conflict.",
                )

        raise HTTPException(
            status_code=400,
            detail="Could not create price matrix item. Check if feature_code is already used.",
        )

    db.refresh(item)
    return item


@router.put("/price-matrix/item/{item_id}", response_model=PriceMatrixItemResponse)
async def update_price_matrix_item(
    item_id: int,
    payload: PriceMatrixItemUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    item = db.query(PriceMatrixItem).filter(PriceMatrixItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Price matrix item not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(item, key):
            setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/price-matrix/item/{item_id}")
async def delete_price_matrix_item(
    item_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    item = db.query(PriceMatrixItem).filter(PriceMatrixItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Price matrix item not found")

    db.delete(item)
    db.commit()
    return {"success": True, "deleted_item_id": item_id}


@router.post(
    "/organization-credit-allocations",
    response_model=List[OrganizationCreditAllocationResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_organization_credit_allocations(
    payload: OrganizationCreditAllocationCreateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    organization = (
        db.query(Organization)
        .filter(Organization.id == payload.organization_id)
        .first()
    )
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not payload.lines and payload.profile is None:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one allocation line or organization profile details",
        )

    profile = (
        db.query(OrganizationCreditProfile)
        .filter(OrganizationCreditProfile.organization_id == payload.organization_id)
        .first()
    )
    profile_created = False
    if not profile:
        profile = OrganizationCreditProfile(
            organization_id=payload.organization_id,
            total_price=0,
            buffer_percent=0,
            discount_percent=0,
            payment_status="pending",
        )
        db.add(profile)
        profile_created = True

    now_utc = datetime.now(timezone.utc)
    cycle_expired = bool(
        profile.end_date and _to_utc(profile.end_date).date() < now_utc.date()
    )
    has_changes = False

    profile_before = {
        "total_price": float(profile.total_price or 0),
        "buffer_percent": float(profile.buffer_percent or 0),
        "discount_percent": float(profile.discount_percent or 0),
        "payment_status": _normalize_payment_status(profile.payment_status),
        "start_date": (
            _to_utc(profile.start_date).isoformat() if profile.start_date else None
        ),
        "end_date": _to_utc(profile.end_date).isoformat() if profile.end_date else None,
        "expiry_days": profile.expiry_days,
        "notes": profile.notes,
    }

    if payload.profile is not None:
        _apply_profile_patch(profile, payload.profile)
        profile_after = {
            "total_price": float(profile.total_price or 0),
            "buffer_percent": float(profile.buffer_percent or 0),
            "discount_percent": float(profile.discount_percent or 0),
            "payment_status": _normalize_payment_status(profile.payment_status),
            "start_date": (
                _to_utc(profile.start_date).isoformat() if profile.start_date else None
            ),
            "end_date": (
                _to_utc(profile.end_date).isoformat() if profile.end_date else None
            ),
            "expiry_days": profile.expiry_days,
            "notes": profile.notes,
        }
        if profile_created or _json_dump_stable(profile_before) != _json_dump_stable(
            profile_after
        ):
            has_changes = True
            _create_credit_change_log(
                db=db,
                organization_id=payload.organization_id,
                change_type=(
                    "profile_update" if not profile_created else "profile_create"
                ),
                description="Organization credit profile updated",
                previous_payload=profile_before if not profile_created else None,
                new_payload=profile_after,
            )

    affected_rows: List[OrganizationCreditAllocation] = []
    matrix_by_id = {}
    if payload.lines:
        seen_matrix_ids = set()
        duplicate_matrix_ids = set()
        for line in payload.lines:
            if line.price_matrix_item_id in seen_matrix_ids:
                duplicate_matrix_ids.add(line.price_matrix_item_id)
            seen_matrix_ids.add(line.price_matrix_item_id)
        if duplicate_matrix_ids:
            duplicate_list = ", ".join(map(str, sorted(duplicate_matrix_ids)))
            raise HTTPException(
                status_code=400,
                detail=f"Price matrix row already exists in request: {duplicate_list}",
            )

        matrix_ids = {line.price_matrix_item_id for line in payload.lines}
        matrix_items = (
            db.query(PriceMatrixItem).filter(PriceMatrixItem.id.in_(matrix_ids)).all()
        )
        matrix_by_id = {item.id: item for item in matrix_items}
        missing_ids = sorted(matrix_ids - set(matrix_by_id.keys()))
        if missing_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Price matrix item(s) not found: {', '.join(map(str, missing_ids))}",
            )

        if cycle_expired:
            old_active_rows = (
                db.query(OrganizationCreditAllocation)
                .filter(
                    OrganizationCreditAllocation.organization_id
                    == payload.organization_id,
                    OrganizationCreditAllocation.is_active == True,
                )
                .all()
            )
            for old_row in old_active_rows:
                old_row.is_active = False
                has_changes = True
                _create_credit_change_log(
                    db=db,
                    organization_id=payload.organization_id,
                    price_matrix_item_id=old_row.price_matrix_item_id,
                    change_type="cycle_rollover_deactivate",
                    description="Previous cycle expired; row deactivated for new cycle",
                    previous_payload={
                        "id": old_row.id,
                        "quantity": old_row.quantity,
                        "credits_per_unit": old_row.credits_per_unit,
                        "allocated_credits": old_row.allocated_credits,
                        "is_active": True,
                    },
                    new_payload={"is_active": False},
                )
            existing_active_rows = []
        else:
            existing_active_rows = (
                db.query(OrganizationCreditAllocation)
                .filter(
                    OrganizationCreditAllocation.organization_id
                    == payload.organization_id,
                    OrganizationCreditAllocation.is_active == True,
                    OrganizationCreditAllocation.price_matrix_item_id.in_(matrix_ids),
                )
                .all()
            )

        existing_count_by_matrix_id = {}
        for row in existing_active_rows:
            existing_count_by_matrix_id[row.price_matrix_item_id] = (
                existing_count_by_matrix_id.get(row.price_matrix_item_id, 0) + 1
            )
        duplicate_active_matrix_ids = sorted(
            matrix_id
            for matrix_id, count in existing_count_by_matrix_id.items()
            if count > 1
        )
        if duplicate_active_matrix_ids:
            duplicate_list = ", ".join(map(str, duplicate_active_matrix_ids))
            raise HTTPException(
                status_code=400,
                detail=f"Price matrix row already exists as duplicate active subscription: {duplicate_list}",
            )
        existing_row_by_matrix_id = {
            row.price_matrix_item_id: row for row in existing_active_rows
        }

        for line in payload.lines:
            matrix_item = matrix_by_id[line.price_matrix_item_id]
            credits_per_unit = line.credits_per_unit
            if credits_per_unit is None:
                credits_per_unit = float(matrix_item.credits_per_unit or 0)

            allocated_credits = line.allocated_credits
            if allocated_credits is None:
                if line.quantity is not None:
                    allocated_credits = float(line.quantity) * float(
                        credits_per_unit or 0
                    )
                else:
                    allocated_credits = 0.0

            existing_row = existing_row_by_matrix_id.get(line.price_matrix_item_id)
            if existing_row:
                previous_payload = {
                    "quantity": existing_row.quantity,
                    "credits_per_unit": existing_row.credits_per_unit,
                    "allocated_credits": existing_row.allocated_credits,
                }
                existing_row.quantity = line.quantity
                existing_row.credits_per_unit = credits_per_unit
                existing_row.allocated_credits = float(allocated_credits)
                new_payload = {
                    "quantity": existing_row.quantity,
                    "credits_per_unit": existing_row.credits_per_unit,
                    "allocated_credits": existing_row.allocated_credits,
                }
                if _json_dump_stable(previous_payload) != _json_dump_stable(
                    new_payload
                ):
                    has_changes = True
                    _create_credit_change_log(
                        db=db,
                        organization_id=payload.organization_id,
                        price_matrix_item_id=existing_row.price_matrix_item_id,
                        change_type="allocation_update",
                        description="Existing allocation updated",
                        previous_payload=previous_payload,
                        new_payload=new_payload,
                    )
                affected_rows.append(existing_row)
            else:
                row = OrganizationCreditAllocation(
                    organization_id=payload.organization_id,
                    price_matrix_item_id=line.price_matrix_item_id,
                    quantity=line.quantity,
                    credits_per_unit=credits_per_unit,
                    allocated_credits=float(allocated_credits),
                    is_active=True,
                )
                db.add(row)
                has_changes = True
                _create_credit_change_log(
                    db=db,
                    organization_id=payload.organization_id,
                    price_matrix_item_id=line.price_matrix_item_id,
                    change_type="allocation_create",
                    description="New allocation row added",
                    previous_payload=None,
                    new_payload={
                        "quantity": line.quantity,
                        "credits_per_unit": credits_per_unit,
                        "allocated_credits": float(allocated_credits),
                    },
                )
                affected_rows.append(row)

    if has_changes:
        _auto_generate_invoice_for_org_change(
            db=db,
            organization_id=payload.organization_id,
            profile=profile,
            reason="Auto-generated from organization credit configuration update",
        )

    db.commit()
    for row in affected_rows:
        db.refresh(row)

    if not affected_rows:
        return []

    org_name_by_id = {organization.id: organization.name}
    return [
        _build_org_credit_allocation_response(
            allocation=row,
            org_name_by_id=org_name_by_id,
            matrix_item_by_id=matrix_by_id,
        )
        for row in affected_rows
    ]


@router.get(
    "/organization-credit-allocations",
    response_model=List[OrganizationCreditAllocationResponse],
)
async def list_organization_credit_allocations(
    organization_id: Optional[int] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    query = db.query(OrganizationCreditAllocation)
    if active_only:
        query = query.filter(OrganizationCreditAllocation.is_active == True)
    if organization_id is not None:
        query = query.filter(
            OrganizationCreditAllocation.organization_id == organization_id
        )

    rows = query.order_by(
        OrganizationCreditAllocation.created_at.desc(),
        OrganizationCreditAllocation.id.desc(),
    ).all()
    if not rows:
        return []

    org_ids = {row.organization_id for row in rows}
    matrix_ids = {row.price_matrix_item_id for row in rows}
    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    matrix_items = (
        db.query(PriceMatrixItem).filter(PriceMatrixItem.id.in_(matrix_ids)).all()
    )
    org_name_by_id = {org.id: org.name for org in orgs}
    matrix_by_id = {item.id: item for item in matrix_items}

    responses = [
        _build_org_credit_allocation_response(
            allocation=row,
            org_name_by_id=org_name_by_id,
            matrix_item_by_id=matrix_by_id,
        )
        for row in rows
    ]

    term = (search or "").strip().lower()
    if term:
        responses = [
            row
            for row in responses
            if term in row.organization_name.lower()
            or term in row.category.lower()
            or term in row.module.lower()
            or term in (row.sub_module or "").lower()
        ]

    return responses


@router.get(
    "/organization-credit-allocations/profile/{organization_id}",
    response_model=OrganizationCreditProfileResponse,
)
async def get_organization_credit_profile(
    organization_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    organization = (
        db.query(Organization).filter(Organization.id == organization_id).first()
    )
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    profile = (
        db.query(OrganizationCreditProfile)
        .filter(OrganizationCreditProfile.organization_id == organization_id)
        .first()
    )
    if not profile:
        profile = OrganizationCreditProfile(
            organization_id=organization_id,
            total_price=0,
            buffer_percent=0,
            discount_percent=0,
            payment_status="pending",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return _build_org_credit_profile_response(
        profile, {organization.id: organization.name}
    )


@router.put(
    "/organization-credit-allocations/profile/{organization_id}",
    response_model=OrganizationCreditProfileResponse,
)
async def update_organization_credit_profile(
    organization_id: int,
    payload: OrganizationCreditProfileUpdateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    organization = (
        db.query(Organization).filter(Organization.id == organization_id).first()
    )
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    profile = (
        db.query(OrganizationCreditProfile)
        .filter(OrganizationCreditProfile.organization_id == organization_id)
        .first()
    )
    if not profile:
        profile = OrganizationCreditProfile(
            organization_id=organization_id,
            total_price=0,
            buffer_percent=0,
            discount_percent=0,
            payment_status="pending",
        )
        db.add(profile)

    _apply_profile_patch(profile, payload)
    db.commit()
    db.refresh(profile)

    return _build_org_credit_profile_response(
        profile, {organization.id: organization.name}
    )


@router.get(
    "/organization-credit-allocations/summary",
    response_model=List[OrganizationCreditAllocationSummaryResponse],
)
async def summarize_organization_credit_allocations(
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    rows = (
        db.query(OrganizationCreditAllocation)
        .filter(OrganizationCreditAllocation.is_active == True)
        .all()
    )
    profiles = db.query(OrganizationCreditProfile).all()

    org_ids = {row.organization_id for row in rows} | {
        profile.organization_id for profile in profiles
    }
    if not org_ids:
        return []

    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    org_name_by_id = {org.id: org.name for org in orgs}
    profile_by_org_id = {profile.organization_id: profile for profile in profiles}

    summary_map: dict = {}
    for row in rows:
        bucket = summary_map.setdefault(
            row.organization_id,
            {
                "total_allocated_credits": 0.0,
                "row_count": 0,
            },
        )
        bucket["total_allocated_credits"] += float(row.allocated_credits or 0)
        bucket["row_count"] += 1

    summaries: List[OrganizationCreditAllocationSummaryResponse] = []
    for org_id in sorted(org_ids):
        values = summary_map.get(
            org_id, {"total_allocated_credits": 0.0, "row_count": 0}
        )
        profile = profile_by_org_id.get(org_id)
        summaries.append(
            OrganizationCreditAllocationSummaryResponse(
                organization_id=org_id,
                organization_name=org_name_by_id.get(org_id, f"Org #{org_id}"),
                total_allocated_credits=round(values["total_allocated_credits"], 2),
                total_price=(
                    round(float(profile.total_price or 0), 2) if profile else 0.0
                ),
                buffer_percent=(
                    round(float(profile.buffer_percent or 0), 2) if profile else 0.0
                ),
                discount_percent=(
                    round(float(profile.discount_percent or 0), 2) if profile else 0.0
                ),
                payment_status=_normalize_payment_status(
                    profile.payment_status if profile else "pending"
                ),
                start_date=(
                    _to_utc(profile.start_date)
                    if profile and profile.start_date
                    else None
                ),
                end_date=(
                    _to_utc(profile.end_date) if profile and profile.end_date else None
                ),
                expiry_days=profile.expiry_days if profile else None,
                notes=profile.notes if profile else None,
                row_count=values["row_count"],
            )
        )

    return summaries


@router.get(
    "/organization-credit-allocations/changes",
    response_model=List[OrganizationCreditChangeLogResponse],
)
async def list_organization_credit_changes(
    organization_id: Optional[int] = None,
    change_type: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    safe_limit = max(1, min(limit, 1000))
    query = db.query(OrganizationCreditChangeLog)
    if organization_id is not None:
        query = query.filter(
            OrganizationCreditChangeLog.organization_id == organization_id
        )
    if change_type and change_type.strip():
        query = query.filter(
            OrganizationCreditChangeLog.change_type == change_type.strip()
        )

    rows = (
        query.order_by(
            OrganizationCreditChangeLog.created_at.desc(),
            OrganizationCreditChangeLog.id.desc(),
        )
        .limit(safe_limit)
        .all()
    )
    return [_build_change_log_response(row) for row in rows]


@router.get("/billing/invoices", response_model=List[BillingInvoiceResponse])
async def list_billing_invoices(
    organization_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    query = db.query(BillingInvoice)
    if organization_id is not None:
        query = query.filter(BillingInvoice.organization_id == organization_id)

    normalized_status = (status_filter or "").strip().lower()
    if normalized_status and normalized_status != "all":
        query = query.filter(func.lower(BillingInvoice.status) == normalized_status)

    rows = query.order_by(
        BillingInvoice.created_at.desc(), BillingInvoice.id.desc()
    ).all()
    if not rows:
        return []

    org_ids = {row.organization_id for row in rows}
    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    org_name_by_id = {org.id: org.name for org in orgs}
    return [_build_invoice_response(row, org_name_by_id) for row in rows]


@router.get(
    "/billing/invoices/{invoice_id}", response_model=BillingInvoiceDetailResponse
)
async def get_billing_invoice_detail(
    invoice_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    invoice = db.query(BillingInvoice).filter(BillingInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Billing invoice not found")

    organization = (
        db.query(Organization)
        .filter(Organization.id == invoice.organization_id)
        .first()
    )
    items = (
        db.query(BillingInvoiceItem)
        .filter(BillingInvoiceItem.invoice_id == invoice.id)
        .order_by(BillingInvoiceItem.id.asc())
        .all()
    )
    if not items:
        _snapshot_invoice_items(db, invoice)
        db.commit()
        items = (
            db.query(BillingInvoiceItem)
            .filter(BillingInvoiceItem.invoice_id == invoice.id)
            .order_by(BillingInvoiceItem.id.asc())
            .all()
        )

    bills = (
        db.query(BillingBill)
        .filter(BillingBill.invoice_id == invoice.id)
        .order_by(BillingBill.id.desc())
        .all()
    )

    org_name_by_id = {
        invoice.organization_id: (
            organization.name if organization else f"Org #{invoice.organization_id}"
        )
    }
    invoice_by_id = {invoice.id: invoice}
    base_invoice = _build_invoice_response(invoice, org_name_by_id)

    return BillingInvoiceDetailResponse(
        **base_invoice.model_dump(),
        items=[_build_invoice_item_response(item) for item in items],
        bills=[
            _build_bill_response(bill, org_name_by_id, invoice_by_id) for bill in bills
        ],
    )


@router.get("/billing/invoices/{invoice_id}/export")
async def export_billing_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    detail = await get_billing_invoice_detail(
        invoice_id=invoice_id, db=db, superadmin=superadmin
    )
    return {
        "document_type": "invoice",
        "generated_at": _to_utc(datetime.now(timezone.utc)).isoformat(),
        "invoice": detail.model_dump(),
    }


@router.post(
    "/billing/invoices/{invoice_id}/mark-paid",
    response_model=BillingInvoiceMarkPaidResponse,
)
async def mark_billing_invoice_paid(
    invoice_id: int,
    payload: BillingInvoiceMarkPaidRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    invoice = db.query(BillingInvoice).filter(BillingInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Billing invoice not found")

    total_outstanding = round(
        float(invoice.amount or 0) - float(invoice.paid_amount or 0), 2
    )
    if total_outstanding <= 0:
        raise HTTPException(status_code=400, detail="Invoice is already fully paid")

    now_utc = datetime.now(timezone.utc)
    payment_date = payload.payment_date or now_utc
    method = (payload.method or "bank_transfer").strip() or "bank_transfer"
    reference = (payload.reference or "").strip() or None
    notes_text = (payload.notes or "").strip() or None

    # Step 1: Auto-apply existing credit payments for this organisation
    credit_applied = 0.0
    credit_payments = (
        db.query(BillingPayment)
        .filter(
            BillingPayment.organization_id == invoice.organization_id,
            BillingPayment.invoice_id == None,  # noqa: E711
            BillingPayment.status == "credit",
        )
        .order_by(BillingPayment.created_at.asc())
        .all()
    )
    for cp in credit_payments:
        if total_outstanding <= 0:
            break
        apply_amount = min(round(float(cp.amount or 0), 2), total_outstanding)
        credit_applied = round(credit_applied + apply_amount, 2)
        total_outstanding = round(total_outstanding - apply_amount, 2)
        cp.amount = round(float(cp.amount or 0) - apply_amount, 2)
        if cp.amount <= 0:
            cp.status = "consumed"
            cp.invoice_id = invoice.id
        _create_credit_change_log(
            db=db,
            organization_id=invoice.organization_id,
            change_type="credit_applied",
            description=f"Credit of {apply_amount} applied from credit payment #{cp.id} to invoice {invoice.invoice_number}",
            previous_payload=None,
            new_payload={
                "credit_payment_id": cp.id,
                "applied": apply_amount,
                "invoice_number": invoice.invoice_number,
            },
        )

    # Step 2: Determine actual payment amount from user input
    credit_note_amount = 0.0
    if payload.amount_paid is not None:
        requested = round(float(payload.amount_paid), 2)
        if requested >= total_outstanding:
            # Overpayment: pay full outstanding, store excess as credit
            credit_note_amount = round(requested - total_outstanding, 2)
            actual_payment = total_outstanding
        else:
            actual_payment = requested
    else:
        actual_payment = total_outstanding

    # Step 3: Record the payment
    payment = BillingPayment(
        organization_id=invoice.organization_id,
        invoice_id=invoice.id,
        amount=round(actual_payment, 2),
        payment_date=payment_date,
        method=method,
        reference=reference,
        status="completed",
        notes=notes_text,
    )
    db.add(payment)
    db.flush()

    # Step 4: Store excess as a credit payment for future invoices
    credit_payment_record = None
    if credit_note_amount > 0:
        credit_payment_record = BillingPayment(
            organization_id=invoice.organization_id,
            invoice_id=None,
            amount=round(credit_note_amount, 2),
            payment_date=payment_date,
            method=method,
            reference=reference,
            status="credit",
            notes=f"Overpayment credit from invoice {invoice.invoice_number}. Will be auto-applied on next billing cycle.",
        )
        db.add(credit_payment_record)
        db.flush()

    # Step 5: Update the invoice
    previous_invoice_payload = {
        "paid_amount": float(invoice.paid_amount or 0),
        "status": invoice.status or "pending",
    }
    total_credited_now = round(credit_applied + actual_payment, 2)
    invoice.paid_amount = round(float(invoice.paid_amount or 0) + total_credited_now, 2)
    invoice.status = _compute_invoice_status(
        float(invoice.amount or 0), float(invoice.paid_amount or 0)
    )
    _create_credit_change_log(
        db=db,
        organization_id=invoice.organization_id,
        change_type="invoice_payment_received",
        description=f"Payment received for invoice {invoice.invoice_number}",
        previous_payload=previous_invoice_payload,
        new_payload={
            "paid_amount": float(invoice.paid_amount or 0),
            "status": invoice.status,
            "payment_id": payment.id,
        },
    )

    # Step 6: Create partial residual invoice if underpaid
    partial_invoice_obj = None
    if invoice.status == "partial":
        remaining = round(
            float(invoice.amount or 0) - float(invoice.paid_amount or 0), 2
        )
        partial_invoice_obj = BillingInvoice(
            organization_id=invoice.organization_id,
            invoice_number=f"INV-{invoice.organization_id}-{int(now_utc.timestamp())}-{secrets.token_hex(2).upper()}-R",
            issue_date=now_utc,
            due_date=invoice.due_date,
            billing_start_date=invoice.billing_start_date,
            billing_end_date=invoice.billing_end_date,
            amount=remaining,
            paid_amount=0.0,
            status="pending",
            notes=f"Residual balance from partial payment on invoice {invoice.invoice_number}",
        )
        db.add(partial_invoice_obj)
        db.flush()
        _create_credit_change_log(
            db=db,
            organization_id=invoice.organization_id,
            change_type="partial_invoice_created",
            description=f"Partial invoice {partial_invoice_obj.invoice_number} created for remaining balance of {remaining}",
            previous_payload=None,
            new_payload={
                "invoice_number": partial_invoice_obj.invoice_number,
                "amount": remaining,
            },
        )

    # Step 7: Generate / update the receipt (bill)
    bill = _generate_or_update_receipt_for_payment(
        db=db,
        invoice=invoice,
        payment=payment,
        payment_amount=round(actual_payment, 2),
        reason_note="Receipt generated for payment received",
    )

    db.commit()
    db.refresh(payment)
    db.refresh(invoice)
    db.refresh(bill)
    if partial_invoice_obj:
        db.refresh(partial_invoice_obj)

    organization = (
        db.query(Organization)
        .filter(Organization.id == invoice.organization_id)
        .first()
    )
    org_name_by_id = {
        invoice.organization_id: (
            organization.name if organization else f"Org #{invoice.organization_id}"
        )
    }
    invoice_by_id = {invoice.id: invoice}
    if partial_invoice_obj:
        invoice_by_id[partial_invoice_obj.id] = partial_invoice_obj

    return BillingInvoiceMarkPaidResponse(
        invoice=_build_invoice_response(invoice, org_name_by_id),
        payment=_build_payment_response(payment, org_name_by_id, invoice_by_id),
        bill=_build_bill_response(bill, org_name_by_id, invoice_by_id),
        partial_invoice=(
            _build_invoice_response(partial_invoice_obj, org_name_by_id)
            if partial_invoice_obj
            else None
        ),
        credit_note=round(credit_note_amount, 2) if credit_note_amount > 0 else None,
        credit_applied=round(credit_applied, 2) if credit_applied > 0 else None,
    )


@router.post("/billing/invoices/backfill-existing")
async def backfill_billing_invoices_for_existing_entries(
    force: bool = False,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    active_org_rows = (
        db.query(OrganizationCreditAllocation.organization_id)
        .filter(OrganizationCreditAllocation.is_active == True)
        .distinct()
        .all()
    )
    organization_ids = [
        int(row[0]) for row in active_org_rows if row and row[0] is not None
    ]

    created_org_ids: List[int] = []
    skipped_org_ids: List[int] = []
    skipped_with_existing_invoice: List[int] = []

    for organization_id in organization_ids:
        has_existing_invoice = (
            db.query(BillingInvoice.id)
            .filter(BillingInvoice.organization_id == organization_id)
            .first()
            is not None
        )

        if has_existing_invoice and not force:
            skipped_org_ids.append(organization_id)
            skipped_with_existing_invoice.append(organization_id)
            continue

        profile = (
            db.query(OrganizationCreditProfile)
            .filter(OrganizationCreditProfile.organization_id == organization_id)
            .first()
        )
        computed_total = _recompute_total_price_from_active_rows(
            db, organization_id, profile
        )
        if computed_total <= 0:
            skipped_org_ids.append(organization_id)
            continue

        _auto_generate_invoice_for_org_change(
            db=db,
            organization_id=organization_id,
            profile=profile,
            reason="Backfill invoice generated for existing organization subscription entries",
        )
        created_org_ids.append(organization_id)

    db.commit()
    return {
        "success": True,
        "force": force,
        "total_organizations_checked": len(organization_ids),
        "invoices_created_count": len(created_org_ids),
        "invoices_created_for_org_ids": created_org_ids,
        "skipped_count": len(skipped_org_ids),
        "skipped_org_ids": skipped_org_ids,
        "skipped_due_to_existing_invoice_org_ids": skipped_with_existing_invoice,
    }


@router.get("/billing/bills", response_model=List[BillingBillResponse])
async def list_billing_bills(
    organization_id: Optional[int] = None,
    invoice_id: Optional[int] = None,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    query = db.query(BillingBill)
    if organization_id is not None:
        query = query.filter(BillingBill.organization_id == organization_id)
    if invoice_id is not None:
        query = query.filter(BillingBill.invoice_id == invoice_id)

    rows = query.order_by(BillingBill.created_at.desc(), BillingBill.id.desc()).all()
    if not rows:
        return []

    org_ids = {row.organization_id for row in rows}
    invoice_ids = {row.invoice_id for row in rows}
    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    invoices = db.query(BillingInvoice).filter(BillingInvoice.id.in_(invoice_ids)).all()
    org_name_by_id = {org.id: org.name for org in orgs}
    invoice_by_id = {invoice.id: invoice for invoice in invoices}
    return [_build_bill_response(row, org_name_by_id, invoice_by_id) for row in rows]


@router.get("/billing/bills/{bill_id}", response_model=BillingBillResponse)
async def get_billing_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    bill = db.query(BillingBill).filter(BillingBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Billing bill not found")

    organization = (
        db.query(Organization).filter(Organization.id == bill.organization_id).first()
    )
    invoice = (
        db.query(BillingInvoice).filter(BillingInvoice.id == bill.invoice_id).first()
    )
    org_name_by_id = {
        bill.organization_id: (
            organization.name if organization else f"Org #{bill.organization_id}"
        )
    }
    invoice_by_id = {bill.invoice_id: invoice} if invoice else {}
    return _build_bill_response(bill, org_name_by_id, invoice_by_id)


@router.get("/billing/bills/{bill_id}/export")
async def export_billing_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    bill = await get_billing_bill(bill_id=bill_id, db=db, superadmin=superadmin)
    invoice_detail = await get_billing_invoice_detail(
        invoice_id=bill.invoice_id, db=db, superadmin=superadmin
    )
    return {
        "document_type": "bill",
        "generated_at": _to_utc(datetime.now(timezone.utc)).isoformat(),
        "bill": bill.model_dump(),
        "invoice": invoice_detail.model_dump(),
    }


@router.get("/billing/payments", response_model=List[BillingPaymentResponse])
async def list_billing_payments(
    organization_id: Optional[int] = None,
    invoice_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    query = db.query(BillingPayment)
    if organization_id is not None:
        query = query.filter(BillingPayment.organization_id == organization_id)
    if invoice_id is not None:
        query = query.filter(BillingPayment.invoice_id == invoice_id)

    normalized_status = (status_filter or "").strip().lower()
    if normalized_status and normalized_status != "all":
        query = query.filter(func.lower(BillingPayment.status) == normalized_status)

    rows = query.order_by(
        BillingPayment.created_at.desc(), BillingPayment.id.desc()
    ).all()
    if not rows:
        return []

    org_ids = {row.organization_id for row in rows}
    invoice_ids = {row.invoice_id for row in rows if row.invoice_id is not None}
    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    invoices = (
        db.query(BillingInvoice).filter(BillingInvoice.id.in_(invoice_ids)).all()
        if invoice_ids
        else []
    )

    org_name_by_id = {org.id: org.name for org in orgs}
    invoice_by_id = {invoice.id: invoice for invoice in invoices}
    return [_build_payment_response(row, org_name_by_id, invoice_by_id) for row in rows]


@router.post(
    "/billing/payments",
    response_model=BillingPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_billing_payment(
    payload: BillingPaymentCreateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    organization = (
        db.query(Organization)
        .filter(Organization.id == payload.organization_id)
        .first()
    )
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    invoice = None
    if payload.invoice_id is not None:
        invoice = (
            db.query(BillingInvoice)
            .filter(BillingInvoice.id == payload.invoice_id)
            .first()
        )
        if not invoice:
            raise HTTPException(status_code=404, detail="Billing invoice not found")
        if invoice.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=400,
                detail="Invoice does not belong to the selected organization",
            )

    payment_date = payload.payment_date or datetime.now(timezone.utc)
    normalized_payment_status = (
        payload.status or "completed"
    ).strip().lower() or "completed"
    payment = BillingPayment(
        organization_id=payload.organization_id,
        invoice_id=payload.invoice_id,
        amount=float(payload.amount or 0),
        payment_date=payment_date,
        method=(payload.method or "bank_transfer").strip() or "bank_transfer",
        reference=(payload.reference or "").strip() or None,
        status=normalized_payment_status,
        notes=(payload.notes or "").strip() or None,
    )
    db.add(payment)
    db.flush()

    _create_credit_change_log(
        db=db,
        organization_id=payload.organization_id,
        change_type="payment_recorded",
        description="Billing payment recorded",
        previous_payload=None,
        new_payload={
            "invoice_id": payload.invoice_id,
            "amount": float(payload.amount or 0),
            "payment_date": _to_utc(payment_date).isoformat(),
            "method": payment.method,
            "status": normalized_payment_status,
        },
    )

    successful_payment_statuses = {"completed", "paid", "success"}
    generated_bill = None
    if invoice is not None and normalized_payment_status in successful_payment_statuses:
        previous_payload = {
            "paid_amount": float(invoice.paid_amount or 0),
            "status": invoice.status or "pending",
        }
        invoice.paid_amount = float(invoice.paid_amount or 0) + float(
            payload.amount or 0
        )
        invoice.status = _compute_invoice_status(
            float(invoice.amount or 0), float(invoice.paid_amount or 0)
        )
        _create_credit_change_log(
            db=db,
            organization_id=payload.organization_id,
            change_type="invoice_payment_applied",
            description=f"Payment applied to invoice {invoice.invoice_number}",
            previous_payload=previous_payload,
            new_payload={
                "paid_amount": float(invoice.paid_amount or 0),
                "status": invoice.status or "pending",
            },
        )
        if invoice.status == "paid":
            generated_bill = _generate_bill_for_paid_invoice(
                db=db,
                invoice=invoice,
                payment=payment,
                reason_note="Generated after payment was applied to invoice",
            )

    db.commit()
    db.refresh(payment)
    if invoice is not None:
        db.refresh(invoice)
    if generated_bill is not None:
        db.refresh(generated_bill)

    invoice_by_id = {invoice.id: invoice} if invoice is not None else {}
    return _build_payment_response(
        payment=payment,
        org_name_by_id={organization.id: organization.name},
        invoice_by_id=invoice_by_id,
    )


@router.put(
    "/organization-credit-allocations/{allocation_id}",
    response_model=OrganizationCreditAllocationResponse,
)
async def update_organization_credit_allocation(
    allocation_id: int,
    payload: OrganizationCreditAllocationUpdateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    row = (
        db.query(OrganizationCreditAllocation)
        .filter(OrganizationCreditAllocation.id == allocation_id)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=404, detail="Organization credit allocation not found"
        )

    previous_payload = {
        "quantity": row.quantity,
        "credits_per_unit": row.credits_per_unit,
        "allocated_credits": row.allocated_credits,
        "is_active": row.is_active,
    }

    if payload.quantity is not None:
        row.quantity = payload.quantity
    if payload.credits_per_unit is not None:
        row.credits_per_unit = payload.credits_per_unit
    if payload.is_active is not None:
        row.is_active = payload.is_active

    if payload.allocated_credits is not None:
        row.allocated_credits = float(payload.allocated_credits)
    elif payload.quantity is not None or payload.credits_per_unit is not None:
        row.allocated_credits = float((row.quantity or 0) * (row.credits_per_unit or 0))

    new_payload = {
        "quantity": row.quantity,
        "credits_per_unit": row.credits_per_unit,
        "allocated_credits": row.allocated_credits,
        "is_active": row.is_active,
    }
    allocation_changed = _json_dump_stable(previous_payload) != _json_dump_stable(
        new_payload
    )
    if allocation_changed:
        _create_credit_change_log(
            db=db,
            organization_id=row.organization_id,
            price_matrix_item_id=row.price_matrix_item_id,
            change_type="allocation_update",
            description="Allocation updated through row editor",
            previous_payload=previous_payload,
            new_payload=new_payload,
        )
        profile = (
            db.query(OrganizationCreditProfile)
            .filter(OrganizationCreditProfile.organization_id == row.organization_id)
            .first()
        )
        _auto_generate_invoice_for_org_change(
            db=db,
            organization_id=row.organization_id,
            profile=profile,
            reason=f"Auto-generated from allocation row update (row_id={row.id})",
        )

    db.commit()
    db.refresh(row)

    organization = (
        db.query(Organization).filter(Organization.id == row.organization_id).first()
    )
    matrix_item = (
        db.query(PriceMatrixItem)
        .filter(PriceMatrixItem.id == row.price_matrix_item_id)
        .first()
    )
    return _build_org_credit_allocation_response(
        allocation=row,
        org_name_by_id={
            row.organization_id: (
                organization.name if organization else f"Org #{row.organization_id}"
            )
        },
        matrix_item_by_id=(
            {row.price_matrix_item_id: matrix_item} if matrix_item else {}
        ),
    )


@router.delete("/organization-credit-allocations/{allocation_id}")
async def delete_organization_credit_allocation(
    allocation_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    row = (
        db.query(OrganizationCreditAllocation)
        .filter(OrganizationCreditAllocation.id == allocation_id)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=404, detail="Organization credit allocation not found"
        )

    previous_payload = {
        "quantity": row.quantity,
        "credits_per_unit": row.credits_per_unit,
        "allocated_credits": row.allocated_credits,
        "is_active": row.is_active,
    }
    was_active = bool(row.is_active)
    row.is_active = False
    if was_active:
        _create_credit_change_log(
            db=db,
            organization_id=row.organization_id,
            price_matrix_item_id=row.price_matrix_item_id,
            change_type="allocation_deactivate",
            description="Allocation row deactivated",
            previous_payload=previous_payload,
            new_payload={"is_active": False},
        )
        profile = (
            db.query(OrganizationCreditProfile)
            .filter(OrganizationCreditProfile.organization_id == row.organization_id)
            .first()
        )
        _auto_generate_invoice_for_org_change(
            db=db,
            organization_id=row.organization_id,
            profile=profile,
            reason=f"Auto-generated from allocation row deactivation (row_id={row.id})",
        )
    db.commit()
    return {"success": True, "deleted_allocation_id": allocation_id}


@router.post("/price-matrix/estimate", response_model=PriceMatrixEstimateResponse)
async def estimate_price_matrix_credits(
    payload: PriceMatrixEstimateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return _calculate_price_matrix_estimate(db, payload)


@router.post(
    "/credit-estimator/share", response_model=CreditEstimatorShareCreateResponse
)
async def create_credit_estimator_share(
    payload: CreditEstimatorShareCreateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    estimate = _calculate_price_matrix_estimate(
        db,
        PriceMatrixEstimateRequest(
            lines=payload.lines,
            buffer_percent=payload.buffer_percent,
            discount_percent=payload.discount_percent,
        ),
    )

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=payload.valid_for_hours)
    token = secrets.token_urlsafe(32)

    share = CreditEstimatorShare(
        token=token,
        company_name=payload.company_name.strip(),
        created_by_superadmin_id=superadmin.id,
        input_json=json.dumps(
            {
                "lines": [line.model_dump() for line in payload.lines],
                "buffer_percent": payload.buffer_percent,
                "discount_percent": payload.discount_percent,
            }
        ),
        estimate_json=json.dumps(estimate.model_dump()),
        expires_at=expires_at,
        is_active=True,
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    return _build_credit_share_create_response(share, estimate, payload.valid_for_hours)


@router.get(
    "/credit-estimator/results",
    response_model=List[CreditEstimatorShareListItemResponse],
)
async def list_credit_estimator_results(
    company_name: Optional[str] = None,
    status_filter: str = "all",
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    query = (
        db.query(CreditEstimatorShare)
        .filter(CreditEstimatorShare.is_active == True)
        .order_by(
            CreditEstimatorShare.created_at.desc(), CreditEstimatorShare.id.desc()
        )
    )

    if company_name and company_name.strip():
        query = query.filter(
            CreditEstimatorShare.company_name.ilike(f"%{company_name.strip()}%")
        )

    rows = query.all()
    now = datetime.now(timezone.utc)

    if status_filter == "active":
        rows = [row for row in rows if _to_utc(row.expires_at) > now and row.is_active]
    elif status_filter == "expired":
        rows = [
            row for row in rows if _to_utc(row.expires_at) <= now or not row.is_active
        ]

    return [_build_credit_share_list_item_response(row) for row in rows]


@router.get(
    "/credit-estimator/results/{result_id}",
    response_model=CreditEstimatorShareListItemResponse,
)
async def get_credit_estimator_result(
    result_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = (
        db.query(CreditEstimatorShare)
        .filter(CreditEstimatorShare.id == result_id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    return _build_credit_share_list_item_response(share)


@router.put(
    "/credit-estimator/results/{result_id}",
    response_model=CreditEstimatorShareCreateResponse,
)
async def update_credit_estimator_result(
    result_id: int,
    payload: CreditEstimatorShareUpdateRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = (
        db.query(CreditEstimatorShare)
        .filter(CreditEstimatorShare.id == result_id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    existing_input = _parse_input_payload(share.input_json)
    next_lines = payload.lines if payload.lines is not None else existing_input.lines
    next_buffer = (
        payload.buffer_percent
        if payload.buffer_percent is not None
        else existing_input.buffer_percent
    )
    next_discount = (
        payload.discount_percent
        if payload.discount_percent is not None
        else existing_input.discount_percent
    )
    next_company = (
        payload.company_name.strip()
        if payload.company_name is not None
        else share.company_name
    )

    recompute_payload = PriceMatrixEstimateRequest(
        lines=next_lines,
        buffer_percent=next_buffer,
        discount_percent=next_discount,
    )
    estimate = _calculate_price_matrix_estimate(db, recompute_payload)

    share.company_name = next_company
    share.input_json = json.dumps(
        {
            "lines": [line.model_dump() for line in recompute_payload.lines],
            "buffer_percent": recompute_payload.buffer_percent,
            "discount_percent": recompute_payload.discount_percent,
        }
    )
    share.estimate_json = json.dumps(estimate.model_dump())
    if payload.valid_for_hours is not None:
        share.expires_at = datetime.now(timezone.utc) + timedelta(
            hours=payload.valid_for_hours
        )
        expires_in_hours = payload.valid_for_hours
    else:
        expires_in_hours = max(
            1,
            int(
                (_to_utc(share.expires_at) - datetime.now(timezone.utc)).total_seconds()
                // 3600
            ),
        )

    db.commit()
    db.refresh(share)
    return _build_credit_share_create_response(share, estimate, expires_in_hours)


@router.post(
    "/credit-estimator/share/{token}/extend",
    response_model=CreditEstimatorShareCreateResponse,
)
async def extend_credit_estimator_share(
    token: str,
    payload: CreditEstimatorShareExtendRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = _load_credit_estimate_share(
        db, token, enforce_active=True, enforce_not_expired=False
    )
    now = datetime.now(timezone.utc)
    current_expiry = _to_utc(share.expires_at)
    baseline = current_expiry if current_expiry > now else now
    share.expires_at = baseline + timedelta(hours=payload.extra_hours)
    db.commit()
    db.refresh(share)

    estimate = _parse_estimate_payload(share.estimate_json)
    return _build_credit_share_create_response(share, estimate, payload.extra_hours)


@router.post(
    "/credit-estimator/results/{result_id}/extend",
    response_model=CreditEstimatorShareCreateResponse,
)
async def extend_credit_estimator_result(
    result_id: int,
    payload: CreditEstimatorShareExtendRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = (
        db.query(CreditEstimatorShare)
        .filter(CreditEstimatorShare.id == result_id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    now = datetime.now(timezone.utc)
    current_expiry = _to_utc(share.expires_at)
    baseline = current_expiry if current_expiry > now else now
    share.expires_at = baseline + timedelta(hours=payload.extra_hours)
    db.commit()
    db.refresh(share)
    estimate = _parse_estimate_payload(share.estimate_json)
    return _build_credit_share_create_response(share, estimate, payload.extra_hours)


@router.get(
    "/credit-estimator/share/{token}", response_model=CreditEstimatorSharePublicResponse
)
async def get_shared_credit_estimator_result(
    token: str,
    db: Session = Depends(get_db),
):
    share = _load_credit_estimate_share(
        db, token, enforce_active=True, enforce_not_expired=True
    )
    estimate = _parse_estimate_payload(share.estimate_json)
    created_at = (
        _to_utc(share.created_at) if share.created_at else datetime.now(timezone.utc)
    )
    return CreditEstimatorSharePublicResponse(
        id=share.id,
        company_name=share.company_name,
        token=share.token,
        estimate=estimate,
        created_at=created_at,
        expires_at=_to_utc(share.expires_at),
    )


@router.post("/credit-estimator/share/{token}/email")
async def send_credit_estimator_share_via_email(
    token: str,
    payload: CreditEstimatorShareEmailRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
    settings: OrganizationSettings = Depends(get_settings),
):
    _load_credit_estimate_share(
        db, token, enforce_active=True, enforce_not_expired=True
    )
    body = (payload.body or "").strip()
    subject = (payload.subject or "").strip() or "Credit Estimate from Zentrixel"
    if not body:
        raise HTTPException(status_code=400, detail="Email body cannot be empty")

    success, error_message = send_widget_test_link_email(
        recipient_email=str(payload.to_email),
        subject=subject,
        message_body=body,
        settings=settings,
    )
    if not success:
        raise HTTPException(
            status_code=400, detail=error_message or "Failed to send email"
        )

    return {"message": "Credit estimate share email sent successfully"}


@router.post("/credit-estimator/results/{result_id}/email")
async def send_credit_estimator_result_via_email(
    result_id: int,
    payload: CreditEstimatorShareEmailRequest,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
    settings: OrganizationSettings = Depends(get_settings),
):
    share = (
        db.query(CreditEstimatorShare)
        .filter(CreditEstimatorShare.id == result_id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    now = datetime.now(timezone.utc)
    if _to_utc(share.expires_at) <= now:
        raise HTTPException(status_code=401, detail="Shared estimate link has expired")

    body = (payload.body or "").strip()
    subject = (payload.subject or "").strip() or "Credit Estimate from Zentrixel"
    if not body:
        raise HTTPException(status_code=400, detail="Email body cannot be empty")

    success, error_message = send_widget_test_link_email(
        recipient_email=str(payload.to_email),
        subject=subject,
        message_body=body,
        settings=settings,
    )
    if not success:
        raise HTTPException(
            status_code=400, detail=error_message or "Failed to send email"
        )

    return {"message": "Credit estimate share email sent successfully"}


@router.delete("/credit-estimator/results/{result_id}")
async def delete_credit_estimator_result(
    result_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    share = (
        db.query(CreditEstimatorShare)
        .filter(
            CreditEstimatorShare.id == result_id,
            CreditEstimatorShare.is_active == True,
        )
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Credit estimator result not found")

    # Soft-delete the record and expire the link immediately.
    share.is_active = False
    share.expires_at = datetime.now(timezone.utc)
    db.commit()

    return {"success": True, "deleted_result_id": result_id}


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    blocking_tables: List[str] = []
    for table_name in ORG_DELETE_BLOCKING_TABLES:
        if not _table_exists(db, table_name):
            continue
        row_count = db.execute(
            text(f"SELECT COUNT(1) FROM {table_name} WHERE organization_id = :org_id"),
            {"org_id": org_id},
        ).scalar()
        if int(row_count or 0) > 0:
            blocking_tables.append(table_name)

    if blocking_tables:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete organization because related data exists in: "
                + ", ".join(blocking_tables[:6])
                + (" ..." if len(blocking_tables) > 6 else "")
            ),
        )

    try:
        for table_name in ORG_DELETE_CLEANUP_TABLES:
            if not _table_exists(db, table_name):
                continue
            db.execute(
                text(f"DELETE FROM {table_name} WHERE organization_id = :org_id"),
                {"org_id": org_id},
            )

        db.delete(org)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Failed to delete organization due to related records",
        )

    return {"success": True, "deleted_organization_id": org_id}


@router.get("/analytics/overview", response_model=SuperAdminOverviewResponse)
async def superadmin_analytics_overview(
    db: Session = Depends(get_db), superadmin: SuperAdmin = Depends(require_superadmin)
):
    orgs = db.query(Organization).all()
    total_orgs = len(orgs)

    total_conversations = 0
    total_tokens = 0
    total_leads = 0
    total_documents = 0
    total_crawl_pages = 0

    for org in orgs:
        usage = (
            db.query(OrganizationSubscriptionUsage)
            .filter(OrganizationSubscriptionUsage.organization_id == org.id)
            .order_by(OrganizationSubscriptionUsage.period_start.desc())
            .first()
        )
        if not usage:
            continue
        total_conversations += usage.conversations_count
        total_tokens += usage.tokens_used
        total_leads += usage.leads_count
        total_documents += usage.documents_count
        total_crawl_pages += usage.crawl_pages_count

    return SuperAdminOverviewResponse(
        total_organizations=total_orgs,
        total_conversations=total_conversations,
        total_tokens=total_tokens,
        total_leads=total_leads,
        total_documents=total_documents,
        total_crawl_pages=total_crawl_pages,
    )


@router.get("/analytics/org/{org_id}")
async def superadmin_organization_analytics(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    limits = get_or_create_limits(db, org_id)
    usage = (
        db.query(OrganizationSubscriptionUsage)
        .filter(OrganizationSubscriptionUsage.organization_id == org_id)
        .order_by(OrganizationSubscriptionUsage.period_start.desc())
        .first()
    )

    return {
        "organization": {
            "id": org.id,
            "name": org.name,
            "description": org.description,
        },
        "limits": limits,
        "usage": usage,
    }


@router.post("/outcomes/process")
async def run_outcome_processing_now(
    payload: dict = Body(None),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    """Admin endpoint to run outcome processing on-demand.

    Optional JSON payload: {"batch_size": int, "max_batches": int}
    """
    batch_size = (
        int(payload.get("batch_size"))
        if payload and payload.get("batch_size")
        else settings.OUTCOME_DAEMON_BATCH_SIZE
    )
    max_batches = (
        int(payload.get("max_batches"))
        if payload and payload.get("max_batches")
        else settings.OUTCOME_DAEMON_MAX_BATCHES
    )

    processed, failed = run_outcome_processing_batches(
        batch_size=batch_size, max_batches=max_batches
    )
    return {"processed": processed, "failed": failed}


@router.get("/analytics/by-org")
async def superadmin_analytics_by_org(
    db: Session = Depends(get_db), superadmin: SuperAdmin = Depends(require_superadmin)
):
    orgs = db.query(Organization).all()
    data = []

    for org in orgs:
        usage = (
            db.query(OrganizationSubscriptionUsage)
            .filter(OrganizationSubscriptionUsage.organization_id == org.id)
            .order_by(OrganizationSubscriptionUsage.period_start.desc())
            .first()
        )
        data.append(
            {
                "organization": {
                    "id": org.id,
                    "name": org.name,
                    "description": org.description,
                },
                "usage": usage,
            }
        )

    return data


### Organization Calling No
@router.get("/org/{org_id}/calling-numbers")
def get_calling_numbers(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return (
        db.query(OrganizationCallingNumber)
        .filter(OrganizationCallingNumber.organization_id == org_id)
        .all()
    )


@router.post("/org/{org_id}/calling-number")
def create_calling_number(
    org_id: int,
    payload: CallingNumberCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    obj = OrganizationCallingNumber(
        organization_id=org_id, calling_number=payload.calling_number, type=payload.type
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return obj


@router.put("/org/calling-number/{id}")
def update_calling_number(
    id: int,
    payload: CallingNumberUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    obj = db.query(OrganizationCallingNumber).get(id)

    obj.calling_number = payload.calling_number
    obj.type = payload.type

    db.commit()
    return obj


### Master Channel
@router.get("/master/channels")
def get_master_channels(
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return db.query(Channel).filter(Channel.is_active == True).all()


### Organization Channel
@router.get("/org/{org_id}/channels")
def get_channels(
    org_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    result = (
        db.query(
            OrganizationChannel.id.label("id"),
            Channel.id.label("channel_id"),
            Channel.name.label("name"),
        )
        .join(Channel, OrganizationChannel.channel_id == Channel.id)
        .filter(OrganizationChannel.organization_id == org_id)
        .all()
    )

    return [
        {
            "id": row.id,
            "channel_id": row.channel_id,
            "name": row.name,
        }
        for row in result
    ]


@router.post("/org/{org_id}/channel")
def create_org_channel(
    org_id: int,
    payload: OrganizationChannelCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    # Optional: prevent duplicate
    existing = (
        db.query(OrganizationChannel)
        .filter_by(organization_id=org_id, channel_id=payload.channel_id)
        .first()
    )

    print("existing", existing)

    if existing:
        raise HTTPException(
            status_code=400, detail="Channel already exists for this organization"
        )

    obj = OrganizationChannel(organization_id=org_id, channel_id=payload.channel_id)

    print("Obj", obj)

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return obj


@router.put("/org/channel/{id}")
def update_org_channel(
    id: int,
    payload: OrganizationChannelUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    obj = db.query(OrganizationChannel).get(id)

    if not obj:
        raise HTTPException(status_code=404, detail="OrganizationChannel not found")

    # 🔥 Check duplicate (exclude current record)
    duplicate = (
        db.query(OrganizationChannel)
        .filter(
            OrganizationChannel.organization_id == obj.organization_id,
            OrganizationChannel.channel_id == payload.channel_id,
            OrganizationChannel.id != id,
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=400, detail="Channel already exists for this organization"
        )

    obj.channel_id = payload.channel_id

    db.commit()
    return obj


@router.delete("/org/channel/{id}")
def delete_org_channel(id: int, db: Session = Depends(get_db)):
    obj = db.query(OrganizationChannel).get(id)

    db.delete(obj)
    db.commit()

    return {"success": True}


@router.patch("/org/calling-number/{id}/active")
def toggle_active(id: int, db: Session = Depends(get_db)):
    obj = db.query(OrganizationCallingNumber).get(id)

    obj.is_active = not obj.is_active

    db.commit()

    return obj


@router.patch("/org/calling-number/{id}/default")
def set_default(id: int, db: Session = Depends(get_db)):
    obj = db.query(OrganizationCallingNumber).get(id)

    # remove old default
    db.query(OrganizationCallingNumber).filter(
        OrganizationCallingNumber.organization_id == obj.organization_id
    ).update({"is_default": False})

    obj.is_default = True

    db.commit()

    return obj


@router.delete("/org/calling-number/{id}")
def delete_calling_number(id: int, db: Session = Depends(get_db)):
    obj = db.query(OrganizationCallingNumber).get(id)

    db.delete(obj)
    db.commit()

    return {"success": True}


### REPORTS ####


@router.get("/org/organization-calling-report")
def organization_calling_report(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):

    query = db.query(Organization)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(Organization.name.ilike(search_term))
    # query = query.filter(Organization.name.contains(search))

    total = query.count()

    organizations = query.offset(skip).limit(limit).all()

    report = []

    for org in organizations:
        agent_count = (
            db.query(CallingAgent)
            .filter(
                CallingAgent.organization_id == org.id,
                or_(
                    CallingAgent.is_deleted == False, CallingAgent.is_deleted.is_(None)
                ),
            )
            .count()
        )

        campaign_count = (
            db.query(CallCampaign)
            .filter(
                CallCampaign.organization_id == org.id, CallCampaign.is_deleted == False
            )
            .count()
        )

        call_count = db.query(CallLog).filter(CallLog.organization_id == org.id).count()

        agents = (
            db.query(CallingAgent)
            .filter(
                CallingAgent.organization_id == org.id, CallingAgent.is_deleted == False
            )
            .all()
        )

        campaigns = (
            db.query(CallCampaign)
            .filter(
                CallCampaign.organization_id == org.id, CallCampaign.is_deleted == False
            )
            .all()
        )

        report.append(
            {
                "organization_id": org.id,
                "organization_name": org.name,
                "agents_created": agent_count,
                "campaign_created": campaign_count,
                "calls_done": call_count,
                "agents": [
                    {
                        "name": a.name,
                        "external_agent_name": a.external_agent_name,
                        "external_agent_id": a.external_agent_id,
                    }
                    for a in agents
                ],
                "campaigns": [
                    {
                        "name": c.name,
                        "external_campaign_name": c.external_campaign_name,
                        "external_campaign_id": c.external_campaign_id,
                    }
                    for c in campaigns
                ],
            }
        )

    return {"items": report, "total": total, "skip": skip, "limit": limit}


@router.get("/org-credit-usage")
async def get_admin_org_credit_current_month_summary(
    billing_period: Optional[str] = Query(default=None),
    organization_id: Optional[int] = Query(default=None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):

    org_query = db.query(Organization)

    if organization_id:
        org_query = org_query.filter(Organization.id == organization_id)

    if search:
        search_term = f"%{search.strip()}%"
        org_query = org_query.filter(Organization.name.ilike(search_term))

    total = org_query.count()

    all_orgs = org_query.offset(skip).limit(limit).all()

    org_list = []

    for org in all_orgs:
        payload = org_credit_billing_service.get_admin_month_summary(
            db=db,
            organization_id=org.id,
            billing_period=billing_period,
        )
        org_list.append(OrgCreditAdminMonthSummaryResponse(**payload))

    return {"items": org_list, "total": total, "skip": skip, "limit": limit}
