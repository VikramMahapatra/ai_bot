from __future__ import annotations

import asyncio
import logging
import time
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.config import settings
from app.enums.credit_feature_codes import FeatureCodes
from app.models import Conversation, WidgetConfig
from app.services.chat.escalation_service import append_appointment_cta_if_needed, build_escalation_message, default_escalation_contacts, should_escalate_response
from app.services.chat.fallback_service import build_clarifying_question, build_grounded_fallback_message, build_soft_fallback_message
from app.services.chat.followup_resolver import resolve_followup_context
from app.services.chat.openai_service import openai_service
from app.services.chat.persistence_service import finalize_chat_credit_reservation, finalize_conversation_metrics, persist_conversation_record, reserve_chat_credits, rollback_chat_credit_reservation, transactional_session
from app.services.chat.prompt_builder import build_chat_messages, build_system_prompt
from app.services.chat.response_validator import validate_answer
from app.services.chat.retrieval import get_suggested_questions, retrieve_hybrid_result
from app.services.chat.structured_answering import parse_structured_answer
from app.services.chat.types import ChatResponsePlan, StructuredAnswer
from app.services.rag import chroma_client

logger = logging.getLogger(__name__)


def _normalize_message(message: str) -> str:
    return " ".join((message or "").split()).strip().lower()


def _is_small_talk_message(message: str) -> bool:
    normalized = _normalize_message(message)
    if not normalized:
        return False
    tokens = set(re.findall(r"[a-zA-Z0-9]+", normalized))
    small_talk_tokens = {"hi", "hello", "hey", "hola", "hii", "yo", "thanks", "thank", "ok", "okay", "cool", "nice", "good", "morning", "afternoon", "evening"}
    return normalized in {"hi", "hello", "hey", "hola", "hii", "yo", "thanks", "thank you", "thank you!", "ok", "okay", "cool", "nice", "good morning", "good afternoon", "good evening"} or (bool(tokens) and tokens.issubset(small_talk_tokens))


def _is_bare_clarification(message: str) -> bool:
    normalized = _normalize_message(message)
    if normalized in {"what", "what?", "huh", "sorry", "pardon"}:
        return True
    tokens = re.findall(r"[a-zA-Z0-9]+", normalized)
    return len(tokens) <= 2 and normalized in {"what do you mean", "what is this", "what's this", "what is that", "what's that"}


def _has_prior_turns(db: Session, session_id: str, widget_id: str) -> bool:
    return db.query(Conversation.id).filter(Conversation.session_id == session_id, Conversation.widget_id == widget_id).first() is not None


def _has_prior_escalation_contacts(db: Session, session_id: str, widget_id: str) -> bool:
    recent = db.query(Conversation.response).filter(Conversation.session_id == session_id, Conversation.widget_id == widget_id).order_by(Conversation.created_at.desc(), Conversation.id.desc()).limit(12).all()
    for row in recent:
        response_text = row[0] if isinstance(row, tuple) and row else getattr(row, "response", None)
        if response_text and "level 1:" in response_text.lower():
            return True
    return False


def _prepare_history(db: Session, session_id: str, widget_id: str) -> List[Conversation]:
    return db.query(Conversation).filter(Conversation.session_id == session_id, Conversation.widget_id == widget_id).order_by(Conversation.created_at.desc()).limit(3).all()


