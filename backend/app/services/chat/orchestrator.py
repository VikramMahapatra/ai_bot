from __future__ import annotations

import asyncio
import logging
import time
import re
from dataclasses import replace
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.config import settings
from app.enums.credit_feature_codes import FeatureCodes
from app.models import Conversation, WidgetConfig
from app.services.chat.escalation_service import append_appointment_cta_if_needed, build_escalation_message, default_escalation_contacts, should_escalate_response
from app.services.chat.fallback_service import build_clarifying_question, build_grounded_fallback_message, build_soft_fallback_message
from app.services.chat.followup_resolver import resolve_followup_context
from app.services.chat.dataset_router import route_dataset_chat
from app.services.chat.openai_service import openai_service
from app.services.chat.persistence_service import finalize_chat_credit_reservation, finalize_conversation_metrics, persist_conversation_record, reserve_chat_credits, rollback_chat_credit_reservation, transactional_session
from app.services.chat.prompt_builder import build_chat_messages, build_system_prompt
from app.services.chat.response_validator import validate_answer
from app.services.chat.retrieval import get_suggested_questions, retrieve_hybrid_result
from app.services.chat.structured_answering import parse_structured_answer
from app.services.chat.types import ChatResponsePlan, StructuredAnswer
from app.services.rag import chroma_client

logger = logging.getLogger(__name__)
DOCUMENT_UNAVAILABLE = "The document answer is currently unavailable. Please ask the document question separately."


def _normalize_message(message: str) -> str:
    return " ".join((message or "").split()).strip().lower()


def _is_small_talk_message(message: str) -> bool:
    normalized = _normalize_message(message).rstrip(".!?…")
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
    # Operational API gates run before this planner. Short greetings need neither
    # catalog IO nor a planner completion, including for active dataset agents.
    if _is_small_talk_message(message):
        return _build_vector_plan(message, session_id, widget_id, organization_id, db,
                                  language_code, language_label)
    # A bare “what?” is a request to explain the immediately preceding reply,
    # not a new dataset lookup or a reason to ask the same qualification again.
    if _is_bare_clarification(message):
        return _build_vector_plan(message, session_id, widget_id, organization_id, db,
                                  language_code, language_label)
    dataset_plan = route_dataset_chat(message, session_id, widget_id, organization_id, db)
    if dataset_plan is not None and dataset_plan.answer_mode != "vector":
        if dataset_plan.answer_mode == "mixed" and dataset_plan.document_question:
            return _complete_mixed_plan(dataset_plan, session_id, widget_id, organization_id, db,
                                        language_code, language_label)
        return dataset_plan
    if dataset_plan is not None and dataset_plan.retrieval_trace.get("dataset_document_question"):
        # Model-selected document questions must not inherit a caller's old
        # dataset retrieval override. Domain intent belongs to agent configuration.
        retrieval_message = None
    plan = _build_vector_plan(message, session_id, widget_id, organization_id, db,
                              language_code, language_label, retrieval_message,
                              dataset_questions=(dataset_plan.retrieval_trace.get("dataset_prior_questions", [])
                                                                 if dataset_plan is not None else None),
                                        **({"company_question": True} if dataset_plan is not None
                                            and dataset_plan.retrieval_trace.get("dataset_document_question") else {}))
    if dataset_plan is not None:
        # Persist the router's scoped context/reset alongside document citations;
        # otherwise a document turn can resurrect filters from an earlier topic.
        plan.retrieval_trace.setdefault("selected_chunks", []).extend(
            chunk for chunk in dataset_plan.retrieval_trace.get("selected_chunks", [])
            if chunk.get("type") == "dataset_query_context")
        plan.retrieval_trace["token_usage"] = dataset_plan.token_usage
        return replace(plan, token_usage=dataset_plan.token_usage)
    return plan


