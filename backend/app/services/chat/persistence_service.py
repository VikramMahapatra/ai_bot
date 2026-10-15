from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Dict, Optional
import json

from sqlalchemy.orm import Session

from app.models import Conversation, RetrievalTrace
from app.models.campaign import Contact, ContactList
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


def find_session_contact(db: Session, session_id: str, widget_id: str, organization_id: int):
    """A session token alone is not a tenant or agent authorization boundary."""
    if not session_id or not widget_id or not organization_id:
        return None
    return (db.query(Contact).join(ContactList, Contact.contact_list_id == ContactList.id)
            .filter(Contact.session_id == session_id,
                    ContactList.organization_id == organization_id,
                    ContactList.description == f"AUTO_AGENT_APPOINTMENT_LIST::{widget_id}")
            .order_by(Contact.id.desc()).first())


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
    contact = find_session_contact(db, session_id, widget_id, organization_id)
    conversation = Conversation(session_id=session_id, widget_id=widget_id, user_id=user_id, organization_id=organization_id, message=message, response=response_text, role="user", source="chat", contact_id=contact.id if contact else None)
    db.add(conversation)
    db.flush()
    if retrieval_trace:
        trace_record = RetrievalTrace(conversation_id=conversation.id, session_id=session_id, widget_id=widget_id, organization_id=organization_id, user_id=user_id, user_query=retrieval_trace.get("user_query") or message, retrieval_query=retrieval_trace.get("retrieval_query"), query_variants=json.dumps(retrieval_trace.get("query_variants", []), ensure_ascii=True, default=str), retrieved_chunks=json.dumps(retrieval_trace.get("retrieved_chunks", []), ensure_ascii=True, default=str), selected_chunks=json.dumps(retrieval_trace.get("selected_chunks", []), ensure_ascii=True, default=str), source_ids=json.dumps(retrieval_trace.get("source_ids", []), ensure_ascii=True, default=str), has_context=bool(retrieval_trace.get("has_context")), escalation_triggered=bool(retrieval_trace.get("escalation_triggered")), top_distance=float(retrieval_trace["top_distance"]) if retrieval_trace.get("top_distance") is not None else None)
        db.add(trace_record)
    return conversation


def persist_contact_form_records(db: Session, session_id: str, widget_id: str,
                                 user_id: int, organization_id: int, contact) -> None:
    """Stage user-only form history in the caller's transaction; never commit/cache."""
    if not session_id or not organization_id:
        return
    existing = (db.query(Conversation)
                .filter(Conversation.organization_id == organization_id,
                        Conversation.user_id == user_id,
                        Conversation.widget_id == widget_id,
                        Conversation.session_id == session_id,
                        Conversation.source == "quick_connect",
                        Conversation.role == "user").all())
    by_message = {row.message: row for row in existing}
    submitted_at = datetime.now(timezone.utc)
    for message in contact_form_messages(contact):
        row = by_message.get(message)
        if row is None:
            row = persist_conversation_record(db, session_id, widget_id, user_id,
                                              organization_id, message, "")
            row.source = "quick_connect"
            by_message[message] = row
        # A -> B -> A recovers the latest whole submission without another row.
        row.created_at = submitted_at
    db.flush()


