import asyncio
import calendar
import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
from numpy import extract
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.organization_settings import OrganizationSettings
from app.models import (
    CreditEstimatorShare,
    Organization,
    OrgCredit,
    OrgCreditBalance,
    OrgCreditInvoice,
    OrgCreditPayment,
    User,
    UserRole,
)
from app.services.email_service import send_campaign_email
from app.models.user import OrganizationStatus

logger = logging.getLogger(__name__)


def _month_end(day: date) -> date:
    last_day = calendar.monthrange(day.year, day.month)[1]
    return date(day.year, day.month, last_day)


def _next_month_start(day: date) -> date:
    if day.month == 12:
        return date(day.year + 1, 1, 1)
    return date(day.year, day.month + 1, 1)


def _billing_period(day: date) -> str:
    return day.strftime("%Y-%m")


def _billing_cycle_period(next_start: date, next_end: date) -> str:
    return f"{next_start.strftime('%d %b %Y')} - " f"{next_end.strftime('%d %b %Y')}"


def _next_cycle_dates(current_end_date):
    next_start = current_end_date + timedelta(days=1)
    next_end = next_start + relativedelta(months=1) - timedelta(days=1)
    return next_start, next_end


def _normalize_billing_period(period: str) -> str:
    raw = (period or "").strip()
    if len(raw) != 7 or raw[4] != "-":
        raise HTTPException(status_code=400, detail="billing_period must be YYYY-MM")
    year_part, month_part = raw.split("-")
    if not (year_part.isdigit() and month_part.isdigit()):
        raise HTTPException(status_code=400, detail="billing_period must be YYYY-MM")
    year = int(year_part)
    month = int(month_part)
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=400, detail="billing_period month must be between 01 and 12"
        )
    return f"{year:04d}-{month:02d}"


def _shift_billing_period(period: str, month_delta: int) -> str:
    normalized = _normalize_billing_period(period)
    year = int(normalized[:4])
    month = int(normalized[5:7])
    index = (year * 12 + (month - 1)) + month_delta
    if index < 0:
        raise HTTPException(
            status_code=400, detail="billing_period is out of supported range"
        )
    shifted_year = index // 12
    shifted_month = (index % 12) + 1
    return f"{shifted_year:04d}-{shifted_month:02d}"


def _raw_remaining_credit(total_credit: float, used_credit: float) -> float:
    return _round2(max(0, (total_credit or 0) - (used_credit or 0)))


def _parse_numeric(value: object) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return float(stripped)
        except Exception:
            return None
    return None


def _clean_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _extract_total_credit_and_payable_from_estimator(
    share: CreditEstimatorShare,
) -> Tuple[float, float, str]:
    try:
        estimate_payload = json.loads(share.estimate_json or "{}")
    except Exception:
        estimate_payload = {}

    total_credit_keys = [
        # "After Buffer" credit preference.
        "recommended_credits",
        "recommended_credits_ceiling",
        "subtotal_credits",
        "total_credit",
    ]
    payable_keys = [
        # Amount payable should be final amount after discount.
        "final_recommended_credits",
        "final_recommended_credits_ceiling",
        "recommended_credits",
        "recommended_credits_ceiling",
    ]

    total_credit: Optional[float] = None
    payable_amount: Optional[float] = None

    for key in total_credit_keys:
        numeric = _parse_numeric(estimate_payload.get(key))
        if numeric is not None and numeric > 0:
            total_credit = round(numeric, 2)
            break

    for key in payable_keys:
        numeric = _parse_numeric(estimate_payload.get(key))
        if numeric is not None and numeric > 0:
            payable_amount = round(numeric, 2)
            break

    breakdown = estimate_payload.get("breakdown")
    if total_credit is None and isinstance(breakdown, list):
        total = 0.0
        for line in breakdown:
            if not isinstance(line, dict):
                continue
            numeric = _parse_numeric(line.get("estimated_credits"))
            if numeric is not None and numeric > 0:
                total += numeric
        if total > 0:
            total_credit = round(total, 2)

    if total_credit is None:
        raise HTTPException(
            status_code=400,
            detail="Estimator does not contain a valid positive after-buffer credit value",
        )

    if payable_amount is None:
        payable_amount = total_credit

    estimator_name = (share.company_name or "").strip() or f"Estimator #{share.id}"
    return total_credit, payable_amount, estimator_name


def _get_organization_or_404(db: Session, organization_id: int) -> Organization:
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def _get_organization_admin_email(db: Session, organization_id: int) -> Optional[str]:
    admin_user = (
        db.query(User)
        .filter(
            User.organization_id == organization_id,
            User.role == UserRole.ADMIN,
        )
        .order_by(User.id.asc())
        .first()
    )
    if admin_user and admin_user.email:
        return str(admin_user.email).strip()

    any_user = (
        db.query(User)
        .filter(
            User.organization_id == organization_id,
        )
        .order_by(User.id.asc())
        .first()
    )
    if any_user and any_user.email:
        return str(any_user.email).strip()
    return None


def _get_estimator_or_404(db: Session, estimator_id: int) -> CreditEstimatorShare:
    estimator = (
        db.query(CreditEstimatorShare)
        .filter(
            CreditEstimatorShare.id == estimator_id,
            CreditEstimatorShare.is_active == True,
        )
        .first()
    )
    if not estimator:
        raise HTTPException(status_code=404, detail="Estimator not found")
    return estimator


