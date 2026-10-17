"""Isolated persistence regressions for the shared appointment reschedule operation."""
from __future__ import annotations

import ast
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace as NS
import unittest
from unittest.mock import Mock
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent


class Field:
    def __init__(self, name):
        self.name = name

    def __eq__(self, value):
        return self.name, "eq", value

    def __ne__(self, value):
        return self.name, "ne", value


class Appointment:
    id = Field("id")
    organization_id = Field("organization_id")
    widget_id = Field("widget_id")
    status = Field("status")
    appointment_at = Field("appointment_at")


class WidgetConfig:
    widget_id = Field("widget_id")
    organization_id = Field("organization_id")


class Organization:
    id = Field("id")


class Query:
    def __init__(self, db, target):
        self.db, self.target, self.predicates = db, target, []

    def filter(self, *predicates):
        self.predicates.extend(predicates)
        return self

    def _rows(self):
        if self.target is Appointment.id:
            rows = self.db.appointments
        elif self.target is Appointment:
            rows = self.db.appointments
        elif self.target is WidgetConfig:
            rows = self.db.widgets
        elif self.target is Organization:
            rows = self.db.organizations
        else:
            raise AssertionError(f"Unexpected query target {self.target!r}")
        for field, operation, expected in self.predicates:
            if operation == "eq":
                rows = [row for row in rows if getattr(row, field) == expected]
            elif operation == "ne":
                rows = [row for row in rows if getattr(row, field) != expected]
        return rows

    def first(self):
        return next(iter(self._rows()), None)

    def all(self):
        return self._rows()


class Database:
    def __init__(self, appointments, widgets=(), organizations=(), fail_commit=False):
        self.appointments = list(appointments)
        self.widgets = list(widgets)
        self.organizations = list(organizations)
        self.fail_commit = fail_commit
        self.commit_count = 0
        self.rollback = Mock()

    def query(self, target):
        return Query(self, target)

    def commit(self):
        if self.fail_commit:
            raise RuntimeError("simulated persistence failure")
        self.commit_count += 1

    def refresh(self, record):
        return None


def load_operation():
    path = ROOT / "app/services/appointment_reschedule_service.py"
    source = ast.parse(path.read_text(encoding="utf-8"))
    requested = {"AppointmentSlotUnavailable", "reschedule_appointment_record"}
    nodes = [node for node in source.body if getattr(node, "name", None) in requested]
    nodes.extend(
        node for node in source.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "DEFAULT_MEETING_LINK"
                for target in node.targets)
    )
    tree = ast.Module(
        body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), *nodes],
        type_ignores=[],
    )
    namespace = dict(
        datetime=datetime, timezone=timezone, ZoneInfo=ZoneInfo, Session=object,
        Appointment=Appointment, WidgetConfig=WidgetConfig, Organization=Organization,
        get_notification_recipients=Mock(return_value=([], None)),
        send_appointment_rescheduled_notification=Mock(return_value=(True, [])),
    )
    exec(compile(ast.fix_missing_locations(tree), str(path), "exec"), namespace)
    return namespace


class AppointmentReschedulingTests(unittest.TestCase):
    def setUp(self):
        self.ns = load_operation()
        self.now = datetime.now(ZoneInfo("Asia/Kolkata"))
        self.original = NS(
            id=21, session_id="session-1", organization_id=7, widget_id="widget-1",
            status="booked", appointment_at=self.now.replace(hour=19, minute=0, second=0, microsecond=0)
            + __import__("datetime").timedelta(days=1), timezone="Asia/Kolkata",
            name="Customer", email="customer@example.com", phone=None, notes=None,
        )

    def update(self, db, appointment, new_at):
        return self.ns["reschedule_appointment_record"](
            db, appointment, new_at, "Asia/Kolkata"
        )

    def test_updates_same_appointment_record_and_repeat_does_not_duplicate(self):
        db = Database([self.original])
        target = self.original.appointment_at.replace(hour=15)
        first = self.update(db, self.original, target)
        second = self.update(db, self.original, target)
        self.assertIs(first["appointment"], self.original)
        self.assertIs(second["appointment"], self.original)
        self.assertEqual(self.original.appointment_at, target)
        self.assertEqual(len(db.appointments), 1)
        self.assertEqual(db.commit_count, 2)

    def test_exact_slot_conflict_leaves_existing_appointment_unchanged(self):
        other = NS(**vars(self.original))
        other.id = 22
        target = self.now.replace(hour=15, minute=0, second=0, microsecond=0) + __import__("datetime").timedelta(days=1)
        other.appointment_at = target
        db = Database([self.original, other])
        original_time = self.original.appointment_at
        with self.assertRaises(self.ns["AppointmentSlotUnavailable"]):
            self.update(db, self.original, target)
        self.assertEqual(self.original.appointment_at, original_time)
        self.assertEqual(db.commit_count, 0)
        self.ns["send_appointment_rescheduled_notification"].assert_not_called()

    def test_persistence_failure_rolls_back_and_never_notifies_success(self):
        db = Database([self.original], fail_commit=True)
        target = self.original.appointment_at.replace(hour=15)
        with self.assertRaisesRegex(RuntimeError, "simulated persistence failure"):
            self.update(db, self.original, target)
        db.rollback.assert_called_once()
        self.ns["send_appointment_rescheduled_notification"].assert_not_called()

    def test_past_slot_is_rejected_without_changing_existing_booking(self):
        db = Database([self.original])
        original_time = self.original.appointment_at
        past = datetime(2000, 1, 1, 10, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
        with self.assertRaisesRegex(ValueError, "future"):
            self.update(db, self.original, past)
        self.assertEqual(self.original.appointment_at, original_time)
        self.assertEqual(db.commit_count, 0)
        self.ns["send_appointment_rescheduled_notification"].assert_not_called()


if __name__ == "__main__":
    unittest.main()
