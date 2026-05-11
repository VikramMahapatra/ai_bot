import hashlib
import json
import logging
import importlib.util
import re
import time
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Optional, Tuple

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - environment dependent
    OpenAI = None

from app.config import settings
from app.prompts.intent_classifier_prompt import (
    INTENT_CLASSIFIER_JSON_SCHEMA,
    get_intent_request_messages,
)


def _load_intent_schema_module():
    schema_path = Path(__file__).resolve().parents[1] / "schemas" / "intent.py"
    spec = importlib.util.spec_from_file_location("app_intent_schema_runtime", schema_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load intent schema module from {schema_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_intent_schema = _load_intent_schema_module()
ConversationActionResult = _intent_schema.ConversationActionResult
ConversationActionType = _intent_schema.ConversationActionType
IntentDetectionResult = _intent_schema.IntentDetectionResult
IntentType = _intent_schema.IntentType


logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.OPENAPI_KEY2) if OpenAI else None

_INTENT_CACHE_TTL_SECONDS = 60
_INTENT_CACHE_MAX_ITEMS = 500
_intent_cache: Dict[str, Tuple[float, IntentDetectionResult]] = {}
_intent_cache_lock = Lock()


@dataclass(frozen=True)
class _IntentInputs:
    user_message: str
    previous_assistant_message: Optional[str]
    active_intake_field: Optional[str]
    handoff_active: bool
    conversation_context: Optional[Dict[str, Any]]


_KEYWORD_FALLBACKS = {
    IntentType.BOOK_APPOINTMENT: ["book", "schedule", "appointment", "meeting", "call", "demo", "slot"],
    IntentType.RESCHEDULE_APPOINTMENT: ["reschedule", "change", "move", "different time", "another time"],
    IntentType.CANCEL_APPOINTMENT: ["cancel", "stop", "call off", "never mind", "nevermind"],
    IntentType.REQUEST_HUMAN: ["human", "agent", "person", "support", "team", "expert", "representative"],
    IntentType.CONFIRM: ["yes", "yeah", "yep", "sure", "ok", "okay", "please do", "go ahead"],
    IntentType.DENY: ["no", "nope", "nah", "not now", "dont", "don't"],
    IntentType.SMALL_TALK: ["hi", "hello", "hey", "thanks", "thank you", "good morning", "good afternoon"],
    IntentType.WAIT_MORE: ["wait", "wait more", "continue waiting", "more minutes", "try again"],
}

_ENTITY_PATTERNS = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "phone": re.compile(r"\+?\d[\d\s\-()]{7,}\d"),
    "timezone": re.compile(r"\b[A-Za-z_]+/[A-Za-z_]+\b"),
}


