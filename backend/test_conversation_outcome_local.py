"""Local tester for conversation outcome classification.

This script calls app/services/conversation_outcome_service.py directly,
without hitting API endpoints or DB jobs.

Usage:
1) Use built-in sample transcript:
   .\\venv\\Scripts\\python.exe test_conversation_outcome_local.py

2) Use transcript from a text file:
   .\\venv\\Scripts\\python.exe test_conversation_outcome_local.py --conversation-file my_transcript.txt

3) Print only outcome label:
   .\\venv\\Scripts\\python.exe test_conversation_outcome_local.py --label-only
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict


SAMPLE_TRANSCRIPT = """Agent: नमष्कार मैं सम्बरोत solar से नेहा बोल रही हूँ. क्या आप solar लगवाने का plan कर रहे हैं?
User: मेरा तो लग चुका है.
Agent: आपका solar system लग चुका है. यह जानकर अच्छा लगा mam. क्या आप system के प्रदर्शन या maintenance के बारे में कोई जानकारी या मदद चाहेंगी?
User: नहीं अभी तो नहीं चाहिए.
Agent: ठीक है mam. जब भी आपको कोई मदद या जानकारी चाहिए हो, हम आपकी सहायता के लिए हमेशा उपलब्ध हैं. आपका दिन शुभ. हो.
User: ठीक है, thank you."""


VALID_DEFAULT = {"positive", "negative", "satisfactory", "neutral", "unresolved", "other"}
VALID_LEAD_DEFAULT = {"lead", "not lead"}


def _load_service_module() -> Any:
    service_path = Path(__file__).resolve().parent / "app" / "services" / "conversation_outcome_service.py"
    spec = importlib.util.spec_from_file_location("conv_outcome", service_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module spec from {service_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _read_conversation(conversation_file: str | None) -> str:
    if conversation_file:
        return Path(conversation_file).read_text(encoding="utf-8")
    return SAMPLE_TRANSCRIPT


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local test runner for conversation outcome service")
    parser.add_argument(
        "--conversation-file",
        default=None,
        help="Path to UTF-8 text file containing transcript",
    )
    parser.add_argument(
        "--label-only",
        action="store_true",
        help="Print only the outcome label",
    )
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip response validation",
    )
    return parser.parse_args()


def _validate_response_shape(result: Dict[str, str], module: Any) -> None:
    if not isinstance(result, dict):
        raise AssertionError("Result must be an object")

    if "outcome" not in result:
        raise AssertionError("Missing key: outcome")
    if "whether_lead" not in result:
        raise AssertionError("Missing key: whether_lead")

    valid_outcomes = set(getattr(module, "VALID_OUTCOMES", VALID_DEFAULT))
    valid_lead_statuses = set(getattr(module, "VALID_LEAD_STATUSES", VALID_LEAD_DEFAULT))

    if result["outcome"] not in valid_outcomes:
        raise AssertionError(
            f"Unexpected outcome '{result['outcome']}'. Expected one of: {sorted(valid_outcomes)}"
        )

    if result["whether_lead"] not in valid_lead_statuses:
        raise AssertionError(
            f"Unexpected whether_lead '{result['whether_lead']}'. Expected one of: {sorted(valid_lead_statuses)}"
        )


def main() -> int:
    args = parse_args()

    try:
        transcript = _read_conversation(args.conversation_file)
        module = _load_service_module()

        uses_openai = getattr(module, "client", None) is not None
        mode = "openai" if uses_openai else "fallback"

        classification = module._classify_outcome_with_llm(transcript)

        if not args.no_validate:
            _validate_response_shape(classification, module)

        if args.label_only:
            print(classification["outcome"])
        else:
            payload = {
                "mode": mode,
                "classification": classification,
                "valid_outcomes": sorted(list(getattr(module, "VALID_OUTCOMES", VALID_DEFAULT))),
                "valid_lead_statuses": sorted(list(getattr(module, "VALID_LEAD_STATUSES", VALID_LEAD_DEFAULT))),
            }
            print(json.dumps(payload, ensure_ascii=False, indent=2))

        return 0
    except Exception as exc:
        print(f"Error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