def _build_plan(
    message: str,
    session_id: str,
    widget_id: str,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None,
) -> ChatResponsePlan:
    normalized_message = _normalize_message(message)
    if _is_small_talk_message(normalized_message):
        greeting = "Hi! How can I help you?"
        return ChatResponsePlan(
            should_generate_llm_response=False,
            override_response=greeting,
            escalation_triggered=False,
            grounded_fallback=greeting,
            retrieval_trace={"user_query": message, "retrieval_query": "", "query_variants": [], "retrieved_chunks": [], "selected_chunks": [], "source_ids": [], "has_context": False, "escalation_triggered": False, "top_distance": None, "rerank_top_score": 0.0, "rerank_avg_overlap_top3": 0.0},
            sources=[],
            messages=[],
            retrieval_result=None,
        )

    if _is_bare_clarification(normalized_message):
        clarification = "Can you tell me a bit more about what you want help with?"
        return ChatResponsePlan(
            should_generate_llm_response=False,
            override_response=clarification,
            escalation_triggered=False,
            grounded_fallback=clarification,
            retrieval_trace={"user_query": message, "retrieval_query": "", "query_variants": [], "retrieved_chunks": [], "selected_chunks": [], "source_ids": [], "has_context": False, "escalation_triggered": False, "top_distance": None, "rerank_top_score": 0.0, "rerank_avg_overlap_top3": 0.0},
            sources=[],
            messages=[],
            retrieval_result=None,
        )

    history = _prepare_history(db, session_id, widget_id)
    followup = resolve_followup_context(history, message)
    query_text = retrieval_message or followup.query_text

    widget_config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == widget_id, WidgetConfig.organization_id == organization_id).first()
    custom_system_prompt = widget_config.system_prompt.strip() if widget_config and widget_config.system_prompt else ""
    escalation_level_1, escalation_level_2 = default_escalation_contacts()
    if widget_config and widget_config.escalation_contact_level_1:
        escalation_level_1 = widget_config.escalation_contact_level_1
    if widget_config and widget_config.escalation_contact_level_2:
        escalation_level_2 = widget_config.escalation_contact_level_2

    retrieval_result = retrieve_hybrid_result(message=message, query_text=query_text, organization_id=organization_id, widget_id=widget_id, chroma_client=chroma_client, db=db)

    language_instruction = ""
    if language_label or language_code:
        label = language_label or "the requested language"
        code = language_code or "unknown"
        language_instruction = f"Always respond in {label} ({code})."

    system_prompt = build_system_prompt(custom_system_prompt, retrieval_result.context_text, language_instruction=language_instruction, structured_output=True)
    historical_pairs = [{"user": row.message, "assistant": row.response} for row in reversed(history)]
    messages = build_chat_messages(system_prompt, historical_pairs, message)

    structured_override = None
    if retrieval_result.confidence.requires_clarification:
        clarification = build_clarifying_question(message, None, ())
        normalized_msg = _normalize_message(message)
        lowered = normalized_msg
        post_keywords = {"blog", "post", "posts", "article", "articles", "count", "how many", "number", "published", "archive"}
        is_post_query = any(keyword in lowered for keyword in post_keywords)

        # Only force clarification for genuinely count/period style queries.
        if is_post_query:
            structured_override = clarification
    if not retrieval_result.chunks and _has_prior_escalation_contacts(db, session_id, widget_id):
        structured_override = build_escalation_message(escalation_level_1, escalation_level_2)

    has_retrieval_material = bool(retrieval_result.context_text) or len(retrieval_result.chunks) >= 2
    should_generate = structured_override is None and retrieval_result.confidence.score >= 0.2 and has_retrieval_material
    fallback = build_soft_fallback_message(seed_text=f"{session_id}:{message}")
    if retrieval_result.context_text and not should_generate:
        fallback = build_grounded_fallback_message(retrieval_result.context_text[:240])
    elif retrieval_result.chunks and not should_generate:
        top_snippet = (retrieval_result.chunks[0].snippet or retrieval_result.chunks[0].text or "")[:240]
        if top_snippet:
            fallback = build_grounded_fallback_message(top_snippet)

    return ChatResponsePlan(should_generate_llm_response=should_generate, override_response=structured_override, escalation_triggered=bool(structured_override and _has_prior_escalation_contacts(db, session_id, widget_id)), grounded_fallback=fallback, retrieval_trace=retrieval_result.retrieval_trace, sources=retrieval_result.sources, messages=messages, retrieval_result=retrieval_result)


def _generate_structured_response(plan: ChatResponsePlan) -> Tuple[StructuredAnswer, Dict[str, int]]:
    raw, token_usage = openai_service.generate_structured_answer(plan.messages, model=settings.OPENAI_CHAT_MODEL, max_tokens=260, temperature=0.2, timeout_seconds=float(settings.OPENAI_CHAT_TIMEOUT_SECONDS))
    return parse_structured_answer(raw), token_usage


def _finalize_response(plan: ChatResponsePlan, structured_answer: StructuredAnswer, message: str) -> str:
    validated = validate_answer(structured_answer, plan.retrieval_result) if plan.retrieval_result else None
    if validated and validated.accepted:
        return validated.response
    if structured_answer.requires_escalation and plan.override_response:
        return plan.override_response
    if validated and validated.requires_clarification:
        return build_clarifying_question(message, None, ())
    return plan.grounded_fallback or build_soft_fallback_message(seed_text=message)


