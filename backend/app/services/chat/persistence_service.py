from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Dict, Optional
import json

from sqlalchemy.orm import Session

from app.models import Conversation, RetrievalTrace
from app.models.campaign import Contact
from app.models.org_credit_balance import OrgCreditBalance
from app.models.organization_credit_usages import OrganizationCreditUsage
from app.models.price_matrix_item import PriceMatrixItem
from app.services.report_service import sync_conversation_metrics

from app.services.chat.types import CreditReservation


@contextmanager
def transactional_session(db: Session):
    if db.in_transaction():
        with db.begin_nested():
            yield
    else:
        with db.begin():
            yield


def _resolve_price_item(db: Session, feature_code: str) -> PriceMatrixItem:
    item = db.query(PriceMatrixItem).filter(PriceMatrixItem.feature_code == feature_code, PriceMatrixItem.is_active == True).first()
    if not item:
        raise Exception("Invalid feature")
    return item


def reserve_chat_credits(
    db: Session,
    organization_id: int,
    feature_code: str,
    quantity: float,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
) -> CreditReservation:
    item = _resolve_price_item(db, feature_code)
    credits_required = quantity * item.credits_per_unit
    billing_period = datetime.utcnow().strftime("%Y-%m")
    balance = db.query(OrgCreditBalance).filter(OrgCreditBalance.organization_id == organization_id, OrgCreditBalance.billing_period == billing_period).with_for_update().first()
    if not balance:
        raise Exception("Credit balance not found")
    if balance.remaining_credit < credits_required:
        raise Exception("Insufficient credits")
    balance.remaining_credit -= credits_required
    usage = OrganizationCreditUsage(organization_id=organization_id, price_matrix_item_id=item.id, used_quantity=quantity, credits_used=credits_required, status="reserved", reference_type=reference_type, reference_id=str(reference_id) if reference_id else None)
    db.add(usage)
    db.flush()
    return CreditReservation(usage_id=usage.id, organization_id=organization_id, feature_code=feature_code, quantity=quantity, credits_reserved=credits_required, reference_type=reference_type, reference_id=str(reference_id) if reference_id else None)


def finalize_chat_credit_reservation(db: Session, reservation: CreditReservation, actual_quantity: Optional[float] = None) -> None:
    usage = db.query(OrganizationCreditUsage).filter(OrganizationCreditUsage.id == reservation.usage_id).with_for_update().first()
    if not usage:
        raise Exception("Reserved credits not found")
    item = db.query(PriceMatrixItem).filter(PriceMatrixItem.id == usage.price_matrix_item_id).first()
    if not item:
        raise Exception("Invalid feature")
    quantity = actual_quantity if actual_quantity is not None else reservation.quantity
    credits_required = quantity * item.credits_per_unit
    usage.used_quantity = quantity
    usage.credits_used = credits_required
    usage.status = "consumed"
    billing_period = datetime.utcnow().strftime("%Y-%m")
    balance = db.query(OrgCreditBalance).filter(OrgCreditBalance.organization_id == reservation.organization_id, OrgCreditBalance.billing_period == billing_period).with_for_update().first()
    if not balance:
        raise Exception("Credit balance not found")
    balance.used_credit += credits_required
    db.flush()


def rollback_chat_credit_reservation(db: Session, reservation: CreditReservation) -> None:
    usage = db.query(OrganizationCreditUsage).filter(OrganizationCreditUsage.id == reservation.usage_id).with_for_update().first()
    if not usage or usage.status != "reserved":
        return
    billing_period = datetime.utcnow().strftime("%Y-%m")
    balance = db.query(OrgCreditBalance).filter(OrgCreditBalance.organization_id == reservation.organization_id, OrgCreditBalance.billing_period == billing_period).with_for_update().first()
    if balance:
        balance.remaining_credit += reservation.credits_reserved
    usage.status = "released"
    db.flush()


def persist_conversation_record(
    db: Session,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    message: str,
    response_text: str,
    retrieval_trace: Optional[Dict] = None,
) -> Conversation:
    contact = db.query(Contact).filter(Contact.session_id == session_id).first()
    conversation = Conversation(session_id=session_id, widget_id=widget_id, user_id=user_id, organization_id=organization_id, message=message, response=response_text, role="user", source="chat", contact_id=contact.id if contact else None)
    db.add(conversation)
    db.flush()
    if retrieval_trace:
        trace_record = RetrievalTrace(conversation_id=conversation.id, session_id=session_id, widget_id=widget_id, organization_id=organization_id, user_id=user_id, user_query=retrieval_trace.get("user_query") or message, retrieval_query=retrieval_trace.get("retrieval_query"), query_variants=json.dumps(retrieval_trace.get("query_variants", []), ensure_ascii=True, default=str), retrieved_chunks=json.dumps(retrieval_trace.get("retrieved_chunks", []), ensure_ascii=True, default=str), selected_chunks=json.dumps(retrieval_trace.get("selected_chunks", []), ensure_ascii=True, default=str), source_ids=json.dumps(retrieval_trace.get("source_ids", []), ensure_ascii=True, default=str), has_context=bool(retrieval_trace.get("has_context")), escalation_triggered=bool(retrieval_trace.get("escalation_triggered")), top_distance=float(retrieval_trace["top_distance"]) if retrieval_trace.get("top_distance") is not None else None)
        db.add(trace_record)
    return conversation


def finalize_conversation_metrics(db: Session, conversation_id: int, organization_id: int, session_id: str, token_usage: Dict) -> None:
    sync_conversation_metrics(db, conversation_id, organization_id, session_id, token_usage=token_usage)
