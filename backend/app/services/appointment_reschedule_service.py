"""Shared persistence and notifications for appointment rescheduling."""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import Appointment, Organization, WidgetConfig
from app.services.email_service import send_appointment_rescheduled_notification
from app.services.notification_service import get_notification_recipients


DEFAULT_MEETING_LINK = "https://meet.google.com/new"


class AppointmentSlotUnavailable(ValueError):
    """A booked appointment already occupies the requested exact start time."""


def reschedule_appointment_record(
    db: Session,
    appointment: Appointment,
    appointment_at: datetime,
    timezone_name: str,
    *,
    notes: str | None = None,
    meeting_link: str | None = None,
) -> dict:
    """Update the existing scoped appointment row and send its reschedule notice.

    Visitor appointments have no external calendar/provider event ID in the current
    schema, so this operation updates the authoritative database record. Slot
    availability is limited to exact-start conflicts among booked widget records.
    """
    if appointment_at.tzinfo is None:
        appointment_at = appointment_at.replace(tzinfo=ZoneInfo(timezone_name))
    appointment_at = appointment_at.astimezone(ZoneInfo(timezone_name))
    if appointment_at.astimezone(timezone.utc) <= datetime.now(timezone.utc):
        raise ValueError("Rescheduled appointment time must be in the future")

    conflict = (
        db.query(Appointment.id)
        .filter(
            Appointment.organization_id == appointment.organization_id,
            Appointment.widget_id == appointment.widget_id,
            Appointment.status == "booked",
            Appointment.appointment_at == appointment_at,
            Appointment.id != appointment.id,
        )
        .first()
    )
    if conflict:
        raise AppointmentSlotUnavailable("That appointment time is already booked")

    old_appointment_at = appointment.appointment_at
    old_timezone = appointment.timezone
    appointment.appointment_at = appointment_at
    appointment.timezone = timezone_name
    appointment.status = "booked"
    if notes is not None:
        appointment.notes = notes.strip() or None

    try:
        db.commit()
        db.refresh(appointment)
    except Exception:
        db.rollback()
        raise

    try:
        widget_config = (
            db.query(WidgetConfig)
            .filter(
                WidgetConfig.widget_id == appointment.widget_id,
                WidgetConfig.organization_id == appointment.organization_id,
            )
            .first()
        )
        organization = (
            db.query(Organization)
            .filter(Organization.id == appointment.organization_id)
            .first()
        )
        recipients, email_setting = get_notification_recipients(
            db,
            appointment.organization_id,
            widget_id=appointment.widget_id,
            participant_email=appointment.email,
        )
        old_zone = ZoneInfo(old_timezone or timezone_name)
        new_zone = ZoneInfo(timezone_name)
        old_time_label = old_appointment_at
        if old_time_label.tzinfo is None:
            old_time_label = old_time_label.replace(tzinfo=old_zone)
        old_label = old_time_label.astimezone(old_zone).strftime("%d %b %Y, %I:%M %p")
        new_label = appointment.appointment_at
        if new_label.tzinfo is None:
            new_label = new_label.replace(tzinfo=new_zone)
        new_label = new_label.astimezone(new_zone).strftime("%d %b %Y, %I:%M %p")
        link = (
            (meeting_link or "").strip()
            or (getattr(organization, "default_meet_link", None) or "").strip()
            or DEFAULT_MEETING_LINK
        )
        notification_ok, notification_errors = send_appointment_rescheduled_notification(
            recipients=recipients,
            participant_name=appointment.name,
            participant_email=appointment.email,
            appointment_time_label=new_label,
            timezone_label=timezone_name,
            previous_time_label=f"{old_label} ({old_timezone or timezone_name})",
            meeting_link=link,
            widget_name=getattr(widget_config, "name", None) or appointment.widget_id,
            notes=appointment.notes,
            org_email_setting=email_setting,
        )
    except Exception as exc:
        notification_ok, notification_errors = False, [str(exc)]
        recipients = [appointment.email] if appointment.email else []
        link = (meeting_link or "").strip() or DEFAULT_MEETING_LINK
    return {
        "appointment": appointment,
        "previous_time": old_appointment_at,
        "previous_timezone": old_timezone or timezone_name,
        "notification_sent": notification_ok,
        "recipient_count": len({(email or "").strip().casefold() for email in recipients if (email or "").strip()}),
        "notification_errors": notification_errors,
        "meeting_link": link,
    }