def generate_chat_response(
    message: str,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None,
) -> Tuple[str, List[Dict], Dict]:
    start = time.perf_counter()
    reservation = None
    try:
        plan = _build_plan(message, session_id, widget_id, organization_id, db, language_code, language_label, retrieval_message)
        is_first_turn = not _has_prior_turns(db, session_id, widget_id)
        escalation_level_1, escalation_level_2 = default_escalation_contacts()
        widget_config = db.query(WidgetConfig).filter(WidgetConfig.widget_id == widget_id, WidgetConfig.organization_id == organization_id).first()
        if widget_config and widget_config.escalation_contact_level_1:
            escalation_level_1 = widget_config.escalation_contact_level_1
        if widget_config and widget_config.escalation_contact_level_2:
            escalation_level_2 = widget_config.escalation_contact_level_2
        escalation_message = build_escalation_message(escalation_level_1, escalation_level_2)

        with transactional_session(db):
            reservation = reserve_chat_credits(db, organization_id, FeatureCodes.CORE_CHATBOT_WEB_MESSAGE, 1, reference_type="chat", reference_id=session_id)

        if plan.override_response:
            ai_response = plan.override_response
            token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        elif not plan.should_generate_llm_response:
            ai_response = plan.grounded_fallback or build_soft_fallback_message(seed_text=f"{session_id}:{message}")
            token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        else:
            structured_answer, token_usage = _generate_structured_response(plan)
            ai_response = _finalize_response(plan, structured_answer, message)
            if should_escalate_response(ai_response) and _has_prior_escalation_contacts(db, session_id, widget_id):
                ai_response = escalation_message

        ai_response = append_appointment_cta_if_needed(ai_response, is_first_turn, message)
        plan.retrieval_trace["escalation_triggered"] = should_escalate_response(ai_response)

        with transactional_session(db):
            conversation = persist_conversation_record(db, session_id, widget_id, user_id, organization_id, message, ai_response, retrieval_trace=plan.retrieval_trace)
            if reservation:
                finalize_chat_credit_reservation(db, reservation)
            finalize_conversation_metrics(db, conversation.id, organization_id, session_id, token_usage=token_usage)

        logger.info("%s", {"event": "chat_response", "latency_ms": round((time.perf_counter() - start) * 1000, 2), "organization_id": organization_id, "widget_id": widget_id, "session_id": session_id, "model": settings.OPENAI_CHAT_MODEL, "token_usage": token_usage, "retrieval_score": plan.retrieval_result.confidence.score if plan.retrieval_result else 0.0, "escalation_triggered": plan.retrieval_trace.get("escalation_triggered", False)})
        return ai_response, plan.sources, token_usage
    except Exception as exc:
        if reservation:
            try:
                with transactional_session(db):
                    rollback_chat_credit_reservation(db, reservation)
            except Exception:
                logger.exception("Failed to rollback reserved credits for session_id=%s widget_id=%s", session_id, widget_id)
        logger.error("Error generating chat response: %s", str(exc), exc_info=True)
        raise


async def generate_chat_response_async(*args: Any, **kwargs: Any) -> Tuple[str, List[Dict], Dict]:
    return await asyncio.to_thread(generate_chat_response, *args, **kwargs)


def stream_chat_response(
    message: str,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None,
):
    plan = _build_plan(message, session_id, widget_id, organization_id, db, language_code, language_label, retrieval_message)
    if plan.override_response:
        plan.retrieval_trace["escalation_triggered"] = should_escalate_response(plan.override_response)
        return None, plan.sources, plan.override_response, plan.retrieval_trace
    if not plan.should_generate_llm_response:
        plan.retrieval_trace["escalation_triggered"] = False
        return None, plan.sources, plan.grounded_fallback or build_soft_fallback_message(seed_text=f"{session_id}:{message}"), plan.retrieval_trace
    try:
        stream = openai_service.stream_chat_completion(plan.messages, model=settings.OPENAI_CHAT_MODEL, max_tokens=260, temperature=0.2, timeout_seconds=float(settings.OPENAI_STREAM_TIMEOUT_SECONDS))
        return stream, plan.sources, plan.grounded_fallback or build_soft_fallback_message(seed_text=f"{session_id}:{message}"), plan.retrieval_trace
    except Exception as exc:
        logger.warning("OpenAI stream init failed for widget_id=%s session_id=%s: %s", widget_id, session_id, str(exc))
        if plan.retrieval_result:
            plan.retrieval_trace["escalation_triggered"] = False
            return None, plan.sources, build_grounded_fallback_message(plan.retrieval_result.context_text[:240]), plan.retrieval_trace
        plan.retrieval_trace["escalation_triggered"] = False
        return None, plan.sources, build_soft_fallback_message(seed_text=f"{session_id}:{message}"), plan.retrieval_trace


async def stream_chat_response_async(*args: Any, **kwargs: Any):
    return await asyncio.to_thread(stream_chat_response, *args, **kwargs)


def translate_text(text: str, target_language_code: Optional[str] = None, target_language_label: Optional[str] = None) -> str:
    return openai_service.translate_text(text, target_language_code, target_language_label)


async def translate_text_async(text: str, target_language_code: Optional[str] = None, target_language_label: Optional[str] = None) -> str:
    return await asyncio.to_thread(translate_text, text, target_language_code, target_language_label)


__all__ = ["append_appointment_cta_if_needed", "generate_chat_response", "generate_chat_response_async", "get_suggested_questions", "stream_chat_response", "stream_chat_response_async", "translate_text", "translate_text_async"]
