"""Resolve appointment date/time phrases in an explicit business timezone."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from dateutil import parser as dateutil_parser


ResolutionKind = Literal["datetime", "date", "time", "ambiguous", "none"]


@dataclass(frozen=True)
class AppointmentDateTimeResolution:
    kind: ResolutionKind
    value: datetime | date | time | None = None


_DATE_MARKER = re.compile(
    r"\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|"
    r"\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
    r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|"
    r"oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)|"
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?|"
    r"today|tomorrow|tom|tmrw|tmr|day\s+after\s+tomorrow|"
    r"(?:next\s+)?(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|"
    r"fri(?:day)?|sat(?:urday)?|sun(?:day)?)|"
    r"\d{1,2}\s+days?\s+from\s+now)\b",
    re.IGNORECASE,
)
_TIME_MARKER = re.compile(
    r"\b(?:noon|midnight|(?:[01]?\d|2[0-3]):[0-5]\d|"
    r"(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?))\b",
    re.IGNORECASE,
)
_WEEKDAYS = {
    "mon": 0, "monday": 0, "tue": 1, "tues": 1, "tuesday": 1,
    "wed": 2, "wednesday": 2, "thu": 3, "thur": 3, "thurs": 3,
    "thursday": 3, "fri": 4, "friday": 4, "sat": 5, "saturday": 5,
    "sun": 6, "sunday": 6,
}
_MONTHS = (
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    "jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|"
    "nov(?:ember)?|dec(?:ember)?"
)


def _local_now(timezone_name: str, now: datetime | None) -> datetime:
    zone = ZoneInfo(timezone_name)
    current = now or datetime.now(zone)
    if current.tzinfo is None:
        return current.replace(tzinfo=zone)
    return current.astimezone(zone)


def _replace_relative_date(text: str, current: datetime) -> str:
    """Expand relative-date words before dateutil sees the remaining phrase."""
    candidate = text
    tomorrow = (current.date() + timedelta(days=1)).strftime("%d %B %Y")
    day_after = (current.date() + timedelta(days=2)).strftime("%d %B %Y")
    today = current.date().strftime("%d %B %Y")

    candidate = re.sub(r"\bday\s+after\s+tomorrow\b", day_after, candidate, flags=re.I)
    candidate = re.sub(r"\b(?:tomorrow|tmrw|tmr|tom)\b", tomorrow, candidate, flags=re.I)
    candidate = re.sub(r"\btoday\b", today, candidate, flags=re.I)

    def days_from_now(match: re.Match[str]) -> str:
        days = int(match.group(1))
        return (current.date() + timedelta(days=days)).strftime("%d %B %Y")

    candidate = re.sub(r"\b(\d{1,2})\s+days?\s+from\s+now\b", days_from_now, candidate, flags=re.I)

    weekday_pattern = re.compile(
        r"\b(?:(next)\s+)?(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|"
        r"thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b",
        re.I,
    )

    def weekday_date(match: re.Match[str]) -> str:
        key = match.group(2).lower()
        target = _WEEKDAYS[key]
        days_ahead = (target - current.weekday()) % 7
        if match.group(1) and days_ahead == 0:
            days_ahead = 7
        target_date = current.date() + timedelta(days=days_ahead)
        return target_date.strftime("%d %B %Y")

    return weekday_pattern.sub(weekday_date, candidate)


def _parse_date(candidate: str, current: datetime) -> date | None:
    expanded = _replace_relative_date(candidate, current)
    # dateutil's fuzzy mode tolerates natural glue such as "on" and "at";
    # require an explicit date marker first so ordinary chat is never guessed.
    try:
        parsed = dateutil_parser.parse(
            expanded,
            dayfirst=True,
            fuzzy=True,
            default=current.replace(hour=0, minute=0, second=0, microsecond=0),
        )
    except (ValueError, OverflowError, TypeError):
        return None
    return parsed.date()


def _parse_time(candidate: str, current: datetime) -> tuple[time | None, bool]:
    """Return a time and whether a bare 12-hour value needs clarification."""
    normalized = candidate.strip().lower().replace(".", "")
    if re.search(r"\bnoon\b", normalized):
        return time(12, 0), False
    if re.search(r"\bmidnight\b", normalized):
        return time(0, 0), False

    match = re.search(
        r"(?<!\d)(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b",
        normalized,
        re.I,
    )
    if match:
        hour, minute = int(match.group(1)), int(match.group(2) or 0)
        meridiem = match.group(3)[0].lower()
        if not 1 <= hour <= 12:
            return None, False
        hour = hour % 12 + (12 if meridiem == "p" else 0)
        return time(hour, minute), False

    match = re.search(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)", normalized)
    if match:
        return time(int(match.group(1)), int(match.group(2))), False

    # An hour without a meridiem is not enough to choose AM vs PM.
    bare_hour = re.search(r"\b(?:at\s+)?(1[0-2]|0?[1-9])\b", normalized)
    if bare_hour:
        return None, True
    return None, False


def resolve_appointment_datetime(
    text: str,
    timezone_name: str = "Asia/Kolkata",
    now: datetime | None = None,
) -> AppointmentDateTimeResolution:
    """Resolve a visitor phrase as a complete datetime, date, time, or clarification.

    Relative dates and weekday names use ``now`` in the supplied IANA timezone.
    A bare 12-hour value is marked ambiguous instead of silently choosing AM/PM.
    """
    raw = (text or "").strip()
    if not raw:
        return AppointmentDateTimeResolution("none")
    current = _local_now(timezone_name, now)
    has_date = bool(_DATE_MARKER.search(raw))
    parsed_time, ambiguous_time = _parse_time(raw, current)
    has_time = parsed_time is not None or ambiguous_time

    if has_date:
        parsed_date = _parse_date(raw, current)
        if parsed_date is None:
            return AppointmentDateTimeResolution("ambiguous")
        if ambiguous_time:
            return AppointmentDateTimeResolution("ambiguous")
        if parsed_time is None:
            return AppointmentDateTimeResolution("date", parsed_date)
        return AppointmentDateTimeResolution(
            "datetime",
            datetime.combine(parsed_date, parsed_time, tzinfo=current.tzinfo),
        )

    if has_time:
        if ambiguous_time:
            return AppointmentDateTimeResolution("ambiguous")
        return AppointmentDateTimeResolution("time", parsed_time)
    return AppointmentDateTimeResolution("none")
