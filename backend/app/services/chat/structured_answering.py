from __future__ import annotations

import json
from typing import Any, Dict

from app.services.chat.types import StructuredAnswer


def parse_structured_answer(raw: Dict[str, Any] | str | None) -> StructuredAnswer:
    if raw is None:
        return StructuredAnswer(answered=False, confidence=0.0, requires_escalation=False, response="", raw={})
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return StructuredAnswer(answered=False, confidence=0.0, requires_escalation=False, response=raw.strip(), raw={"response": raw})
    if not isinstance(raw, dict):
        return StructuredAnswer(answered=False, confidence=0.0, requires_escalation=False, response=str(raw), raw={"response": str(raw)})
    response = str(raw.get("response") or "").strip()
    answered = bool(raw.get("answered", bool(response)))
    requires_escalation = bool(raw.get("requires_escalation", False))
    try:
        confidence = float(raw.get("confidence", 0.0))
    except Exception:
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))
    return StructuredAnswer(answered=answered, confidence=confidence, requires_escalation=requires_escalation, response=response, raw=dict(raw))


def normalize_structured_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    parsed = parse_structured_answer(payload)
    return {"answered": parsed.answered, "confidence": parsed.confidence, "requires_escalation": parsed.requires_escalation, "response": parsed.response}


def build_structured_response_instruction() -> str:
    return (
        "Return valid JSON only with exactly these keys: "
        '{"answered": true, "confidence": 0.87, "requires_escalation": false, "response": "..."}. '
        "If the answer is not grounded in the provided context, set answered to false, confidence below 0.5, and response to a brief clarification or fallback."
    )
