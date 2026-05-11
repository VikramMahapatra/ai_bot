from __future__ import annotations

import asyncio
import json
import importlib.util
from pathlib import Path
from types import SimpleNamespace


def _load_intent_service():
    service_path = Path(__file__).resolve().parent / "app" / "services" / "intent_service.py"
    spec = importlib.util.spec_from_file_location("intent_service_test_module", service_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module spec from {service_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_intent_schema():
    schema_path = Path(__file__).resolve().parent / "app" / "schemas" / "intent.py"
    spec = importlib.util.spec_from_file_location("intent_schema_test_module", schema_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module spec from {schema_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


intent_service = _load_intent_service()
intent_schema = _load_intent_schema()
IntentType = intent_schema.IntentType
ConversationActionType = intent_schema.ConversationActionType


class _FakeResponse:
    def __init__(self, content: str):
        self.choices = [SimpleNamespace(message=SimpleNamespace(content=content))]


class _FakeCompletions:
    def __init__(self, content: str | None = None, exc: Exception | None = None):
        self._content = content
        self._exc = exc

    def create(self, *args, **kwargs):
        if self._exc:
            raise self._exc
        return _FakeResponse(self._content or "{}")


class _FakeClient:
    def __init__(self, content: str | None = None, exc: Exception | None = None):
        self.chat = SimpleNamespace(completions=_FakeCompletions(content=content, exc=exc))


def _run(coro):
    return asyncio.run(coro)


def _swap_client(new_client):
    original = intent_service.client
    intent_service.client = new_client
    return original


def test_detect_intent_booking_and_entities_from_llm():
    payload = {
        "primary_intent": "book_appointment",
        "confidence": 0.98,
        "entities": {
            "datetime": "2026-05-14T15:30:00+05:30",
            "timezone": "Asia/Kolkata",
        },
        "reasoning": "User explicitly asked to book a meeting.",
    }
    original = _swap_client(_FakeClient(content=json.dumps(payload)))
    try:
        result = _run(
            intent_service.detect_intent(
                user_message="Please book a meeting for tomorrow at 3:30 PM.",
                previous_assistant_message="Would you like to book an appointment?",
                active_intake_field=None,
                handoff_active=False,
                conversation_context={"session_id": "sess-1"},
            )
        )
    finally:
        intent_service.client = original

    assert result.primary_intent == IntentType.BOOK_APPOINTMENT
    assert result.confidence == 0.98
    assert result.entities["timezone"] == "Asia/Kolkata"
    assert result.entities["datetime"] == "2026-05-14T15:30:00+05:30"


def test_detect_intent_hinglish_human_request_and_action_mapping():
    payload = {
        "primary_intent": "request_human",
        "confidence": 0.93,
        "entities": {},
        "reasoning": "User asked to talk to a real person.",
    }
    original = _swap_client(_FakeClient(content=json.dumps(payload)))
    try:
        result = _run(
            intent_service.detect_intent(
                user_message="mujhe kisi se baat karni hai",
                previous_assistant_message=None,
                active_intake_field=None,
                handoff_active=False,
                conversation_context={"session_id": "sess-2"},
            )
        )
        action = _run(
            intent_service.classify_conversation_action(
                user_message="mujhe kisi se baat karni hai",
                previous_assistant_message=None,
                active_intake_field=None,
                handoff_active=False,
                conversation_context={"session_id": "sess-2"},
            )
        )
    finally:
        intent_service.client = original

    assert result.primary_intent == IntentType.REQUEST_HUMAN
    assert action.action == ConversationActionType.START_HANDOFF_FLOW
    assert action.intent.primary_intent == IntentType.REQUEST_HUMAN


def test_detect_intent_small_talk_and_confirmation():
    payload = {
        "primary_intent": "small_talk",
        "confidence": 0.88,
        "entities": {},
        "reasoning": "Greeting only.",
    }
    original = _swap_client(_FakeClient(content=json.dumps(payload)))
    try:
        result = _run(
            intent_service.detect_intent(
                user_message="Thanks!",
                previous_assistant_message="Happy to help.",
                active_intake_field=None,
                handoff_active=False,
                conversation_context={"session_id": "sess-3"},
            )
        )
    finally:
        intent_service.client = original

    assert result.primary_intent == IntentType.SMALL_TALK
    assert result.confidence == 0.88


def test_detect_intent_falls_back_on_malformed_json():
    original = _swap_client(_FakeClient(content="not-json"))
    try:
        result = _run(
            intent_service.detect_intent(
                user_message="I need a human agent",
                previous_assistant_message=None,
                active_intake_field=None,
                handoff_active=False,
                conversation_context={"session_id": "sess-4"},
            )
        )
    finally:
        intent_service.client = original

    assert result.primary_intent == IntentType.REQUEST_HUMAN
    assert result.confidence >= 0.8


def test_detect_intent_falls_back_on_client_error():
    original = _swap_client(_FakeClient(exc=RuntimeError("boom")))
    try:
        result = _run(
            intent_service.detect_intent(
                user_message="book appointment tomorrow 4 pm",
                previous_assistant_message=None,
                active_intake_field=None,
                handoff_active=False,
                conversation_context={"session_id": "sess-5"},
            )
        )
        entities = _run(
            intent_service.extract_entities(
                user_message="book appointment tomorrow 4 pm",
                previous_assistant_message=None,
                active_intake_field=None,
                handoff_active=False,
                conversation_context={"session_id": "sess-5"},
            )
        )
    finally:
        intent_service.client = original

    assert result.primary_intent in {IntentType.BOOK_APPOINTMENT, IntentType.PROVIDE_DATETIME}
    assert "datetime" in entities or result.primary_intent == IntentType.BOOK_APPOINTMENT