def _cache_key(inputs: _IntentInputs) -> str:
    context = inputs.conversation_context or {}
    session_key = str(context.get("session_id") or context.get("chat_id") or "")
    payload = {
        "session_key": session_key,
        "user_message": (inputs.user_message or "").strip().lower(),
        "previous_assistant_message": (inputs.previous_assistant_message or "").strip().lower(),
        "active_intake_field": inputs.active_intake_field or "",
        "handoff_active": bool(inputs.handoff_active),
        "context": {
            key: context.get(key)
            for key in sorted(context.keys())
            if key not in {"message", "user_message", "conversation_text", "email", "phone"}
        },
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    return digest


def _get_cached_intent(cache_key: str) -> Optional[IntentDetectionResult]:
    now = time.monotonic()
    with _intent_cache_lock:
        cached = _intent_cache.get(cache_key)
        if cached and (now - cached[0]) <= _INTENT_CACHE_TTL_SECONDS:
            return cached[1]
        if cached:
            _intent_cache.pop(cache_key, None)
    return None


def _store_cached_intent(cache_key: str, result: IntentDetectionResult) -> None:
    with _intent_cache_lock:
        _intent_cache[cache_key] = (time.monotonic(), result)
        if len(_intent_cache) > _INTENT_CACHE_MAX_ITEMS:
            oldest_key = min(_intent_cache, key=lambda key: _intent_cache[key][0])
            _intent_cache.pop(oldest_key, None)


def _normalize_entities(entities: object) -> Dict[str, Any]:
    if not isinstance(entities, dict):
        return {}

    normalized: Dict[str, Any] = {}
    for key, value in entities.items():
        if value is None:
            continue
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned:
                normalized[str(key)] = cleaned
        else:
            normalized[str(key)] = value
    return normalized


def _extract_entities_from_text(text: str) -> Dict[str, Any]:
    entities: Dict[str, Any] = {}
    if not text:
        return entities

    email_match = _ENTITY_PATTERNS["email"].search(text)
    if email_match:
        entities["email"] = email_match.group(0)

    phone_match = _ENTITY_PATTERNS["phone"].search(text)
    if phone_match:
        entities["phone"] = phone_match.group(0)

    timezone_match = _ENTITY_PATTERNS["timezone"].search(text)
    if timezone_match:
        entities["timezone"] = timezone_match.group(0)

    return entities


def _fallback_intent(inputs: _IntentInputs) -> IntentDetectionResult:
    text = (inputs.user_message or "").strip().lower()
    previous = (inputs.previous_assistant_message or "").strip().lower()
    active_field = (inputs.active_intake_field or "").strip().lower()
    entities = _extract_entities_from_text(inputs.user_message or "")

    if active_field == "name":
        return IntentDetectionResult(primary_intent=IntentType.PROVIDE_NAME, confidence=0.74, entities=entities)
    if active_field == "email":
        if "email" in entities:
            return IntentDetectionResult(primary_intent=IntentType.PROVIDE_EMAIL, confidence=0.86, entities=entities)
    if active_field == "contact":
        if "email" in entities:
            return IntentDetectionResult(primary_intent=IntentType.PROVIDE_EMAIL, confidence=0.81, entities=entities)
        if "phone" in entities:
            return IntentDetectionResult(primary_intent=IntentType.PROVIDE_PHONE, confidence=0.81, entities=entities)
    if active_field in {"appointment_at", "timezone"}:
        if "timezone" in entities:
            return IntentDetectionResult(primary_intent=IntentType.PROVIDE_TIMEZONE, confidence=0.84, entities=entities)
        if any(token in text for token in ["am", "pm", ":", "tomorrow", "today", "kal", "next"]):
            return IntentDetectionResult(primary_intent=IntentType.PROVIDE_DATETIME, confidence=0.76, entities=entities)

    if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.REQUEST_HUMAN]):
        return IntentDetectionResult(primary_intent=IntentType.REQUEST_HUMAN, confidence=0.82, entities=entities)
    if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.BOOK_APPOINTMENT]):
        return IntentDetectionResult(primary_intent=IntentType.BOOK_APPOINTMENT, confidence=0.8, entities=entities)
    if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.RESCHEDULE_APPOINTMENT]):
        return IntentDetectionResult(primary_intent=IntentType.RESCHEDULE_APPOINTMENT, confidence=0.77, entities=entities)
    if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.CANCEL_APPOINTMENT]):
        return IntentDetectionResult(primary_intent=IntentType.CANCEL_APPOINTMENT, confidence=0.79, entities=entities)
    if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.WAIT_MORE]):
        return IntentDetectionResult(primary_intent=IntentType.WAIT_MORE, confidence=0.7, entities=entities)
    if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.CONFIRM]):
        return IntentDetectionResult(primary_intent=IntentType.CONFIRM, confidence=0.73, entities=entities)
    if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.DENY]):
        return IntentDetectionResult(primary_intent=IntentType.DENY, confidence=0.73, entities=entities)
    if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.SMALL_TALK]):
        return IntentDetectionResult(primary_intent=IntentType.SMALL_TALK, confidence=0.72, entities=entities)
    if active_field:
        if active_field == "timezone":
            return IntentDetectionResult(primary_intent=IntentType.PROVIDE_TIMEZONE, confidence=0.7, entities=entities)
        if active_field == "appointment_at":
            return IntentDetectionResult(primary_intent=IntentType.PROVIDE_DATETIME, confidence=0.68, entities=entities)

    if previous and any(token in previous for token in ["would you like", "please share", "can you provide"]):
        if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.CONFIRM]):
            return IntentDetectionResult(primary_intent=IntentType.CONFIRM, confidence=0.7, entities=entities)
        if any(token in text for token in _KEYWORD_FALLBACKS[IntentType.DENY]):
            return IntentDetectionResult(primary_intent=IntentType.DENY, confidence=0.7, entities=entities)

    if entities.get("email"):
        return IntentDetectionResult(primary_intent=IntentType.PROVIDE_EMAIL, confidence=0.8, entities=entities)
    if entities.get("phone"):
        return IntentDetectionResult(primary_intent=IntentType.PROVIDE_PHONE, confidence=0.78, entities=entities)
    if entities.get("timezone"):
        return IntentDetectionResult(primary_intent=IntentType.PROVIDE_TIMEZONE, confidence=0.74, entities=entities)

    return IntentDetectionResult(primary_intent=IntentType.GENERAL_CHAT, confidence=0.5, entities=entities)


def _validate_result(parsed: object, inputs: _IntentInputs, used_fallback: bool) -> IntentDetectionResult:
    fallback = _fallback_intent(inputs)
    if not isinstance(parsed, dict):
        logger.warning("Intent classifier returned non-object JSON; using fallback")
        return fallback

    raw_intent = str(parsed.get("primary_intent") or "").strip()
    try:
        primary_intent = IntentType(raw_intent)
    except Exception:
        logger.warning("Intent classifier returned invalid intent '%s'; using fallback", raw_intent)
        return fallback

    confidence_raw = parsed.get("confidence", fallback.confidence)
    try:
        confidence = float(confidence_raw)
    except Exception:
        confidence = fallback.confidence
    confidence = max(0.0, min(1.0, confidence))

    entities = _normalize_entities(parsed.get("entities") or {})
    if not entities:
        entities = dict(fallback.entities)

    reasoning = parsed.get("reasoning")
    if reasoning is not None:
        reasoning = str(reasoning).strip() or None

    result = IntentDetectionResult(
        primary_intent=primary_intent,
        confidence=confidence,
        entities=entities,
        reasoning=reasoning,
    )
    if used_fallback:
        logger.info(
            "Intent classifier fallback normalized intent=%s confidence=%.3f",
            result.primary_intent.value,
            result.confidence,
        )
    return result