def _complete_mixed_plan(
    dataset_plan: ChatResponsePlan,
    session_id: str,
    widget_id: str,
    organization_id: int,
    db: Session,
    language_code: Optional[str],
    language_label: Optional[str],
) -> ChatResponsePlan:
    """Complete documents independently, then append outside the LLM/legacy stream."""
    prefix = dataset_plan.override_response or ""
    response = prefix + "\n\n" + DOCUMENT_UNAVAILABLE
    document_usage = {}
    document_plan = None
    status = "unavailable"
    try:
        # No original compound question, dataset rows, assistant history or
        # caller retrieval override may cross into document retrieval/generation.
        document_plan = _build_vector_plan(
            dataset_plan.document_question, session_id, widget_id, organization_id, db,
            language_code, language_label, dataset_questions=[], company_question=True,
        )
        if document_plan.should_generate_llm_response and not document_plan.override_response:
            raw, document_usage = openai_service.generate_structured_answer(
                document_plan.messages, model=settings.OPENAI_CHAT_MODEL, max_tokens=1024,
                temperature=0.2, timeout_seconds=float(settings.OPENAI_CHAT_TIMEOUT_SECONDS),
            )
            # Save usage before parsing/validation so rejected completions count.
            # Apply the standalone document validation BEFORE composition. Mixed
            # mode must not weaken evidence checks on its independent suffix.
            answer = _finalize_response(document_plan, parse_structured_answer(raw),
                                        dataset_plan.document_question)
            if document_plan.retrieval_trace.get("prepared_response"):
                response = prefix + "\n\n" + answer
                status = "answered"
    except Exception as exc:
        document_usage = getattr(exc, "token_usage", document_usage)
        logger.warning("Mixed document answer unavailable for org=%s widget=%s (%s)",
                       organization_id, widget_id, type(exc).__name__)
    usage = {key: dataset_plan.token_usage.get(key, 0) + document_usage.get(key, 0)
             for key in ("prompt_tokens", "completion_tokens", "total_tokens")}
    document_trace = document_plan.retrieval_trace if document_plan else {}
    trace = {**dataset_plan.retrieval_trace,
             "document_question": dataset_plan.document_question,
             "document_status": status, "document_retrieval_trace": document_trace,
             "retrieval_query": document_trace.get("retrieval_query"),
             "query_variants": document_trace.get("query_variants", []),
             "retrieved_chunks": document_trace.get("retrieved_chunks", []),
             "selected_chunks": [*dataset_plan.retrieval_trace.get("selected_chunks", []),
                                 *document_trace.get("selected_chunks", [])],
             "source_ids": document_trace.get("source_ids", []),
             "token_usage": usage, "escalation_triggered": False}
    return replace(dataset_plan, override_response=response, grounded_fallback=response,
                   retrieval_trace=trace, token_usage=usage,
                   sources=document_plan.sources if document_plan else [])


