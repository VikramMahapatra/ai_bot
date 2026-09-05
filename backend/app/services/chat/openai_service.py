from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Sequence, Tuple

from app.config import settings
from app.services.chat.structured_answering import parse_structured_answer
from app.services.chat.types import LLMProvider

logger = logging.getLogger(__name__)

try:
    from openai import AsyncOpenAI, OpenAI
except Exception:  # pragma: no cover - environment dependent
    AsyncOpenAI = None
    OpenAI = None

try:
    from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential_jitter
except Exception:  # pragma: no cover - fallback when dependency is unavailable
    def retry(*args: Any, **kwargs: Any):
        def decorator(func):
            return func
        return decorator

    def retry_if_exception(predicate):  # type: ignore
        return predicate

    def stop_after_attempt(*args: Any, **kwargs: Any):  # type: ignore
        return None

    def wait_exponential_jitter(*args: Any, **kwargs: Any):  # type: ignore
        return None


def _is_retryable_openai_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    if status_code in {429, 500, 502, 503, 504}:
        return True
    text = str(exc).lower()
    markers = ["rate limit", "temporarily unavailable", "timeout", "server error", "bad gateway", "service unavailable"]
    return any(marker in text for marker in markers)


class OpenAIService(LLMProvider):
    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.OPENAPI_KEY2) if OpenAI else None
        self.async_client = AsyncOpenAI(api_key=settings.OPENAPI_KEY2) if AsyncOpenAI else None

    @retry(reraise=True, stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=1, max=8), retry=retry_if_exception(_is_retryable_openai_error))
    def _chat_completion(self, **kwargs: Any) -> Any:
        if not self.client:
            raise RuntimeError("OpenAI SDK is not available")
        return self.client.chat.completions.create(**kwargs)

    @retry(reraise=True, stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=1, max=8), retry=retry_if_exception(_is_retryable_openai_error))
    async def _achat_completion(self, **kwargs: Any) -> Any:
        if not self.async_client:
            raise RuntimeError("AsyncOpenAI SDK is not available")
        return await self.async_client.chat.completions.create(**kwargs)

    def generate_structured_answer(
        self,
        messages: Sequence[Dict[str, str]],
        model: str,
        max_tokens: int,
        temperature: float,
        timeout_seconds: float,
    ) -> Tuple[Dict[str, Any], Dict[str, int]]:
        response = self._chat_completion(model=model, messages=list(messages), max_tokens=max_tokens, temperature=temperature, response_format={"type": "json_object"}, timeout=timeout_seconds)
        content = response.choices[0].message.content if response.choices else ""
        parsed = parse_structured_answer(content)
        usage = getattr(response, "usage", None)
        return (parsed.raw if parsed.raw else {"answered": parsed.answered, "confidence": parsed.confidence, "requires_escalation": parsed.requires_escalation, "response": parsed.response}), {"prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0, "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0, "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0}

    def stream_chat_completion(
        self,
        messages: Sequence[Dict[str, str]],
        model: str,
        max_tokens: int,
        temperature: float,
        timeout_seconds: float,
    ) -> Any:
        return self._chat_completion(model=model, messages=list(messages), max_tokens=max_tokens, temperature=temperature, stream=True, stream_options={"include_usage": True}, timeout=timeout_seconds)

    def translate_text(self, text: str, target_language_code: Optional[str], target_language_label: Optional[str]) -> str:
        if not text.strip():
            return text
        label = target_language_label or "the requested language"
        code = target_language_code or "unknown"
        response = self._chat_completion(model=settings.OPENAI_TRANSLATION_MODEL, messages=[{"role": "system", "content": f"Translate the user's text to {label} ({code}). Return only the translated text, no extra commentary."}, {"role": "user", "content": text}], max_tokens=400, temperature=0.2, timeout=float(settings.OPENAI_TRANSLATION_TIMEOUT_SECONDS))
        return response.choices[0].message.content or text

    async def generate_structured_answer_async(
        self,
        messages: Sequence[Dict[str, str]],
        model: str,
        max_tokens: int,
        temperature: float,
        timeout_seconds: float,
    ) -> Tuple[Dict[str, Any], Dict[str, int]]:
        response = await self._achat_completion(model=model, messages=list(messages), max_tokens=max_tokens, temperature=temperature, response_format={"type": "json_object"}, timeout=timeout_seconds)
        content = response.choices[0].message.content if response.choices else ""
        parsed = parse_structured_answer(content)
        usage = getattr(response, "usage", None)
        return (parsed.raw if parsed.raw else {"answered": parsed.answered, "confidence": parsed.confidence, "requires_escalation": parsed.requires_escalation, "response": parsed.response}), {"prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0, "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0, "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0}


openai_service = OpenAIService()
