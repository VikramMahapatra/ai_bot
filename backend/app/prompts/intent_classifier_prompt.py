import json
from typing import Any, Dict, List, Optional


INTENT_TYPE_VALUES = [
    "general_chat",
    "book_appointment",
    "reschedule_appointment",
    "cancel_appointment",
    "request_human",
    "confirm",
    "deny",
    "provide_name",
    "provide_email",
    "provide_phone",
    "provide_datetime",
    "provide_timezone",
    "small_talk",
    "wait_more",
    "out_of_scope",
]


INTENT_CLASSIFIER_JSON_SCHEMA: Dict[str, Any] = {
    "name": "intent_detection_result",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "primary_intent": {
                "type": "string",
                "enum": INTENT_TYPE_VALUES,
            },
            "confidence": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0,
            },
            "entities": {
                "type": "object",
                "additionalProperties": True,
            },
            "reasoning": {
                "type": ["string", "null"],
            },
        },
        "required": ["primary_intent", "confidence", "entities"],
    },
    "strict": True,
}


def build_intent_classifier_prompt(
    user_message: str,
    previous_assistant_message: Optional[str],
    active_intake_field: Optional[str],
    handoff_active: bool,
    conversation_context: Optional[Dict[str, Any]] = None,
) -> str:
    context = conversation_context or {}
    context_lines: List[str] = []

    context_lines.append(f"current user message: {user_message or ''}")
    context_lines.append(f"previous assistant message: {previous_assistant_message or ''}")
    context_lines.append(f"active intake field: {active_intake_field or ''}")
    context_lines.append(f"handoff active: {str(bool(handoff_active)).lower()}")

    if context:
        context_lines.append("conversation context:")
        for key in sorted(context.keys()):
            value = context.get(key)
            if value is None:
                continue
            if key in {"message", "user_message", "conversation_text", "email", "phone", "name"}:
                continue
            context_lines.append(f"- {key}: {value}")

    return (
        "You are an intent classifier for a chatbot orchestration layer. "
        "Classify only the user's intent and extract entities. "
        "Do not take actions, do not modify state, and do not answer the user. "
        "Return strict JSON only and do not include markdown fences.\n\n"
        "Allowed intent labels are: "
        + ", ".join(INTENT_TYPE_VALUES)
        + "\n\n"
        "Guidance:\n"
        "- Use the previous assistant message and the active workflow state to resolve context-dependent replies.\n"
        "- If the user is greeting, thanking, or chatting casually, classify as small_talk.\n"
        "- If the user clearly wants to book, reschedule, cancel, or talk to a human, prefer those semantic intents.\n"
        "- If the user is responding with yes/no/okay in the middle of a workflow, use the workflow state to infer confirm or deny.\n"
        "- If the user provides a name, email, phone, datetime, or timezone, extract it in entities.\n"
        "- If the user is waiting for a live agent or asking to wait longer, classify as wait_more.\n"
        "- Support English, Hinglish, informal language, and spelling mistakes.\n"
        "- Use entity normalization when possible, especially for ISO datetimes and canonical timezones.\n\n"
        "Context:\n"
        + "\n".join(context_lines)
        + "\n\n"
        "Return keys: primary_intent, confidence, entities, reasoning. "
        "confidence must be a number between 0 and 1. "
        "entities must be an object, even if empty."
    )


def get_intent_request_messages(
    user_message: str,
    previous_assistant_message: Optional[str],
    active_intake_field: Optional[str],
    handoff_active: bool,
    conversation_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    return [
        {
            "role": "system",
            "content": build_intent_classifier_prompt(
                user_message=user_message,
                previous_assistant_message=previous_assistant_message,
                active_intake_field=active_intake_field,
                handoff_active=handoff_active,
                conversation_context=conversation_context,
            ),
        },
        {
            "role": "user",
            "content": user_message or "",
        },
    ]


def serialize_intent_schema() -> str:
    return json.dumps(INTENT_CLASSIFIER_JSON_SCHEMA, ensure_ascii=True)