def _build_vector_plan(
    message: str,
    session_id: str,
    widget_id: str,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None,
    dataset_questions: Optional[List[str]] = None,
    company_question: bool = False,
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

    if _is_bare_clarification(normalized_message) and dataset_questions is None:
        clarification = (
            "Sorry for the confusion. My previous reply means I couldn’t verify that detail from the "
            "information available—it doesn’t confirm that the service is unavailable. Which part "
            "would you like me to clarify?"
        )
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

    # Active-catalog vector requests must not re-send deterministic dataset rows
    # through previous assistant answers. Preserve question-only scoped context.
    history = (_prepare_history(db, session_id, widget_id) if dataset_questions is None else
               [SimpleNamespace(message=q, response="") for q in reversed(dataset_questions)])
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

    generation_message = message

    language_instruction = ""
    if language_label or language_code:
        label = language_label or "the requested language"
        code = language_code or "unknown"
        language_instruction = f"Always respond in {label} ({code})."

    system_prompt = build_system_prompt(custom_system_prompt, retrieval_result.context_text, language_instruction=language_instruction, structured_output=True)
    if company_question:
        system_prompt += (
            "\n\nThis request was routed to reference documents rather than a dataset query. "
            "Use this agent's configured scope and tone, and only authorized reference evidence. "
            "Resolve referential questions from scoped user context without silently changing the subject. "
            "Do not infer services, availability, exclusions or identities from missing information. "
            "Do not turn a price/listing/location mention into a claim that the business operates there, "
            "primarily operates there, or provides the listed service. Make those claims only when the "
            "authorized knowledge-base text explicitly supports them. Distinguish published listing or "
            "price coverage from operating locations, service provision, and live availability. Never "
            "state that the business 'primarily operates' in a city or area unless the authorized source "
            "explicitly says that; evidence about one location does not establish a primary location. "
            "When the user asks about a location and the active structured dataset can answer a published-" 
            "records question, rely on the structured result for that limited claim rather than contradicting "
            "it with an unsupported location claim from general reference text. "
            "An explicit exclusion requires explicit evidence. Do not invent aliases or infer item facts "
            "from unrelated reference material. If the requested detail is absent, set answered=false "
            "and state the specific information limit naturally, not a technical knowledge-base message."
        )
    historical_pairs = [{"user": row.message, "assistant": row.response} for row in reversed(history)]
    messages = build_chat_messages(system_prompt, historical_pairs, generation_message)

    structured_override = None
    if retrieval_result.confidence.requires_clarification:
        # Retrieval ambiguity is generic. Dataset planning already handles its
        # own missing fields; never reinterpret arbitrary agents as blog counters.
        if not company_question:
            structured_override = "Could you clarify which information you’d like me to check?"
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
    if company_question:
        # Keep confidence and retrieval clarification intact: only the validated
        # generated answer may replace this non-factual, explicit evidence limit.
        fallback = "I don’t have verified information to confirm that detail."
        authorized = {source.get("id") for source in retrieval_result.sources}
        material = [chunk for chunk in retrieval_result.chunks
                    if chunk.source_id in authorized and not chunk.is_suspicious and chunk.text.strip()]
        should_generate = bool(should_generate and material and retrieval_result.context_text.strip())
        retrieval_result.retrieval_trace["dataset_document_question"] = True

    return ChatResponsePlan(should_generate_llm_response=should_generate, override_response=structured_override, escalation_triggered=bool(structured_override and _has_prior_escalation_contacts(db, session_id, widget_id)), grounded_fallback=fallback, retrieval_trace=retrieval_result.retrieval_trace, sources=retrieval_result.sources, messages=messages, retrieval_result=retrieval_result)


def _generate_structured_response(plan: ChatResponsePlan) -> Tuple[StructuredAnswer, Dict[str, int]]:
    raw, token_usage = openai_service.generate_structured_answer(plan.messages, model=settings.OPENAI_CHAT_MODEL, max_tokens=1024, temperature=0.2, timeout_seconds=float(settings.OPENAI_CHAT_TIMEOUT_SECONDS))
    # Retain billed usage even if subsequent parsing or validation fails.
    plan.retrieval_trace["completion_token_usage"] = token_usage
    return parse_structured_answer(raw), token_usage


def _finalize_response(plan: ChatResponsePlan, structured_answer: StructuredAnswer, message: str) -> str:
    plan.retrieval_trace["prepared_response"] = False
    validated = validate_answer(structured_answer, plan.retrieval_result) if plan.retrieval_result else None
    if plan.retrieval_trace.get("dataset_document_question") and plan.answer_mode == "vector":
        context = plan.retrieval_result.context_text if plan.retrieval_result else ""
        # Attached units must not hide a literal (e.g. 999days). Non-decimal
        # Unicode numerals also count, so unsupported numeric forms fail closed.
        numeric_chars = "".join(sorted({c for c in context + structured_answer.response if c.isnumeric()}))
        numeric_pattern = (r"[+-]?[" + re.escape(numeric_chars) + r"]+(?:[.,]["
                   + re.escape(numeric_chars) + r"]+)*") if numeric_chars else r"(?!)"
        numeric_quotes = re.findall(numeric_pattern, structured_answer.response)
        numeric_grounded = set(numeric_quotes) <= set(re.findall(numeric_pattern, context))
        plan.retrieval_trace["document_answer_validation"] = {
            "reason": validated.reason if validated else "no_retrieval",
            "similarity": validated.similarity if validated else 0.0,
            "answered": structured_answer.answered, "numeric_grounded": numeric_grounded,
        }
        if (validated and validated.accepted and not validated.requires_clarification
                and validated.similarity >= 0.1 and structured_answer.answered
                and not structured_answer.requires_escalation and numeric_grounded
                and not should_escalate_response(validated.response)):
            plan.retrieval_trace["prepared_response"] = True
            return validated.response
        return plan.grounded_fallback or "I don’t have verified information to confirm that detail."
    if plan.answer_mode == "mixed":
        suffix = DOCUMENT_UNAVAILABLE
        if (validated and validated.accepted and not validated.requires_clarification
                and structured_answer.answered and not structured_answer.requires_escalation
                and validated.response.strip() and not should_escalate_response(validated.response)):
            suffix = validated.response
        # Dataset evidence is never validated, paraphrased or generated by the LLM.
        return (plan.override_response or "") + "\n\n" + suffix
    if (validated and validated.accepted and structured_answer.answered
            and not structured_answer.requires_escalation):
        plan.retrieval_trace["prepared_response"] = not should_escalate_response(validated.response)
        return validated.response
    if structured_answer.requires_escalation and plan.override_response:
        return plan.override_response
    if not structured_answer.answered:
        return "The current knowledge base doesn’t confirm that detail. Could you ask about another detail or share more context?"
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

        token_usage = {key: token_usage.get(key, 0) + plan.token_usage.get(key, 0)
                       for key in ("prompt_tokens", "completion_tokens", "total_tokens")}
        if plan.answer_mode == "vector":
            ai_response = append_appointment_cta_if_needed(ai_response, is_first_turn, message)
        else:
            token_usage.update(answer_mode=plan.answer_mode, structured_citations=plan.structured_citations)
        plan.retrieval_trace["escalation_triggered"] = plan.answer_mode == "vector" and should_escalate_response(ai_response)

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
        plan.retrieval_trace["escalation_triggered"] = plan.answer_mode == "vector" and should_escalate_response(plan.override_response)
        return None, plan.sources, plan.override_response, plan.retrieval_trace
    if not plan.should_generate_llm_response:
        plan.retrieval_trace["escalation_triggered"] = False
        return None, plan.sources, plan.grounded_fallback or build_soft_fallback_message(seed_text=f"{session_id}:{message}"), plan.retrieval_trace
    # All vector prompts request JSON. Buffer the same structured completion as
    # synchronous chat and validate BEFORE exposing any text to the SSE client.
    usage = {}
    plan.retrieval_trace.pop("completion_token_usage", None)
    response = plan.grounded_fallback or build_soft_fallback_message(seed_text=f"{session_id}:{message}")
    plan.retrieval_trace["prepared_response"] = False
    try:
        answer, usage = _generate_structured_response(plan)
        response = _finalize_response(plan, answer, message)
    except Exception as exc:
        usage = getattr(exc, "token_usage", plan.retrieval_trace.get("completion_token_usage", usage))
        plan.retrieval_trace["prepared_response"] = False
        logger.warning("Validated completion unavailable for org=%s widget=%s (%s)",
                       organization_id, widget_id, type(exc).__name__)
    plan.retrieval_trace["token_usage"] = {
        key: usage.get(key, 0) + plan.token_usage.get(key, 0)
        for key in ("prompt_tokens", "completion_tokens", "total_tokens")}
    plan.retrieval_trace["escalation_triggered"] = should_escalate_response(response)
    return None, plan.sources, response, plan.retrieval_trace


async def stream_chat_response_async(*args: Any, **kwargs: Any):
    return await asyncio.to_thread(stream_chat_response, *args, **kwargs)


def translate_text(text: str, target_language_code: Optional[str] = None, target_language_label: Optional[str] = None) -> str:
    return openai_service.translate_text(text, target_language_code, target_language_label)


async def translate_text_async(text: str, target_language_code: Optional[str] = None, target_language_label: Optional[str] = None) -> str:
    return await asyncio.to_thread(translate_text, text, target_language_code, target_language_label)


__all__ = ["append_appointment_cta_if_needed", "generate_chat_response", "generate_chat_response_async", "get_suggested_questions", "stream_chat_response", "stream_chat_response_async", "translate_text", "translate_text_async"]
