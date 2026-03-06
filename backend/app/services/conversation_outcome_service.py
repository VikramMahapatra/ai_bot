import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Conversation

import logging

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAPI_KEY2)

VALID_OUTCOMES = {
    "positive",
    "negative",
    "satisfactory",
    "neutral",
    "unresolved",
    "other",
}


def _normalize_outcome(value: Optional[str]) -> str:
    if not value:
        return "other"

    normalized = value.strip().lower()
    if normalized in VALID_OUTCOMES:
        return normalized

    aliases = {
        "satisfied": "satisfactory",
        "satisfaction": "satisfactory",
        "good": "positive",
        "bad": "negative",
        "unknown": "other",
    }
    return aliases.get(normalized, "other")


def _build_transcript(rows: List[Conversation]) -> str:
    lines: List[str] = []
    for row in rows[:120]:
        if row.message and row.message.strip():
            lines.append(f"User: {row.message.strip()}")
        if row.response and row.response.strip():
            lines.append(f"Assistant: {row.response.strip()}")
    return "\n".join(lines)


def _classify_outcome_with_llm(transcript: str) -> str:
    if not transcript.strip():
        return "other"

    response = client.chat.completions.create(
        model=settings.OUTCOME_CLASSIFICATION_MODEL,
        temperature=0,
        max_tokens=12,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a conversation-quality classifier. "
                    "Classify the full session outcome into exactly one label from: "
                    "positive, negative, satisfactory, neutral, unresolved, other. "
                    "Return only the label, nothing else."
                ),
            },
            {
                "role": "user",
                "content": f"Session transcript:\n{transcript}",
            },
        ],
    )

    content = response.choices[0].message.content if response.choices else None
    return _normalize_outcome(content)


def process_pending_session_outcomes(db: Session, batch_size: int = 100, organization_id: Optional[int] = None) -> Tuple[int, int]:
    """Process pending session outcomes where conversation.outcome is NULL.

    Returns tuple: (processed_count, failed_count)
    """
    pending_query = db.query(
        Conversation.organization_id,
        Conversation.session_id,
    ).filter(
        Conversation.session_id.isnot(None),
        Conversation.outcome.is_(None),
    )

    if organization_id is not None:
        pending_query = pending_query.filter(Conversation.organization_id == organization_id)

    pending_sessions = pending_query.group_by(
        Conversation.organization_id,
        Conversation.session_id,
    ).limit(batch_size).all()

    processed = 0
    failed = 0

    for org_id, session_id in pending_sessions:
        try:
            rows = db.query(Conversation).filter(
                Conversation.organization_id == org_id,
                Conversation.session_id == session_id,
            ).order_by(Conversation.created_at.asc()).all()

            if not rows:
                continue

            transcript = _build_transcript(rows)
            outcome = _classify_outcome_with_llm(transcript)

            db.query(Conversation).filter(
                Conversation.organization_id == org_id,
                Conversation.session_id == session_id,
                Conversation.outcome.is_(None),
            ).update(
                {Conversation.outcome: outcome},
                synchronize_session=False,
            )

            db.commit()
            processed += 1
        except Exception as exc:
            db.rollback()
            failed += 1
            logger.error(
                "Failed to process outcome for org=%s session=%s: %s",
                org_id,
                session_id,
                str(exc),
                exc_info=True,
            )

    return processed, failed


def run_outcome_processing_batches(batch_size: int, max_batches: int, organization_id: Optional[int] = None) -> Tuple[int, int]:
    total_processed = 0
    total_failed = 0

    db = SessionLocal()
    try:
        for _ in range(max_batches):
            processed, failed = process_pending_session_outcomes(
                db,
                batch_size=batch_size,
                organization_id=organization_id,
            )
            total_processed += processed
            total_failed += failed
            if processed == 0:
                break
    finally:
        db.close()

    return total_processed, total_failed


def _seconds_until_next_run(hour_utc: int, minute_utc: int) -> float:
    now = datetime.now(timezone.utc)
    target = now.replace(hour=hour_utc, minute=minute_utc, second=0, microsecond=0)
    if now >= target:
        target = target + timedelta(days=1)
    return max((target - now).total_seconds(), 1.0)


async def run_daily_outcome_daemon(stop_event: asyncio.Event) -> None:
    """Run outcome processing once at startup, then once per day at configured UTC time."""
    initial_delay = max(settings.OUTCOME_DAEMON_INITIAL_DELAY_SECONDS, 0)
    if initial_delay:
        await asyncio.sleep(initial_delay)

    try:
        processed, failed = run_outcome_processing_batches(
            batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
            max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
        )
        logger.info(
            "Initial outcome processing completed: processed=%s failed=%s",
            processed,
            failed,
        )
    except Exception as exc:
        logger.error("Initial outcome processing failed: %s", str(exc), exc_info=True)

    while not stop_event.is_set():
        wait_seconds = _seconds_until_next_run(
            settings.OUTCOME_DAEMON_HOUR_UTC,
            settings.OUTCOME_DAEMON_MINUTE_UTC,
        )

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
            break
        except asyncio.TimeoutError:
            pass

        try:
            processed, failed = run_outcome_processing_batches(
                batch_size=settings.OUTCOME_DAEMON_BATCH_SIZE,
                max_batches=settings.OUTCOME_DAEMON_MAX_BATCHES,
            )
            logger.info(
                "Scheduled outcome processing completed: processed=%s failed=%s",
                processed,
                failed,
            )
        except Exception as exc:
            logger.error("Scheduled outcome processing failed: %s", str(exc), exc_info=True)
