"""Frozen-clock coverage for natural appointment date/time resolution."""
from datetime import datetime
from dataclasses import dataclass
import ast
import re
from pathlib import Path
from typing import Literal
import unittest
from zoneinfo import ZoneInfo

from dateutil import parser as dateutil_parser

ROOT = Path(__file__).parent


ZONE = ZoneInfo("Asia/Kolkata")
FROZEN_NOW = datetime(2026, 10, 17, 12, 0, tzinfo=ZONE)


def load_resolver():
    import ast
    from pathlib import Path

    path = ROOT / "app/services/appointment_datetime.py"
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names = {
        "AppointmentDateTimeResolution", "_local_now", "_replace_relative_date",
        "_parse_date", "_parse_time", "resolve_appointment_datetime",
    }
    names.update({"_DATE_MARKER", "_TIME_MARKER", "_WEEKDAYS", "_MONTHS"})
    nodes = [
        node for node in tree.body
        if getattr(node, "name", None) in names
        or isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id in names for target in node.targets)
    ]
    # Build the production resolver namespace without importing the eager app package.
    from datetime import date, datetime, time, timedelta
    from zoneinfo import ZoneInfo
    namespace = dict(
        dataclass=dataclass, Literal=Literal, re=re, date=date, datetime=datetime,
        time=time, timedelta=timedelta, ZoneInfo=ZoneInfo,
        dateutil_parser=dateutil_parser,
    )
    tree = ast.Module(
        body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), *nodes],
        type_ignores=[],
    )
    exec(
        compile(ast.fix_missing_locations(tree), str(path), "exec"),
        namespace,
    )
    return namespace["resolve_appointment_datetime"]


resolve = load_resolver()


class AppointmentDateTimeTests(unittest.TestCase):
    def resolve_at_frozen_time(self, text, now=FROZEN_NOW):
        return resolve(text, "Asia/Kolkata", now)

    def test_relative_and_absolute_datetime_examples(self):
        expected = {
            "tom at 4 pm": datetime(2026, 10, 18, 16, 0, tzinfo=ZONE),
            "tmrw 4pm": datetime(2026, 10, 18, 16, 0, tzinfo=ZONE),
            "tmr 4 pm": datetime(2026, 10, 18, 16, 0, tzinfo=ZONE),
            "day after tomorrow 11 am": datetime(2026, 10, 19, 11, 0, tzinfo=ZONE),
            "20 October, at 10:30 AM": datetime(2026, 10, 20, 10, 30, tzinfo=ZONE),
            "2026-10-20 16:00": datetime(2026, 10, 20, 16, 0, tzinfo=ZONE),
            "next Monday at 4:30 pm": datetime(2026, 10, 19, 16, 30, tzinfo=ZONE),
        }
        for text, value in expected.items():
            with self.subTest(text=text):
                result = self.resolve_at_frozen_time(text)
                self.assertEqual(result.kind, "datetime")
                self.assertEqual(result.value, value)

    def test_today_datetime_is_resolved_and_evaluated_against_clock(self):
        result = self.resolve_at_frozen_time("today at 4 pm")
        self.assertEqual(result.kind, "datetime")
        self.assertEqual(result.value, datetime(2026, 10, 17, 16, 0, tzinfo=ZONE))
        before_slot = datetime(2026, 10, 17, 15, 0, tzinfo=ZONE)
        after_slot = datetime(2026, 10, 17, 17, 0, tzinfo=ZONE)
        self.assertGreater(result.value, before_slot)
        self.assertLess(result.value, after_slot)

    def test_past_datetime_is_still_resolved_for_existing_past_validation(self):
        result = self.resolve_at_frozen_time("16 October 2026 at 4 pm")
        self.assertEqual(result.value, datetime(2026, 10, 16, 16, 0, tzinfo=ZONE))
        self.assertLess(result.value, FROZEN_NOW)

    def test_split_date_and_time_resolve_as_independent_values(self):
        date_result = self.resolve_at_frozen_time("tom")
        time_result = self.resolve_at_frozen_time("4 pm")
        self.assertEqual((date_result.kind, date_result.value.isoformat()), ("date", "2026-10-18"))
        self.assertEqual((time_result.kind, time_result.value.strftime("%H:%M")), ("time", "16:00"))

    def test_ambiguous_hour_requires_clarification(self):
        result = self.resolve_at_frozen_time("tom at 4")
        self.assertEqual(result.kind, "ambiguous")
        self.assertIsNone(result.value)

    def test_ordinary_chat_is_not_misclassified_as_date_or_time(self):
        result = self.resolve_at_frozen_time("I would like to know more about AI")
        self.assertEqual(result.kind, "none")
