"""Local tester for conversation decision service.

This script calls app/services/conversation_decision_service.py directly,
without hitting the API endpoint. It also prints whether runtime used the
OpenAI client path or fallback path.

Usage:
0) python test_conversation_decision_local.py; Pop-Location

1) Use built-in sample transcript:
   .\\venv\\Scripts\\python.exe test_conversation_decision_local.py

2) Use transcript from a text file:
   .\\venv\\Scripts\\python.exe test_conversation_decision_local.py --conversation-file my_transcript.txt

3) Print compact JSON:
   .\\venv\\Scripts\\python.exe test_conversation_decision_local.py --compact
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict


# SAMPLE_TRANSCRIPT = """AI: Hi, this is नेहा from zantixel. Just a quick 30 seconds are you exploring AI automation right now?
# AI: Hi अहमद, what kind of business do you have? Understanding your will help me suggest the best AI solutions Could you please share?
# User: What's my name?
# AI: You haven't shared your name yet. Could you please tell me your name and your business type? This will help me suggest the right AI solution for you.
# User: My name is भूषण. And I'm in IT.
# AI: Nice to meet you भूषण. Many IT businesses face challenges managing leads and support efficiently. How are you currently handling customer support or lead management in your IT business? This will help me recommend
# User: हां manually कियान तोड़शील थे.
# AI: यह काफी common scaling challenge है, manual handling से time ज़्यादा लगता है और errors भी हो सकती हैं. Would you like to explore how AI chat bots और automation can reduce this manual workload? I can suggest the best
# User: Yes yes.
# AI: fit great. AI chat bots and automation can handle that qualification and customer queries instantly, saving your team a lot of time. Do you currently use any CRM or automation tools in your IT business this will help me understanding.
# User: No no, no no not at not at
# AI: Growing businesses start without tools so it's normal. We can help you set up AI chat bots integrated with CRM for smooth led and support management. Would you like to schedule a quick demo to see how this would work for your IT business?
# User: send me drop me an SMS and email
# AI: I can help with that. Could you please share your phone number and email address? This way I can ensure you get the details on both SMS and
# User: My phone number is 8 9 8 3 2 6 2 0 4 7.
# AI: Thanks भूषण could you please
# User: And my email will मेरा my email address is भूषण dot डोंगे at the rate v c t s l g s l g s l dot com.
# AI: Thanks for sharing भूषण. I'll arrange to send you details on both SMS and email shortly. Would you also like to book a quick demo call with our techX expert to see how the AI automation can work for your IT business?
# User: I will check after I receive the email SMS then I'll check it.
# AI: Absolutely that's sounds good. I'll send you the details soon so you can review at your convenience. If you want to discuss or have questions later, feel free to reach out anytime. Would you need my help to schedule a demo call later whenever you are ready?
# User: Sir I'll tell you later.
# AI: No problem at all भूषण. If you decide to explore AI automation later will be happy"""


SAMPLE_TRANSCRIPT = """
 AI: Hi, this is नेहा from zenttrixil. Just a quick 30 seconds are you exploring AI automation right now?
User: Yes.
AI: Great. Could you tell me a bit about your business and industry? This helps me understand where AI automation can add the most value.
User: Universities नरस
AI: Thanks for sharing many universities face challenges managing student inquiries and support efficiently. Are you currently using any system
User: तो can you can you send me your details on WhatsApp or email?
AI: yes we can share details on WhatsApp or email as per your preference. May I know which 1 you would like and your contact info to send the information?
User: Yeah, you can share on both SMS and email.
AI: Sure I can do that please share your phone number and email address so I can send the details on both.
User: Ok, my number is 9 8 9 0 1 6 0 triple 9 and my email ID is पाटिल पाटिल dot रोहित 1 4 at the rate Gmail dot com.
AI: Thank you for sharing your contact details. I will send the information to your phone and email shortly. Meanwhile could you share what specific challenges you face in managing university inquiry or support? This helps me suggest the right solution for you.
User: Ok so currently I am busy can you call me later?
AI: No problem. When would be a better time for a quick call?
User: Tomorrow 6 PM
AI: Perfect, I have scheduled a call for you tomorrow at 6 pm. Would you like me to resend the contact details on WhatsApp
User: Thank you.
"""


def _load_service_module() -> Any:
    service_path = Path(__file__).resolve().parent / "app" / "services" / "conversation_decision_service.py"
    spec = importlib.util.spec_from_file_location("conv_decision", service_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module spec from {service_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _read_conversation(conversation_file: str | None) -> str:
    if not conversation_file:
        return SAMPLE_TRANSCRIPT
    return Path(conversation_file).read_text(encoding="utf-8")


def _validate_shape(result: Dict[str, Any]) -> None:
    if "instant_reply_decision" not in result:
        raise AssertionError("Missing key: instant_reply_decision")
    if "next_3_recommendation_steps" not in result:
        raise AssertionError("Missing key: next_3_recommendation_steps")

    steps = result["next_3_recommendation_steps"]
    if not isinstance(steps, list) or len(steps) != 3:
        raise AssertionError("next_3_recommendation_steps must be a list with 3 items")

    expected_keys = ["step_1", "step_2", "step_3"]
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            raise AssertionError(f"Step {i + 1} is not an object")
        if step.get("key") != expected_keys[i]:
            raise AssertionError(f"Unexpected key at step {i + 1}: {step.get('key')}")
        if "value" not in step:
            raise AssertionError(f"Missing 'value' at step {i + 1}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local test runner for conversation decision service")
    parser.add_argument(
        "--conversation-file",
        default=None,
        help="Path to UTF-8 text file containing transcript",
    )
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip response shape validation",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Print compact JSON instead of pretty JSON",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        transcript = _read_conversation(args.conversation_file)
        module = _load_service_module()

        # Runtime check: when client is None, service will use fallback rules.
        uses_openai = getattr(module, "client", None) is not None
        print(f"mode={'openai' if uses_openai else 'fallback'}")

        result = module.analyze_conversation(transcript)

        if not args.no_validate:
            _validate_shape(result)

        if args.compact:
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))

        return 0
    except Exception as exc:
        print(f"Error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