def _get_org_credit_or_404(db: Session, org_credit_id: int) -> OrgCredit:
    row = db.query(OrgCredit).filter(OrgCredit.id == org_credit_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Org credit entry not found")
    return row


def _get_invoice_or_404(db: Session, invoice_id: int) -> OrgCreditInvoice:
    row = db.query(OrgCreditInvoice).filter(OrgCreditInvoice.id == invoice_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return row


def _round2(value: float) -> float:
    return round(float(value), 2)


def _resolve_invoice_amount_for_org_credit(db: Session, org_credit: OrgCredit) -> float:
    if org_credit.is_topup:
        return _round2(org_credit.topup_credit or org_credit.total_credit or 0)

    estimator = _get_estimator_or_404(db, org_credit.estimator_id)
    _, payable_amount, _ = _extract_total_credit_and_payable_from_estimator(estimator)
    return _round2(payable_amount)


def _create_invoice_for_credit(
    db: Session,
    org_credit: OrgCredit,
    invoice_date: Optional[date] = None,
    notes: Optional[str] = None,
    payment_done_flag: bool = False,
    reference_invoice_id: Optional[int] = None,
    invoice_amount_override: Optional[float] = None,
) -> OrgCreditInvoice:
    invoice_amount = _round2(
        invoice_amount_override
        if invoice_amount_override is not None
        else _resolve_invoice_amount_for_org_credit(db, org_credit)
    )
    invoice = OrgCreditInvoice(
        organization_id=org_credit.organization_id,
        org_credit_id=org_credit.id,
        reference_invoice_id=reference_invoice_id,
        total_credit=_round2(org_credit.total_credit),
        invoice_amount=invoice_amount,
        paid_amount=invoice_amount if payment_done_flag else 0.0,
        billing_month=org_credit.billing_month,
        invoice_date=invoice_date or datetime.now(timezone.utc).date(),
        payment_done_flag=payment_done_flag,
        notes=notes,
    )
    db.add(invoice)
    db.flush()
    return invoice


def _recompute_balance(balance: OrgCreditBalance) -> None:
    balance.total_credit = _round2(balance.total_credit or 0)
    balance.used_credit = _round2(balance.used_credit or 0)
    balance.remaining_credit = _round2(
        (balance.total_credit or 0) - (balance.used_credit or 0)
    )


def _get_or_create_balance(
    db: Session, organization_id: int, billing_period: str
) -> OrgCreditBalance:
    balance = (
        db.query(OrgCreditBalance)
        .filter(
            OrgCreditBalance.organization_id == organization_id,
            OrgCreditBalance.billing_period == billing_period,
        )
        .first()
    )
    if balance:
        return balance

    org_credit = (
        db.query(OrgCredit)
        .filter(
            OrgCredit.organization_id == organization_id,
            OrgCredit.billing_month == billing_period,
            OrgCredit.is_topup == False,
        )
        .first()
    )

    if not org_credit:
        raise HTTPException(
            status_code=404,
            detail="Org credit not found for billing period",
        )

    balance = OrgCreditBalance(
        organization_id=organization_id,
        billing_period=billing_period,
        billing_start_date=org_credit.billing_start_date if org_credit else None,
        billing_end_date=org_credit.billing_end_date if org_credit else None,
        total_credit=0,
        used_credit=0,
        remaining_credit=0,
    )
    db.add(balance)
    db.flush()
    return balance


def _credited_amount_for_period(
    db: Session, organization_id: int, billing_period: str
) -> float:
    invoices = (
        db.query(OrgCreditInvoice)
        .filter(
            OrgCreditInvoice.organization_id == organization_id,
            OrgCreditInvoice.billing_month == billing_period,
        )
        .all()
    )

    credited_total = 0.0
    for invoice in invoices:
        payment_rows = (
            db.query(OrgCreditPayment)
            .filter(
                OrgCreditPayment.invoice_id == invoice.id,
            )
            .all()
        )
        if payment_rows:
            credited_total += sum(float(row.actual_credit or 0) for row in payment_rows)
        elif invoice.payment_done_flag:
            credited_total += float(invoice.total_credit or 0)

    return _round2(credited_total)


def _recalculate_balance_for_period(
    db: Session, organization_id: int, billing_period: str
) -> OrgCreditBalance:
    balance = _get_or_create_balance(db, organization_id, billing_period)
    credited_total = _credited_amount_for_period(db, organization_id, billing_period)
    balance.total_credit = credited_total
    _recompute_balance(balance)
    db.flush()
    return balance


def _refresh_org_credit_payment_status(db: Session, org_credit_id: int) -> None:
    row = _get_org_credit_or_404(db, org_credit_id)
    has_open_invoice = (
        db.query(OrgCreditInvoice.id)
        .filter(
            OrgCreditInvoice.org_credit_id == org_credit_id,
            OrgCreditInvoice.payment_done_flag == False,
        )
        .first()
    )

    if has_open_invoice:
        row.payment_status = "paid"
    db.flush()


def create_org_credit_entry(
    db: Session,
    organization_id: int,
    estimator_id: Optional[int] = None,
    credits: Optional[float] = None,
    billing_cycle: str = "monthly",
    payment_status: str = "unpaid",
    billing_start_date: Optional[date] = None,
    notes: Optional[str] = None,
    is_auto_generated: bool = False,
) -> Tuple[OrgCredit, OrgCreditInvoice]:
    if billing_cycle.lower() != "monthly":
        raise HTTPException(
            status_code=400, detail="Only monthly billing_cycle is supported"
        )
    if payment_status not in {"paid", "unpaid"}:
        raise HTTPException(
            status_code=400, detail="payment_status must be paid or unpaid"
        )

    if estimator_id is None and credits is None:
        raise HTTPException(
            status_code=400, detail="Either estimator or credits must be provided"
        )

    # Check organization status
    organization = (
        db.query(Organization)
        .filter(
            Organization.id == organization_id,
            or_(
                Organization.status == OrganizationStatus.ACTIVE,
                and_(
                    Organization.status == OrganizationStatus.TRIAL,
                    Organization.trial_end_date >= datetime.now(timezone.utc),
                ),
            ),
        )
        .first()
    )

    if not organization:
        raise HTTPException(
            status_code=400, detail="Organization not found or is not active"
        )

    _get_organization_or_404(db, organization_id)

    if estimator_id is not None:
        estimator = _get_estimator_or_404(db, estimator_id)
        total_credit, payable_amount, _ = (
            _extract_total_credit_and_payable_from_estimator(estimator)
        )
    else:
        total_credit = credits or 0
        payable_amount = credits or 0

    start = billing_start_date or datetime.now(timezone.utc).date()
    end = start + relativedelta(months=1) - timedelta(days=1)
    period = _billing_period(start)

    if not isinstance(start, date):
        start = start.date()

    duplicate = (
        db.query(OrgCredit)
        .filter(
            OrgCredit.organization_id == organization_id,
            OrgCredit.is_topup == False,
            # overlap check
            OrgCredit.billing_start_date <= end,
            OrgCredit.billing_end_date >= start,
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="A org credit entry already exists for this organization and billing period",
        )

    row = OrgCredit(
        organization_id=organization_id,
        estimator_id=estimator_id,
        parent_org_credit_id=None,
        total_credit=total_credit,
        billing_cycle="monthly",
        payment_status=payment_status,
        billing_start_date=start,
        billing_end_date=end,
        billing_month=period,
        is_topup=False,
        topup_credit=None,
        is_auto_generated=is_auto_generated,
        notes=notes,
    )
    db.add(row)
    db.flush()

    invoice = _create_invoice_for_credit(
        db=db,
        org_credit=row,
        payment_done_flag=(payment_status == "paid"),
        invoice_amount_override=payable_amount,
    )
    _recalculate_balance_for_period(db, row.organization_id, row.billing_month)

    db.commit()
    db.refresh(row)
    db.refresh(invoice)
    return row, invoice


def update_org_credit_entry(
    db: Session,
    org_credit_id: int,
    estimator_id: Optional[int] = None,
    credits: Optional[float] = None,
    billing_cycle: str = "monthly",
    payment_status: Optional[str] = None,
    billing_start_date: Optional[date] = None,
    notes: Optional[str] = None,
) -> Tuple[OrgCredit, OrgCreditInvoice]:

    row = db.query(OrgCredit).filter(OrgCredit.id == org_credit_id).first()

    if not row:
        raise HTTPException(status_code=404, detail="Org credit entry not found")

    if row.billing_cycle.lower() != "monthly":
        raise HTTPException(
            status_code=400,
            detail="Only monthly billing_cycle is supported",
        )

    if payment_status is not None and row.payment_status != "unpaid":
        raise HTTPException(
            status_code=400,
            detail="Only unpaid billing can be edited.",
        )

    if estimator_id is None and credits is None and row.estimator_id is None:
        raise HTTPException(
            status_code=400,
            detail="Either estimator or credits must be provided",
        )

    # Check organization status
    organization = (
        db.query(Organization)
        .filter(
            Organization.id == row.organization_id,
            or_(
                Organization.status == OrganizationStatus.ACTIVE,
                and_(
                    Organization.status == OrganizationStatus.TRIAL,
                    Organization.trial_end_date >= datetime.now(timezone.utc),
                ),
            ),
        )
        .first()
    )

    if not organization:
        raise HTTPException(
            status_code=400, detail="Organization not found or is not active"
        )

    payable_amount = None

    # estimator update
    if estimator_id is not None and credits is None:

        estimator = _get_estimator_or_404(db, estimator_id)

        total_credit, payable_amount, _ = (
            _extract_total_credit_and_payable_from_estimator(estimator)
        )

        row.estimator_id = estimator_id
        row.total_credit = total_credit

    # custom credits update
    elif credits is not None:

        row.estimator_id = None
        row.total_credit = credits

        payable_amount = credits

    # billing date update
    if billing_start_date is not None:

        end = _month_end(billing_start_date)
        period = _billing_period(billing_start_date)

        month_start = billing_start_date.replace(day=1)

        if billing_start_date.month == 12:
            next_month = billing_start_date.replace(
                year=billing_start_date.year + 1, month=1, day=1
            )
        else:
            next_month = billing_start_date.replace(
                month=billing_start_date.month + 1, day=1
            )

        if row.is_topup and row.billing_start_date != billing_start_date:
            raise HTTPException(
                status_code=400,
                detail="Billing start date cannot be updated for top-up entries",
            )

        if not row.is_topup and row.billing_start_date != billing_start_date:
            duplicate = (
                db.query(OrgCredit)
                .filter(
                    OrgCredit.organization_id == row.organization_id,
                    OrgCredit.billing_start_date >= month_start,
                    OrgCredit.billing_start_date < next_month,
                    OrgCredit.is_topup == False,
                    OrgCredit.id != row.id,
                )
                .first()
            )

            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "A org credit entry already exists for this "
                        "organization and billing period"
                    ),
                )

        row.billing_start_date = billing_start_date
        row.billing_end_date = end
        row.billing_month = period

    # payment status update
    if payment_status is not None:
        row.payment_status = payment_status

    # notes update
    if notes is not None:
        row.notes = notes

    invoice = (
        db.query(OrgCreditInvoice)
        .filter(OrgCreditInvoice.org_credit_id == row.id)
        .first()
    )

    if invoice:

        if payable_amount is not None:
            invoice.total_credit = row.total_credit
            invoice.invoice_amount = payable_amount

        invoice.payment_done_flag = row.payment_status == "paid"

    _recalculate_balance_for_period(
        db,
        row.organization_id,
        row.billing_month,
    )

    db.commit()
    db.refresh(row)

    if invoice:
        db.refresh(invoice)

    return row, invoice


def list_org_credits(
    db: Session,
    organization_id: Optional[int] = None,
) -> List[OrgCredit]:
    query = db.query(OrgCredit)
    if organization_id is not None:
        query = query.filter(OrgCredit.organization_id == organization_id)
    return query.order_by(
        OrgCredit.billing_start_date.desc(), OrgCredit.id.desc()
    ).all()


def delete_org_credit_entry(db: Session, org_credit_id: int) -> int:
    row = _get_org_credit_or_404(db, org_credit_id)

    invoice_rows = (
        db.query(OrgCreditInvoice)
        .filter(OrgCreditInvoice.org_credit_id == row.id)
        .all()
    )
    invoice_ids = [invoice.id for invoice in invoice_rows]
    if invoice_ids:
        db.query(OrgCreditPayment).filter(
            OrgCreditPayment.invoice_id.in_(invoice_ids)
        ).delete(synchronize_session=False)
        db.query(OrgCreditInvoice).filter(OrgCreditInvoice.id.in_(invoice_ids)).delete(
            synchronize_session=False
        )

    period = row.billing_month
    organization_id = row.organization_id

    db.delete(row)
    db.flush()
    _recalculate_balance_for_period(db, organization_id, period)

    db.commit()
    return org_credit_id


def add_topup_credit(
    db: Session,
    org_credit_id: int,
    topup_credit: float,
    payment_status: str = "unpaid",
    notes: Optional[str] = None,
) -> Tuple[OrgCredit, OrgCreditInvoice]:
    if topup_credit <= 0:
        raise HTTPException(status_code=400, detail="topup_credit must be positive")
    if payment_status not in {"paid", "unpaid"}:
        raise HTTPException(
            status_code=400, detail="payment_status must be paid or unpaid"
        )

    parent = _get_org_credit_or_404(db, org_credit_id)

    row = OrgCredit(
        organization_id=parent.organization_id,
        estimator_id=parent.estimator_id,
        parent_org_credit_id=parent.id,
        total_credit=_round2(topup_credit),
        billing_cycle=parent.billing_cycle,
        payment_status=payment_status,
        billing_start_date=parent.billing_start_date,
        billing_end_date=parent.billing_end_date,
        billing_month=parent.billing_month,
        is_topup=True,
        topup_credit=_round2(topup_credit),
        is_auto_generated=False,
        notes=notes,
    )
    db.add(row)
    db.flush()

    invoice = _create_invoice_for_credit(
        db=db,
        org_credit=row,
        payment_done_flag=(payment_status == "paid"),
        notes="Top-up invoice",
    )

    _recalculate_balance_for_period(db, row.organization_id, row.billing_month)

    db.commit()
    db.refresh(row)
    db.refresh(invoice)
    return row, invoice


def generate_invoice(
    db: Session,
    org_credit_id: int,
    invoice_date: Optional[date] = None,
    notes: Optional[str] = None,
) -> OrgCreditInvoice:
    row = _get_org_credit_or_404(db, org_credit_id)

    existing = (
        db.query(OrgCreditInvoice)
        .filter(
            OrgCreditInvoice.org_credit_id == row.id,
            OrgCreditInvoice.reference_invoice_id.is_(None),
        )
        .first()
    )
    if existing:
        return existing

    invoice = _create_invoice_for_credit(
        db=db,
        org_credit=row,
        invoice_date=invoice_date,
        notes=notes,
        payment_done_flag=(row.payment_status == "paid"),
    )
    _recalculate_balance_for_period(db, row.organization_id, row.billing_month)
    db.commit()
    db.refresh(invoice)
    return invoice


def list_invoices(
    db: Session,
    organization_id: Optional[int] = None,
    org_credit_id: Optional[int] = None,
) -> List[OrgCreditInvoice]:
    query = db.query(OrgCreditInvoice)
    if organization_id is not None:
        query = query.filter(OrgCreditInvoice.organization_id == organization_id)
    if org_credit_id is not None:
        query = query.filter(OrgCreditInvoice.org_credit_id == org_credit_id)
    return query.order_by(
        OrgCreditInvoice.invoice_date.desc(), OrgCreditInvoice.id.desc()
    ).all()


def delete_invoice(db: Session, invoice_id: int) -> int:
    invoice = _get_invoice_or_404(db, invoice_id)

    db.query(OrgCreditPayment).filter(OrgCreditPayment.invoice_id == invoice.id).delete(
        synchronize_session=False
    )
    org_credit_id = invoice.org_credit_id
    organization_id = invoice.organization_id
    period = invoice.billing_month

    db.delete(invoice)
    db.flush()
    _refresh_org_credit_payment_status(db, org_credit_id)
    _recalculate_balance_for_period(db, organization_id, period)

    db.commit()
    return invoice_id


def mark_invoice_payment_status(
    db: Session,
    invoice_id: int,
    payment_done_flag: bool,
    payment_date: Optional[date] = None,
    payment_mode: Optional[str] = None,
    payment_reference: Optional[str] = None,
    payment_other_details: Optional[str] = None,
) -> OrgCreditInvoice:
    invoice = _get_invoice_or_404(db, invoice_id)

    if payment_done_flag:
        outstanding = _round2(
            (invoice.invoice_amount or 0) - (invoice.paid_amount or 0)
        )
        if outstanding > 0:
            payment_mode_clean = _clean_optional_text(payment_mode)
            payment_reference_clean = _clean_optional_text(payment_reference)
            payment_other_details_clean = _clean_optional_text(payment_other_details)

            if not payment_mode_clean:
                raise HTTPException(
                    status_code=400, detail="payment_mode is required for mark paid"
                )
            if not payment_reference_clean:
                raise HTTPException(
                    status_code=400,
                    detail="payment_reference is required for mark paid",
                )

            payment = OrgCreditPayment(
                organization_id=invoice.organization_id,
                invoice_id=invoice.id,
                full_partial="full",
                invoice_amount=_round2(invoice.invoice_amount or 0),
                actual_payment=outstanding,
                actual_credit=outstanding,
                payment_date=payment_date or datetime.now(timezone.utc).date(),
                payment_details=payment_other_details_clean,
                payment_mode=payment_mode_clean,
                payment_reference=payment_reference_clean,
                payment_other_details=payment_other_details_clean,
            )
            db.add(payment)

            invoice.paid_amount = _round2((invoice.paid_amount or 0) + outstanding)

        invoice.payment_done_flag = True
    else:
        invoice.payment_done_flag = False

    _refresh_org_credit_payment_status(db, invoice.org_credit_id)
    _recalculate_balance_for_period(db, invoice.organization_id, invoice.billing_month)
    db.commit()
    db.refresh(invoice)
    return invoice


def add_payment(
    db: Session,
    invoice_id: int,
    actual_payment: float,
    actual_credit: Optional[float] = None,
    payment_date: Optional[date] = None,
    payment_details: Optional[str] = None,
    payment_mode: Optional[str] = None,
    payment_reference: Optional[str] = None,
    payment_other_details: Optional[str] = None,
    partial_strategy: str = "keep_open",
) -> Tuple[OrgCreditPayment, OrgCreditInvoice, Optional[OrgCreditInvoice]]:
    if partial_strategy not in {"keep_open", "create_invoice", "full_payment"}:
        raise HTTPException(
            status_code=400,
            detail="partial_strategy must be keep_open, create_invoice, or full_payment",
        )

    invoice = _get_invoice_or_404(db, invoice_id)
    outstanding = _round2((invoice.invoice_amount or 0) - (invoice.paid_amount or 0))
    if outstanding <= 0 or invoice.payment_done_flag:
        raise HTTPException(status_code=400, detail="Invoice is already closed")
    if partial_strategy == "full_payment":
        actual_payment = outstanding
    elif actual_payment > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Payment exceeds outstanding amount ({outstanding})",
        )
    if actual_payment <= 0:
        raise HTTPException(status_code=400, detail="actual_payment must be positive")

    payment_mode_clean = _clean_optional_text(payment_mode)
    payment_reference_clean = _clean_optional_text(payment_reference)
    payment_other_details_clean = _clean_optional_text(payment_other_details)
    payment_details_clean = payment_other_details_clean or _clean_optional_text(
        payment_details
    )

    if not payment_mode_clean:
        raise HTTPException(status_code=400, detail="payment_mode is required")
    if not payment_reference_clean:
        raise HTTPException(status_code=400, detail="payment_reference is required")

    credit_to_apply = _round2(
        actual_credit if actual_credit is not None else actual_payment
    )
    if credit_to_apply <= 0:
        raise HTTPException(status_code=400, detail="actual_credit must be positive")

    full_partial = "full" if abs(actual_payment - outstanding) < 1e-9 else "partial"

    payment = OrgCreditPayment(
        organization_id=invoice.organization_id,
        invoice_id=invoice.id,
        full_partial=full_partial,
        invoice_amount=_round2(invoice.invoice_amount),
        actual_payment=_round2(actual_payment),
        actual_credit=credit_to_apply,
        payment_date=payment_date or datetime.now(timezone.utc).date(),
        payment_details=payment_details_clean,
        payment_mode=payment_mode_clean,
        payment_reference=payment_reference_clean,
        payment_other_details=payment_other_details_clean,
    )
    db.add(payment)

    invoice.paid_amount = _round2((invoice.paid_amount or 0) + actual_payment)
    new_invoice: Optional[OrgCreditInvoice] = None

    if full_partial == "full":
        invoice.payment_done_flag = True
    elif partial_strategy == "create_invoice":
        remaining = _round2(outstanding - actual_payment)
        invoice.payment_done_flag = True
        invoice.invoice_amount = _round2(invoice.paid_amount)
        invoice.total_credit = _round2(invoice.paid_amount)
        invoice.paid_amount = _round2(invoice.invoice_amount)

        if remaining > 0:
            org_credit = _get_org_credit_or_404(db, invoice.org_credit_id)
            new_invoice = _create_invoice_for_credit(
                db=db,
                org_credit=org_credit,
                invoice_date=payment.payment_date,
                notes=f"Remaining amount generated from invoice #{invoice.id}",
                payment_done_flag=False,
                reference_invoice_id=invoice.id,
                invoice_amount_override=remaining,
            )
            new_invoice.total_credit = remaining
    else:
        invoice.payment_done_flag = False

    _refresh_org_credit_payment_status(db, invoice.org_credit_id)
    _recalculate_balance_for_period(db, invoice.organization_id, invoice.billing_month)

    db.commit()
    db.refresh(payment)
    db.refresh(invoice)
    if new_invoice:
        db.refresh(new_invoice)
    return payment, invoice, new_invoice


