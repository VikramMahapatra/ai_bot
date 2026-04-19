import json
import logging
from typing import Any, Dict, List

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - environment dependent
    OpenAI = None

from app.config import settings


logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.OPENAPI_KEY2) if OpenAI else None

ALLOWED_DECISIONS = {"send_now", "do_not_send_now"}
ALLOWED_STEP_VALUES = {
    "send_product_link",
    "confirm_preferred_channel",
    "schedule_follow_up",
    "acknowledge_and_close",
    "pause_outreach",
    "ask_size_or_requirement",
    "recommend_relevant_products",
    "ask_purchase_readiness",
}


def _fallback_output(conversation_text: str) -> Dict[str, Any]:
    text = conversation_text.lower()

    busy_or_link = any(
        token in text
        for token in [
            "busy",
            "send link",
            "whatsapp",
            "sms",
            "later",
            "not now",
            "give it later",
        ]
    )
    hard_close = any(
        token in text
        for token in [
            "i am done",
            "i'm done",
            "not interested",
            "no, fine",
            "no fine",
        ]
    )

    if hard_close:
        decision = "do_not_send_now"
        step_values = [
            "send_product_link",
            "acknowledge_and_close",
            "pause_outreach",
        ]
    elif busy_or_link:
        decision = "do_not_send_now"
        step_values = [
            "send_product_link",
            "confirm_preferred_channel",
            "schedule_follow_up",
        ]
    else:
        decision = "send_now"
        step_values = [
            "ask_size_or_requirement",
            "recommend_relevant_products",
            "ask_purchase_readiness",
        ]

    return {
        "instant_reply_decision": decision,
        "next_3_recommendation_steps": [
            {"key": "step_1", "value": step_values[0]},
            {"key": "step_2", "value": step_values[1]},
            {"key": "step_3", "value": step_values[2]},
        ],
    }


def _normalize_output(raw: Dict[str, Any], conversation_text: str) -> Dict[str, Any]:
    fallback = _fallback_output(conversation_text)

    decision = str(raw.get("instant_reply_decision", "")).strip().lower()
    if decision not in ALLOWED_DECISIONS:
        decision = fallback["instant_reply_decision"]

    steps = raw.get("next_3_recommendation_steps", [])
    normalized_steps: List[Dict[str, str]] = []

    if isinstance(steps, list):
        for idx, item in enumerate(steps[:3], start=1):
            value = ""
            if isinstance(item, dict):
                value = str(item.get("value", "")).strip().lower()
            elif isinstance(item, str):
                value = item.strip().lower()

            if value not in ALLOWED_STEP_VALUES:
                value = fallback["next_3_recommendation_steps"][idx - 1]["value"]

            normalized_steps.append({"key": f"step_{idx}", "value": value})

    while len(normalized_steps) < 3:
        next_idx = len(normalized_steps) + 1
        normalized_steps.append(
            {
                "key": f"step_{next_idx}",
                "value": fallback["next_3_recommendation_steps"][next_idx - 1]["value"],
            }
        )

    return {
        "instant_reply_decision": decision,
        "next_3_recommendation_steps": normalized_steps,
    }


def analyze_conversation(conversation_text: str) -> Dict[str, Any]:
    if client is None:
        logger.warning("OpenAI SDK not available; using fallback conversation decision output")
        return _fallback_output(conversation_text)

    prompt = (
        "You are a conversation action planner. "
        "Analyze the full conversation and return valid JSON only. "
        "Decision Rules for instant_reply_decision:\n"
        "- Return send_now if:\n"
        "  * user requested details\n"
        "  * user shared phone or email\n"
        "  * appointment or demo scheduled\n"
        "  * user asked to send info on WhatsApp/email/SMS\n"
        "  * conversation reached a natural closing\n"
        
        "- Return do_not_send_now if:\n"
        "  * conversation still ongoing\n"
        "  * user has not shown interest yet\n"
        "  * user asked to call later without requesting details\n"
        "Use exactly these keys:\n"
        "1) instant_reply_decision -> one of [send_now, do_not_send_now]\n"
        "2) next_3_recommendation_steps -> list of exactly 3 items, each with keys [key, value]\n"
        "Allowed key values are strictly [step_1, step_2, step_3].\n"
        "Allowed recommendation values are strictly: "
        "[send_product_link, confirm_preferred_channel, schedule_follow_up, acknowledge_and_close, pause_outreach, ask_size_or_requirement, recommend_relevant_products, ask_purchase_readiness].\n"
        "Do not include markdown, explanation, or extra keys."
    )

    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            temperature=0,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": conversation_text},
            ],
            timeout=float(settings.OPENAI_CHAT_TIMEOUT_SECONDS),
        )

        content = response.choices[0].message.content if response.choices else ""
        if not content:
            logger.warning("Conversation decision returned empty LLM content; using fallback")
            return _fallback_output(conversation_text)

        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            logger.warning("Conversation decision JSON is not object; using fallback")
            return _fallback_output(conversation_text)

        return _normalize_output(parsed, conversation_text)
    except Exception as exc:
        logger.error("Conversation decision analysis failed: %s", str(exc), exc_info=True)
        return _fallback_output(conversation_text)
