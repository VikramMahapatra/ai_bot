"""Simple API tester for /api/conversation-decision/analyze.

Usage examples:
1) Login + call analyze:
   python test_conversation_decision_api.py --username viki --password password123 --organization-id 2

2) Use an existing token:
   python test_conversation_decision_api.py --token "<jwt-token>"

3) Use conversation text from a file:
   python test_conversation_decision_api.py --token "<jwt-token>" --conversation-file sample.txt
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "http://localhost:8000"

SAMPLE_CONVERSATION = """AI: Hi, this is Neha from House of Zilna.
User: Hello.
AI: Thank you for responding. You shopped with us before. How was your experience?
User: It was great.
AI: Glad to hear that. Would you like to explore something new in maternity or postpartum inner wear?
User: Yes.
AI: Great. Could you share your usual size?
User: Actually I am busy right now. Can you send me a link so I can check later?
AI: Sure, I can send the link on WhatsApp or SMS. Which do you prefer?
User: I am not sure right now. What's happening exactly?
AI: No problem. We are here to help whenever you are ready. Should I follow up at a better time?
User: No, fine. I am done.
"""


def _post_json(url: str, payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    req = Request(url=url, data=body, headers=req_headers, method="POST")
    with urlopen(req, timeout=30) as resp:
        content = resp.read().decode("utf-8")
        return json.loads(content) if content else {}


def login(base_url: str, username: str, password: str, organization_id: int) -> str:
    login_url = f"{base_url.rstrip('/')}/api/admin/login"
    payload = {
        "username": username,
        "password": password,
        "organization_id": organization_id,
    }
    result = _post_json(login_url, payload)
    token = result.get("access_token")
    if not token:
        raise RuntimeError(f"Login response missing access_token: {result}")
    return str(token)


def analyze_conversation(base_url: str, token: str, conversation_text: str) -> Dict[str, Any]:
    analyze_url = f"{base_url.rstrip('/')}/api/conversation-decision/analyze"
    payload = {"conversation_text": conversation_text}
    headers = {"Authorization": f"Bearer {token}"}
    return _post_json(analyze_url, payload, headers=headers)


def validate_response_shape(data: Dict[str, Any]) -> None:
    if "instant_reply_decision" not in data:
        raise AssertionError("Missing key: instant_reply_decision")
    if "next_3_recommendation_steps" not in data:
        raise AssertionError("Missing key: next_3_recommendation_steps")

    steps = data["next_3_recommendation_steps"]
    if not isinstance(steps, list) or len(steps) != 3:
        raise AssertionError("next_3_recommendation_steps must be a list of length 3")

    expected_keys = ["step_1", "step_2", "step_3"]
    for idx, step in enumerate(steps):
        if not isinstance(step, dict):
            raise AssertionError("Each step must be an object")
        if step.get("key") != expected_keys[idx]:
            raise AssertionError(f"Invalid step key at index {idx}: {step}")
        if "value" not in step:
            raise AssertionError(f"Missing step value at index {idx}")


def read_conversation_text(conversation_file: Optional[str]) -> str:
    if conversation_file:
        return Path(conversation_file).read_text(encoding="utf-8")
    return SAMPLE_CONVERSATION


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test /api/conversation-decision/analyze endpoint")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Backend base URL")
    parser.add_argument("--token", default=None, help="Bearer token (optional if login details provided)")
    parser.add_argument("--username", default=None, help="Login username")
    parser.add_argument("--password", default=None, help="Login password")
    parser.add_argument("--organization-id", type=int, default=None, help="Login organization_id")
    parser.add_argument("--conversation-file", default=None, help="Path to .txt conversation file")
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip response shape validation",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        token = args.token
        if not token:
            if not (args.username and args.password and args.organization_id):
                raise ValueError(
                    "Provide --token OR provide --username, --password, and --organization-id"
                )
            token = login(args.base_url, args.username, args.password, args.organization_id)

        conversation = read_conversation_text(args.conversation_file)
        result = analyze_conversation(args.base_url, token, conversation)

        if not args.no_validate:
            validate_response_shape(result)

        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP error {exc.code}: {detail}")
        return 1
    except URLError as exc:
        print(f"Network error: {exc}")
        return 1
    except Exception as exc:
        print(f"Error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