def contact_form_messages(contact):
    """Yield one canonical, readable, reversible message for the whole submission."""
    def value(key):
        return contact.get(key) if isinstance(contact, dict) else getattr(contact, key, None)

    def submitted(key):
        if isinstance(contact, dict):
            return key in contact
        fields = getattr(contact, "model_fields_set", None)
        return key in fields if fields is not None else value(key) is not None

    def standard_value(raw):
        if isinstance(raw, str):
            # Plain strings stay readable. Quote delimiters, whitespace/control
            # characters and JSON-looking strings to retain their exact type.
            quote = (raw != raw.strip() or any(c in raw for c in '|:"\\')
                     or any(ord(c) < 32 for c in raw) or raw.startswith(("[", "{")))
            quote = quote or raw in ("null", "true", "false")
            if not quote:
                return raw
        return json.dumps(raw, ensure_ascii=True, sort_keys=True)

    parts = []
    for key in ("name", "email", "phone", "company"):
        if submitted(key):
            parts.append(f"{key.title()}: {standard_value(value(key))}")
    custom = value("custom_fields")
    if isinstance(custom, str):
        custom = json.loads(custom)
    if custom is not None and not isinstance(custom, dict):
        raise ValueError("custom_fields must be a JSON object")
    for key, raw in sorted((custom or {}).items()):
        parts.append("Custom field " + json.dumps(key, ensure_ascii=True) + ": "
                     + json.dumps(raw, ensure_ascii=True, sort_keys=True))
    yield "Quick Connect Details: " + " | ".join(parts)


def _parse_contact_form_submission(message):
    """Parse a combined snapshot; JSON decoding consumes quoted/nested values.

    Never split the whole message on pipes: custom JSON can contain them at any
    depth. A malformed snapshot is rejected atomically by the recovery caller.
    """
    tail = message[len("Quick Connect Details: "):]
    result = {"custom_fields": {}}
    decoder = json.JSONDecoder()
    while tail:
        if tail.startswith("Custom field "):
            tail = tail[len("Custom field "):]
            key, end = decoder.raw_decode(tail)
            if not isinstance(key, str) or not tail[end:].startswith(": "):
                raise ValueError("Invalid custom field key")
            tail = tail[end + 2:]
            raw, end = decoder.raw_decode(tail)
            result["custom_fields"][key] = raw
            tail = tail[end:]
        else:
            key, separator, tail = tail.partition(": ")
            if not separator or key not in ("Name", "Email", "Phone", "Company"):
                raise ValueError("Invalid standard field")
            if tail.startswith('"'):
                raw, end = decoder.raw_decode(tail)
                tail = tail[end:]
            else:
                raw, separator, rest = tail.partition(" | ")
                tail = (" | " + rest) if separator else ""
                # Standard schema fields are strings (including numeric phones)
                # or null; custom fields use the full typed JSON decoder above.
                if raw in ("null", "true", "false"):
                    raw = json.loads(raw)
            result[key.lower()] = raw
        if tail:
            if not tail.startswith(" | ") or not tail[3:]:
                raise ValueError("Invalid field separator")
            tail = tail[3:]
    return result


def recover_contact_form_records(db: Session, organization_id: int, widget_id: str,
                                 session_id: str) -> dict:
    rows = (db.query(Conversation)
            .filter(Conversation.organization_id == organization_id,
                    Conversation.widget_id == widget_id,
                    Conversation.session_id == session_id,
                    Conversation.source == "quick_connect",
                    Conversation.role == "user")
            .order_by(Conversation.created_at, Conversation.id).all())
    result = {}
    for row in rows:
        message = row.message
        if message.startswith("Quick Connect Details: "):
            try:
                # A combined row is a custom-field snapshot, not per-key history.
                result.update(_parse_contact_form_submission(message))
            except (ValueError, TypeError):
                continue
        elif message.startswith("Custom field "):
            try:
                key, end = json.JSONDecoder().raw_decode(message[len("Custom field "):])
                tail = message[len("Custom field ") + end:]
                if isinstance(key, str) and tail.startswith(": "):
                    result.setdefault("custom_fields", {})[key] = json.loads(tail[2:])
            except (ValueError, TypeError):
                continue
        else:
            key, separator, raw = message.partition(": ")
            if separator and key in ("Name", "Email", "Phone", "Company"):
                result[key.lower()] = raw
    return result


def finalize_conversation_metrics(db: Session, conversation_id: int, organization_id: int, session_id: str, token_usage: Dict) -> None:
    sync_conversation_metrics(db, conversation_id, organization_id, session_id, token_usage=token_usage)