async def detect_intent(
    user_message: str,
    previous_assistant_message: Optional[str],
    active_intake_field: Optional[str],
    handoff_active: bool,
    conversation_context: Optional[dict] = None,
) -> IntentDetectionResult:
    inputs = _IntentInputs(
        user_message=user_message or "",
        previous_assistant_message=previous_assistant_message,
        active_intake_field=active_intake_field,
        handoff_active=handoff_active,
        conversation_context=conversation_context,
    )
    cache_key = _cache_key(inputs)
    cached = _get_cached_intent(cache_key)
    if cached:
        logger.info(
            "Intent classifier cache hit intent=%s confidence=%.3f",
            cached.primary_intent.value,
            cached.confidence,
        )
        return cached

    if client is None:
        result = _fallback_intent(inputs)
        logger.info(
            "Intent classifier fallback used because OpenAI SDK is unavailable intent=%s confidence=%.3f",
            result.primary_intent.value,
            result.confidence,
        )
        _store_cached_intent(cache_key, result)
        return result

    try:
        messages = get_intent_request_messages(
            user_message=user_message,
            previous_assistant_message=previous_assistant_message,
            active_intake_field=active_intake_field,
            handoff_active=handoff_active,
            conversation_context=conversation_context,
        )
        response_format = {
            "type": "json_schema",
            "json_schema": INTENT_CLASSIFIER_JSON_SCHEMA,
        }
        try:
            response = client.chat.completions.create(
                model=settings.OPENAI_CHAT_MODEL,
                temperature=0,
                messages=messages,
                response_format=response_format,
                timeout=float(settings.OPENAI_CHAT_TIMEOUT_SECONDS),
            )
        except Exception:
            response = client.chat.completions.create(
                model=settings.OPENAI_CHAT_MODEL,
                temperature=0,
                messages=messages,
                response_format={"type": "json_object"},
                timeout=float(settings.OPENAI_CHAT_TIMEOUT_SECONDS),
            )

        content = response.choices[0].message.content if response.choices else ""
        if not content:
            raise RuntimeError("Empty intent classifier response")

        parsed = json.loads(content)
        result = _validate_result(parsed, inputs, used_fallback=False)
        logger.info(
            "Intent detected intent=%s confidence=%.3f handoff_active=%s active_field=%s",
            result.primary_intent.value,
            result.confidence,
            bool(handoff_active),
            active_intake_field or "",
        )
        _store_cached_intent(cache_key, result)
        return result
    except Exception as exc:
        logger.warning("Intent classifier failed; using fallback: %s", str(exc))
        result = _fallback_intent(inputs)
        _store_cached_intent(cache_key, result)
        return result


async def extract_entities(
    user_message: str,
    previous_assistant_message: Optional[str] = None,
    active_intake_field: Optional[str] = None,
    handoff_active: bool = False,
    conversation_context: Optional[dict] = None,
) -> Dict[str, Any]:
    intent = await detect_intent(
        user_message=user_message,
        previous_assistant_message=previous_assistant_message,
        active_intake_field=active_intake_field,
        handoff_active=handoff_active,
        conversation_context=conversation_context,
    )
    return dict(intent.entities)


async def classify_conversation_action(
    user_message: str,
    previous_assistant_message: Optional[str],
    active_intake_field: Optional[str],
    handoff_active: bool,
    conversation_context: Optional[dict] = None,
) -> ConversationActionResult:
    intent = await detect_intent(
        user_message=user_message,
        previous_assistant_message=previous_assistant_message,
        active_intake_field=active_intake_field,
        handoff_active=handoff_active,
        conversation_context=conversation_context,
    )

    action_map = {
        IntentType.BOOK_APPOINTMENT: ConversationActionType.START_APPOINTMENT_FLOW,
        IntentType.RESCHEDULE_APPOINTMENT: ConversationActionType.START_APPOINTMENT_FLOW,
        IntentType.CANCEL_APPOINTMENT: ConversationActionType.START_APPOINTMENT_FLOW,
        IntentType.REQUEST_HUMAN: ConversationActionType.START_HANDOFF_FLOW,
        IntentType.CONFIRM: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.DENY: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.PROVIDE_NAME: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.PROVIDE_EMAIL: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.PROVIDE_PHONE: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.PROVIDE_DATETIME: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.PROVIDE_TIMEZONE: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.SMALL_TALK: ConversationActionType.ACKNOWLEDGE_SMALL_TALK,
        IntentType.WAIT_MORE: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.OUT_OF_SCOPE: ConversationActionType.CONTINUE_CONVERSATION,
        IntentType.GENERAL_CHAT: ConversationActionType.CONTINUE_CONVERSATION,
    }
    action = action_map.get(intent.primary_intent, ConversationActionType.NOOP)

    return ConversationActionResult(
        action=action,
        confidence=intent.confidence,
        intent=intent,
        reasoning=intent.reasoning,
    )