def list_payments(
    db: Session,
    organization_id: Optional[int] = None,
    invoice_id: Optional[int] = None,
) -> List[OrgCreditPayment]:
    query = db.query(OrgCreditPayment)
    if organization_id is not None:
        query = query.filter(OrgCreditPayment.organization_id == organization_id)
    if invoice_id is not None:
        query = query.filter(OrgCreditPayment.invoice_id == invoice_id)
    return query.order_by(
        OrgCreditPayment.payment_date.desc(), OrgCreditPayment.id.desc()
    ).all()


def delete_payment(db: Session, payment_id: int) -> int:
    payment = (
        db.query(OrgCreditPayment).filter(OrgCreditPayment.id == payment_id).first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    invoice = _get_invoice_or_404(db, payment.invoice_id)
    invoice.paid_amount = _round2(
        max(0, (invoice.paid_amount or 0) - (payment.actual_payment or 0))
    )
    invoice.payment_done_flag = invoice.paid_amount >= _round2(
        invoice.invoice_amount or 0
    )

    db.delete(payment)
    db.flush()
    _refresh_org_credit_payment_status(db, invoice.org_credit_id)
    _recalculate_balance_for_period(db, invoice.organization_id, invoice.billing_month)

    db.commit()
    return payment_id


def get_available_credit(
    db: Session,
    organization_id: int,
    billing_period: Optional[str] = None,
) -> OrgCreditBalance:
    _get_organization_or_404(db, organization_id)
    period = _normalize_billing_period(
        billing_period or _billing_period(datetime.now(timezone.utc).date())
    )
    current_period = _billing_period(datetime.now(timezone.utc).date())

    balance = _get_or_create_balance(db, organization_id, period)
    _recompute_balance(balance)
    if period < current_period:
        balance.remaining_credit = 0
    db.commit()
    db.refresh(balance)
    return balance


def track_credit_usage(
    db: Session,
    organization_id: int,
    used_credit: float,
    billing_period: Optional[str] = None,
) -> OrgCreditBalance:
    if used_credit <= 0:
        raise HTTPException(status_code=400, detail="used_credit must be positive")

    _get_organization_or_404(db, organization_id)
    period = _normalize_billing_period(
        billing_period or _billing_period(datetime.now(timezone.utc).date())
    )
    current_period = _billing_period(datetime.now(timezone.utc).date())
    if period < current_period:
        raise HTTPException(
            status_code=400, detail="Cannot track usage for expired billing period"
        )

    balance = _get_or_create_balance(db, organization_id, period)
    balance.used_credit = _round2((balance.used_credit or 0) + used_credit)
    _recompute_balance(balance)

    db.commit()
    db.refresh(balance)
    return balance


def get_admin_month_summary(
    db: Session,
    organization_id: int,
    billing_period: Optional[str] = None,
) -> Dict[str, object]:
    organization = _get_organization_or_404(db, organization_id)
    period = _normalize_billing_period(
        billing_period or _billing_period(datetime.now(timezone.utc).date())
    )
    current_period = _billing_period(datetime.now(timezone.utc).date())

    balance = _recalculate_balance_for_period(db, organization_id, period)
    total_credit = _round2(balance.total_credit or 0)
    used_credit = _round2(balance.used_credit or 0)
    raw_remaining = _raw_remaining_credit(total_credit, used_credit)
    remaining_credit = 0.0 if period < current_period else raw_remaining

    previous_period = _shift_billing_period(period, -1)
    previous_balance = (
        db.query(OrgCreditBalance)
        .filter(
            OrgCreditBalance.organization_id == organization_id,
            OrgCreditBalance.billing_period == previous_period,
        )
        .first()
    )
    previous_lapsed = 0.0
    if previous_balance:
        prev_total = _round2(previous_balance.total_credit or 0)
        prev_used = _round2(previous_balance.used_credit or 0)
        previous_lapsed = _raw_remaining_credit(prev_total, prev_used)

    period_invoices = (
        db.query(OrgCreditInvoice)
        .filter(
            OrgCreditInvoice.organization_id == organization_id,
            OrgCreditInvoice.billing_month == period,
        )
        .all()
    )
    invoices_count = len(period_invoices)
    paid_invoices_count = len([row for row in period_invoices if row.payment_done_flag])
    open_invoices_count = max(0, invoices_count - paid_invoices_count)

    payments_collected = 0.0
    if period_invoices:
        invoice_ids = [row.id for row in period_invoices]
        payment_rows = (
            db.query(OrgCreditPayment)
            .filter(OrgCreditPayment.invoice_id.in_(invoice_ids))
            .all()
        )
        payments_collected = _round2(
            sum(float(row.actual_payment or 0) for row in payment_rows)
        )

    db.commit()
    db.refresh(balance)
    return {
        "organization_id": organization_id,
        "organization_name": organization.name,
        "billing_period": period,
        "total_credit": total_credit,
        "used_credit": used_credit,
        "remaining_credit": remaining_credit,
        "lapsed_previous_month": previous_lapsed,
        "invoices_count": invoices_count,
        "paid_invoices_count": paid_invoices_count,
        "open_invoices_count": open_invoices_count,
        "payments_collected": payments_collected,
        "no_rollover_policy": True,
        "generated_at": datetime.now(timezone.utc),
    }


# organization_id: Optional[int] = None,
# ) -> List[OrgCredit]:
#     query = db.query(OrgCredit)
#     if organization_id is not None:
#         query = query.filter(OrgCredit.organization_id == organization_id)


def get_organization_summary(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    organization_id: Optional[int] = None,
    billing_period: Optional[str] = None,
) -> Dict[str, object]:
    query = db.query(OrgCreditBalance)
    if organization_id is not None:
        query = query.filter(OrgCreditBalance.organization_id == organization_id)
    period = _normalize_billing_period(
        billing_period or _billing_period(datetime.now(timezone.utc).date())
    )
    current_period = _billing_period(datetime.now(timezone.utc).date())

    balance = _recalculate_balance_for_period(db, organization_id, period)
    total_credit = _round2(balance.total_credit or 0)
    used_credit = _round2(balance.used_credit or 0)
    raw_remaining = _raw_remaining_credit(total_credit, used_credit)
    remaining_credit = 0.0 if period < current_period else raw_remaining

    previous_period = _shift_billing_period(period, -1)
    previous_balance = (
        db.query(OrgCreditBalance)
        .filter(
            OrgCreditBalance.organization_id == organization_id,
            OrgCreditBalance.billing_period == previous_period,
        )
        .first()
    )
    previous_lapsed = 0.0
    if previous_balance:
        prev_total = _round2(previous_balance.total_credit or 0)
        prev_used = _round2(previous_balance.used_credit or 0)
        previous_lapsed = _raw_remaining_credit(prev_total, prev_used)

    period_invoices = (
        db.query(OrgCreditInvoice)
        .filter(
            OrgCreditInvoice.organization_id == organization_id,
            OrgCreditInvoice.billing_month == period,
        )
        .all()
    )
    invoices_count = len(period_invoices)
    paid_invoices_count = len([row for row in period_invoices if row.payment_done_flag])
    open_invoices_count = max(0, invoices_count - paid_invoices_count)

    payments_collected = 0.0
    if period_invoices:
        invoice_ids = [row.id for row in period_invoices]
        payment_rows = (
            db.query(OrgCreditPayment)
            .filter(OrgCreditPayment.invoice_id.in_(invoice_ids))
            .all()
        )
        payments_collected = _round2(
            sum(float(row.actual_payment or 0) for row in payment_rows)
        )

    db.commit()
    db.refresh(balance)

    organization = _get_organization_or_404(db, organization_id)

    return {
        "organization_id": organization_id,
        "organization_name": organization.name,
        "billing_period": period,
        "total_credit": total_credit,
        "used_credit": used_credit,
        "remaining_credit": remaining_credit,
        "lapsed_previous_month": previous_lapsed,
        "invoices_count": invoices_count,
        "paid_invoices_count": paid_invoices_count,
        "open_invoices_count": open_invoices_count,
        "payments_collected": payments_collected,
        "no_rollover_policy": True,
        "generated_at": datetime.now(timezone.utc),
    }


def get_lapse_report(
    db: Session,
    billing_period: Optional[str] = None,
    months: int = 6,
    organization_id: Optional[int] = None,
) -> Dict[str, object]:
    end_period = _normalize_billing_period(
        billing_period or _billing_period(datetime.now(timezone.utc).date())
    )
    current_period = _billing_period(datetime.now(timezone.utc).date())
    period_window = [
        _shift_billing_period(end_period, -idx) for idx in reversed(range(months))
    ]

    org_query = db.query(Organization)
    if organization_id is not None:
        org_query = org_query.filter(Organization.id == organization_id)
    organizations = org_query.order_by(
        Organization.name.asc(), Organization.id.asc()
    ).all()
    if organization_id is not None and not organizations:
        raise HTTPException(status_code=404, detail="Organization not found")

    rows: List[Dict[str, object]] = []
    total_lapsed_credit = 0.0

    for org in organizations:
        for period in period_window:
            existing_balance = (
                db.query(OrgCreditBalance)
                .filter(
                    OrgCreditBalance.organization_id == org.id,
                    OrgCreditBalance.billing_period == period,
                )
                .first()
            )
            has_invoice = (
                db.query(OrgCreditInvoice.id)
                .filter(
                    OrgCreditInvoice.organization_id == org.id,
                    OrgCreditInvoice.billing_month == period,
                )
                .first()
                is not None
            )

            if not existing_balance and not has_invoice:
                continue

            balance: Optional[OrgCreditBalance]
            if has_invoice:
                balance = _recalculate_balance_for_period(db, org.id, period)
            else:
                balance = existing_balance
                if balance:
                    _recompute_balance(balance)

            if not balance:
                continue

            total_credit = _round2(balance.total_credit or 0)
            used_credit = _round2(balance.used_credit or 0)
            raw_remaining = _raw_remaining_credit(total_credit, used_credit)
            lapsed_credit = raw_remaining if period < current_period else 0.0
            remaining_credit = 0.0 if period < current_period else raw_remaining

            if total_credit <= 0 and used_credit <= 0 and raw_remaining <= 0:
                continue

            total_lapsed_credit = _round2(total_lapsed_credit + lapsed_credit)
            rows.append(
                {
                    "organization_id": org.id,
                    "organization_name": org.name,
                    "billing_period": (
                        balance.billing_cycle_display if balance else period
                    ),
                    "total_credit": total_credit,
                    "used_credit": used_credit,
                    "remaining_credit": remaining_credit,
                    "lapsed_credit": lapsed_credit,
                }
            )

    db.commit()
    return {
        "rows": rows,
        "total_lapsed_credit": total_lapsed_credit,
        "months": months,
        "end_period": end_period,
        "generated_at": datetime.now(timezone.utc),
    }


def _get_or_create_org_email_settings(
    db: Session, organization_id: int
) -> OrganizationSettings:
    settings_row = (
        db.query(OrganizationSettings)
        .filter(OrganizationSettings.organization_id == organization_id)
        .first()
    )
    if settings_row:
        return settings_row

    settings_row = OrganizationSettings(organization_id=organization_id)
    db.add(settings_row)
    db.flush()
    return settings_row


def get_invoice_document(db: Session, invoice_id: int) -> Dict[str, object]:
    invoice = _get_invoice_or_404(db, invoice_id)
    org_credit = _get_org_credit_or_404(db, invoice.org_credit_id)
    organization = _get_organization_or_404(db, invoice.organization_id)
    estimator = _get_estimator_or_404(db, org_credit.estimator_id)
    payments = (
        db.query(OrgCreditPayment)
        .filter(
            OrgCreditPayment.invoice_id == invoice.id,
        )
        .order_by(OrgCreditPayment.payment_date.asc(), OrgCreditPayment.id.asc())
        .all()
    )
    outstanding_amount = _round2(
        max(0, (invoice.invoice_amount or 0) - (invoice.paid_amount or 0))
    )
    organization_admin_email = _get_organization_admin_email(
        db, invoice.organization_id
    )

    return {
        "invoice": invoice,
        "organization_name": organization.name,
        "organization_admin_email": organization_admin_email,
        "estimator_name": estimator.company_name,
        "billing_start_date": org_credit.billing_start_date,
        "billing_end_date": org_credit.billing_end_date,
        "billing_cycle": org_credit.billing_cycle,
        "payment_status": org_credit.payment_status,
        "outstanding_amount": outstanding_amount,
        "payments": payments,
        "generated_at": datetime.now(timezone.utc),
    }


def get_payment_receipt(db: Session, payment_id: int) -> Dict[str, object]:
    payment = (
        db.query(OrgCreditPayment).filter(OrgCreditPayment.id == payment_id).first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    invoice = _get_invoice_or_404(db, payment.invoice_id)
    org_credit = _get_org_credit_or_404(db, invoice.org_credit_id)
    organization = _get_organization_or_404(db, payment.organization_id)
    estimator = _get_estimator_or_404(db, org_credit.estimator_id)
    organization_admin_email = _get_organization_admin_email(
        db, payment.organization_id
    )

    return {
        "payment": payment,
        "invoice": invoice,
        "organization_name": organization.name,
        "organization_admin_email": organization_admin_email,
        "estimator_name": estimator.company_name,
        "billing_start_date": org_credit.billing_start_date,
        "billing_end_date": org_credit.billing_end_date,
        "generated_at": datetime.now(timezone.utc),
    }


def _build_invoice_email_html(document: Dict[str, object]) -> str:
    invoice: OrgCreditInvoice = document["invoice"]  # type: ignore[assignment]
    organization_name = str(document["organization_name"])
    estimator_name = str(document["estimator_name"] or "-")
    billing_start_date: date = document["billing_start_date"]  # type: ignore[assignment]
    billing_end_date: date = document["billing_end_date"]  # type: ignore[assignment]
    payment_status = str(document["payment_status"])
    payments = document.get("payments", [])
    outstanding_amount = float(document.get("outstanding_amount") or 0)

    payment_rows_html = ""
    if isinstance(payments, list) and payments:
        for row in payments:
            if not isinstance(row, OrgCreditPayment):
                continue
            payment_rows_html += (
                "<tr>"
                f"<td style='padding:8px; border:1px solid #dbe4f3;'>{row.id}</td>"
                f"<td style='padding:8px; border:1px solid #dbe4f3;'>{row.payment_date}</td>"
                f"<td style='padding:8px; border:1px solid #dbe4f3;'>{row.payment_mode or '-'}</td>"
                f"<td style='padding:8px; border:1px solid #dbe4f3;'>{row.payment_reference or '-'}</td>"
                f"<td style='padding:8px; border:1px solid #dbe4f3; text-align:right;'>{row.actual_payment:.2f}</td>"
                "</tr>"
            )
    else:
        payment_rows_html = "<tr><td colspan='5' style='padding:8px; border:1px solid #dbe4f3; text-align:center;'>No payments yet</td></tr>"

    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; background:#f5f7fb; padding:16px;">
        <div style="max-width:680px; margin:0 auto; background:#fff; border:1px solid #dbe4f3; border-radius:10px;">
          <div style="background:linear-gradient(135deg,#1f4f95,#44acd6); color:#fff; padding:18px 20px; border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">Invoice #{invoice.id}</h2>
            <div style="margin-top:4px; font-size:12px;">Org Credit Billing Statement</div>
          </div>
          <div style="padding:20px;">
            <p><strong>Organization:</strong> {organization_name}</p>
            <p><strong>Estimator:</strong> {estimator_name}</p>
            <p><strong>Billing Cycle:</strong> {billing_start_date} to {billing_end_date}</p>
            <p><strong>Billing Month:</strong> {invoice.billing_month}</p>
            <p><strong>Total Credit (After Buffer):</strong> {invoice.total_credit:.2f}</p>
            <p><strong>Amount Payable (After Discount):</strong> {invoice.invoice_amount:.2f}</p>
            <p><strong>Paid Amount:</strong> {float(invoice.paid_amount or 0):.2f}</p>
            <p><strong>Outstanding:</strong> {outstanding_amount:.2f}</p>
            <p><strong>Status:</strong> {payment_status}</p>
            <p><strong>Invoice Date:</strong> {invoice.invoice_date}</p>
            <div style="margin-top:14px;">
              <strong>Payment History</strong>
              <table style="width:100%; margin-top:8px; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr>
                    <th style="padding:8px; border:1px solid #dbe4f3; text-align:left;">ID</th>
                    <th style="padding:8px; border:1px solid #dbe4f3; text-align:left;">Date</th>
                    <th style="padding:8px; border:1px solid #dbe4f3; text-align:left;">Mode</th>
                    <th style="padding:8px; border:1px solid #dbe4f3; text-align:left;">Reference</th>
                    <th style="padding:8px; border:1px solid #dbe4f3; text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>{payment_rows_html}</tbody>
              </table>
            </div>
          </div>
        </div>
      </body>
    </html>
    """


def _build_receipt_email_html(receipt: Dict[str, object]) -> str:
    payment: OrgCreditPayment = receipt["payment"]  # type: ignore[assignment]
    invoice: OrgCreditInvoice = receipt["invoice"]  # type: ignore[assignment]
    organization_name = str(receipt["organization_name"])
    estimator_name = str(receipt["estimator_name"] or "-")
    billing_start_date: date = receipt["billing_start_date"]  # type: ignore[assignment]
    billing_end_date: date = receipt["billing_end_date"]  # type: ignore[assignment]

    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; background:#f5f7fb; padding:16px;">
        <div style="max-width:680px; margin:0 auto; background:#fff; border:1px solid #dbe4f3; border-radius:10px;">
          <div style="background:linear-gradient(135deg,#14532d,#22c55e); color:#fff; padding:18px 20px; border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">Receipt #{payment.id}</h2>
            <div style="margin-top:4px; font-size:12px;">Payment Acknowledgement</div>
          </div>
          <div style="padding:20px;">
            <p><strong>Organization:</strong> {organization_name}</p>
            <p><strong>Estimator:</strong> {estimator_name}</p>
            <p><strong>Invoice #:</strong> {invoice.id}</p>
            <p><strong>Billing Cycle:</strong> {billing_start_date} to {billing_end_date}</p>
            <p><strong>Billing Month:</strong> {invoice.billing_month}</p>
            <p><strong>Invoice Amount:</strong> {invoice.invoice_amount:.2f}</p>
            <p><strong>Actual Payment:</strong> {payment.actual_payment:.2f}</p>
            <p><strong>Actual Credit Applied:</strong> {payment.actual_credit:.2f}</p>
            <p><strong>Payment Type:</strong> {payment.full_partial}</p>
            <p><strong>Payment Date:</strong> {payment.payment_date}</p>
            <p><strong>Mode:</strong> {payment.payment_mode or "-"}</p>
            <p><strong>Reference:</strong> {payment.payment_reference or "-"}</p>
            <p><strong>Details:</strong> {payment.payment_other_details or payment.payment_details or "-"}</p>
          </div>
        </div>
      </body>
    </html>
    """


def send_invoice_email(
    db: Session,
    invoice_id: int,
    to_email: str,
    subject: Optional[str] = None,
    body: Optional[str] = None,
) -> Dict[str, str]:
    document = get_invoice_document(db, invoice_id)
    invoice: OrgCreditInvoice = document["invoice"]  # type: ignore[assignment]
    settings_row = _get_or_create_org_email_settings(db, invoice.organization_id)

    html = _build_invoice_email_html(document)
    if body and body.strip():
        html = html.replace(
            "</div>\n        </div>",
            f"<p><strong>Note:</strong> {body.strip()}</p></div>\n        </div>",
        )

    email_subject = (
        subject.strip()
        if subject and subject.strip()
        else f"Invoice #{invoice.id} - {document['organization_name']}"
    )
    ok, error_message, _ = send_campaign_email(
        recipient_email=to_email,
        recipient_name=str(document["organization_name"]),
        campaign_name="Org Credit Invoice",
        message_template=html,
        subject=email_subject,
        settings=settings_row,
    )
    if not ok:
        raise HTTPException(
            status_code=400, detail=error_message or "Failed to send invoice email"
        )

    db.commit()
    return {"message": "Invoice email sent successfully"}


def send_payment_receipt_email(
    db: Session,
    payment_id: int,
    to_email: str,
    subject: Optional[str] = None,
    body: Optional[str] = None,
) -> Dict[str, str]:
    receipt = get_payment_receipt(db, payment_id)
    payment: OrgCreditPayment = receipt["payment"]  # type: ignore[assignment]
    settings_row = _get_or_create_org_email_settings(db, payment.organization_id)

    html = _build_receipt_email_html(receipt)
    if body and body.strip():
        html = html.replace(
            "</div>\n        </div>",
            f"<p><strong>Note:</strong> {body.strip()}</p></div>\n        </div>",
        )

    email_subject = (
        subject.strip()
        if subject and subject.strip()
        else f"Receipt #{payment.id} - Invoice #{payment.invoice_id}"
    )
    ok, error_message, _ = send_campaign_email(
        recipient_email=to_email,
        recipient_name=str(receipt["organization_name"]),
        campaign_name="Payment Receipt",
        message_template=html,
        subject=email_subject,
        settings=settings_row,
    )
    if not ok:
        raise HTTPException(
            status_code=400, detail=error_message or "Failed to send receipt email"
        )

    db.commit()
    return {"message": "Receipt email sent successfully"}


def _build_next_cycle_if_needed(
    db: Session,
    source: OrgCredit,
    today: date,
) -> Tuple[int, int, OrgCredit]:
    generated_entries = 0
    generated_invoices = 0
    current = source

    while True:
        next_start, next_end = _next_cycle_dates(current.billing_end_date)
        next_period = _billing_period(next_start)

        trigger_date = next_start - timedelta(days=15)
        if today < trigger_date:
            break

        # Check organization status
        organization = (
            db.query(Organization)
            .filter(
                Organization.id == current.organization_id,
                Organization.status == OrganizationStatus.ACTIVE,
            )
            .first()
        )

        if not organization:
            break

        existing = (
            db.query(OrgCredit)
            .filter(
                OrgCredit.organization_id == current.organization_id,
                OrgCredit.is_topup == False,
                OrgCredit.billing_start_date == next_start,
                OrgCredit.billing_end_date == next_end,
            )
            .first()
        )

        if existing:
            current = existing
            continue

        paid_credits = (
            db.query(func.coalesce(func.sum(OrgCredit.total_credit), 0))
            .join(
                OrgCreditInvoice,
                OrgCreditInvoice.org_credit_id == OrgCredit.id,
            )
            .filter(
                OrgCredit.organization_id == current.organization_id,
                OrgCredit.billing_month == current.billing_month,
                OrgCreditInvoice.payment_done_flag == True,
            )
            .scalar()
        )

        total_credit = paid_credits
        payable_amount = total_credit

        new_row = OrgCredit(
            organization_id=current.organization_id,
            estimator_id=current.estimator_id,
            parent_org_credit_id=None,
            total_credit=total_credit,
            billing_cycle="monthly",
            payment_status="unpaid",
            billing_start_date=next_start,
            billing_end_date=next_end,
            billing_month=next_period,
            is_topup=False,
            topup_credit=None,
            is_auto_generated=True,
            notes="Auto-generated monthly billing cycle entry",
        )
        db.add(new_row)
        db.flush()
        generated_entries += 1

        _create_invoice_for_credit(
            db=db,
            org_credit=new_row,
            invoice_date=today,
            notes="Auto-generated recurring invoice",
            payment_done_flag=False,
            invoice_amount_override=payable_amount,
        )
        generated_invoices += 1
        current = new_row

    return generated_entries, generated_invoices, current


def run_billing_automation(db: Session, today: Optional[date] = None) -> Dict[str, int]:
    current_day = today or datetime.now(timezone.utc).date()

    rows = (
        db.query(OrgCredit)
        .filter(OrgCredit.is_topup == False)
        .order_by(
            OrgCredit.organization_id.asc(),
            OrgCredit.billing_end_date.desc(),
            OrgCredit.payment_status == "paid",
        )
        .all()
    )

    latest_by_key: Dict[Tuple[int, int], OrgCredit] = {}
    for row in rows:
        key = (row.organization_id, row.estimator_id)
        if key not in latest_by_key:
            latest_by_key[key] = row

    generated_entries = 0
    generated_invoices = 0
    for latest_row in latest_by_key.values():
        try:
            entry_count, invoice_count, _ = _build_next_cycle_if_needed(
                db, latest_row, current_day
            )
            generated_entries += entry_count
            generated_invoices += invoice_count
        except Exception as exc:
            logger.error(
                "Skipping automation for org=%s estimator=%s due to error: %s",
                latest_row.organization_id,
                latest_row.estimator_id,
                str(exc),
                exc_info=True,
            )

    db.commit()
    return {
        "evaluated_entries": len(latest_by_key),
        "generated_entries": generated_entries,
        "generated_invoices": generated_invoices,
    }


def _seconds_until_next_run(hour_utc: int, minute_utc: int) -> float:
    now = datetime.now(timezone.utc)
    target = now.replace(hour=hour_utc, minute=minute_utc, second=0, microsecond=0)
    if now >= target:
        target = target + timedelta(days=1)
    return max((target - now).total_seconds(), 1.0)


def run_org_credit_billing_batches() -> Dict[str, int]:
    db = SessionLocal()
    try:
        return run_billing_automation(db=db)
    finally:
        db.close()


async def run_daily_org_credit_billing_daemon(stop_event: asyncio.Event) -> None:
    initial_delay = max(settings.ORG_CREDIT_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        result = run_org_credit_billing_batches()
        logger.info(
            "Initial org-credit billing automation completed: evaluated=%s generated_entries=%s generated_invoices=%s",
            result["evaluated_entries"],
            result["generated_entries"],
            result["generated_invoices"],
        )
    except Exception as exc:
        logger.error(
            "Initial org-credit billing automation failed: %s", str(exc), exc_info=True
        )

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_run(
            settings.ORG_CREDIT_DAEMON_HOUR_UTC,
            settings.ORG_CREDIT_DAEMON_MINUTE_UTC,
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            result = run_org_credit_billing_batches()
            logger.info(
                "Scheduled org-credit billing automation completed: evaluated=%s generated_entries=%s generated_invoices=%s",
                result["evaluated_entries"],
                result["generated_entries"],
                result["generated_invoices"],
            )
        except Exception as exc:
            logger.error(
                "Scheduled org-credit billing automation failed: %s",
                str(exc),
                exc_info=True,
            )
