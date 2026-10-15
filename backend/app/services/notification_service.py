"""Organization-scoped recipients and event notifications for chat activity."""

from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    HandoffAgentAssignment,
    HandoffSession,
    Lead,
    OrganizationEmailSetting,
    User,
    UserRole,
)
from app.services.email_service import (
    get_cc_emails,
    send_appointment_booked_notification,
    send_handoff_notification,
    send_new_lead_notification,
)
from app.services.organization_setting_service import get_org_email_setting


def get_notification_recipients(
    db: Session,
    organization_id: int,
    widget_id: str | None = None,
    participant_email: str | None = None,
    include_handoff_users: bool = False,
) -> tuple[list[str], OrganizationEmailSetting | None]:
    """Return configured notification addresses, org admins, and participant."""
    recipients: list[str] = []

    profiles = (
        db.query(OrganizationEmailSetting.cc_emails)
        .filter(
            OrganizationEmailSetting.organization_id == organization_id,
            OrganizationEmailSetting.is_active.is_(True),
        )
        .all()
    )
    for (cc_emails,) in profiles:
        recipients.extend(get_cc_emails(cc_emails))

    admin_emails = (
        db.query(User.email)
        .filter(
            User.organization_id == organization_id,
            User.role == UserRole.ADMIN,
            User.is_active.is_(True),
        )
        .all()
    )
    recipients.extend(email for (email,) in admin_emails if email)

    if include_handoff_users and widget_id:
        handoff_emails = (
            db.query(User.email)
            .join(HandoffAgentAssignment, HandoffAgentAssignment.user_id == User.id)
            .filter(
                User.organization_id == organization_id,
                User.role == UserRole.USER_HANDOFF,
                User.is_active.is_(True),
                HandoffAgentAssignment.widget_id == widget_id,
            )
            .all()
        )
        recipients.extend(email for (email,) in handoff_emails if email)

    if participant_email:
        recipients.append(participant_email)

    unique_recipients: list[str] = []
    seen: set[str] = set()
    for email in recipients:
        cleaned = (email or "").strip()
        key = cleaned.casefold()
        if cleaned and key not in seen:
            seen.add(key)
            unique_recipients.append(cleaned)

    return unique_recipients, get_org_email_setting(db, organization_id)


def notify_lead_created(db: Session, lead: Lead) -> bool:
    recipients, email_setting = get_notification_recipients(
        db,
        lead.organization_id,
        widget_id=lead.widget_id,
        participant_email=lead.email,
    )
    return send_new_lead_notification(
        lead_email=lead.email or "",
        lead_name=lead.name or "Unknown",
        lead_phone=lead.phone or "",
        lead_company=lead.company,
        admin_emails=recipients,
        org_email_setting=email_setting,
    )


def notify_handoff_created(db: Session, handoff: HandoffSession) -> bool:
    participant = (
        db.query(Lead.email)
        .filter(
            Lead.organization_id == handoff.organization_id,
            Lead.widget_id == handoff.widget_id,
            Lead.session_id == handoff.session_id,
        )
        .order_by(Lead.created_at.desc())
        .first()
    )
    recipients, email_setting = get_notification_recipients(
        db,
        handoff.organization_id,
        widget_id=handoff.widget_id,
        participant_email=participant[0] if participant else None,
        include_handoff_users=True,
    )
    return send_handoff_notification(
        recipients=recipients,
        chat_id=handoff.chat_id,
        reason=handoff.handoff_reason,
        org_email_setting=email_setting,
    )


def notify_appointment_booked(db: Session, appointment: Appointment) -> bool:
    recipients, email_setting = get_notification_recipients(
        db,
        appointment.organization_id,
        widget_id=appointment.widget_id,
        participant_email=appointment.email,
    )
    return send_appointment_booked_notification(
        recipients=recipients,
        participant_name=appointment.name,
        participant_email=appointment.email,
        appointment_at=appointment.appointment_at,
        timezone_label=appointment.timezone,
        notes=appointment.notes,
        org_email_setting=email_setting,
    )