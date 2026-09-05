from __future__ import annotations

from typing import Any


def _orchestrator():
    from app.services.chat import orchestrator

    return orchestrator


def _persistence_service():
    from app.services.chat import persistence_service

    return persistence_service


def append_appointment_cta_if_needed(*args: Any, **kwargs: Any):
    return _orchestrator().append_appointment_cta_if_needed(*args, **kwargs)


def generate_chat_response(*args: Any, **kwargs: Any):
    return _orchestrator().generate_chat_response(*args, **kwargs)


def generate_chat_response_async(*args: Any, **kwargs: Any):
    return _orchestrator().generate_chat_response_async(*args, **kwargs)


def get_suggested_questions(*args: Any, **kwargs: Any):
    return _orchestrator().get_suggested_questions(*args, **kwargs)


def stream_chat_response(*args: Any, **kwargs: Any):
    return _orchestrator().stream_chat_response(*args, **kwargs)


def stream_chat_response_async(*args: Any, **kwargs: Any):
    return _orchestrator().stream_chat_response_async(*args, **kwargs)


def persist_conversation(*args: Any, **kwargs: Any):
    persistence = _persistence_service()

    db = args[0] if args else kwargs.pop("db", None)
    if db is None:
        raise TypeError("persist_conversation() missing required db session argument")

    remaining_args = list(args[1:]) if args else []

    session_id = kwargs.pop("session_id", remaining_args.pop(0) if remaining_args else None)
    widget_id = kwargs.pop("widget_id", remaining_args.pop(0) if remaining_args else None)
    user_id = kwargs.pop("user_id", remaining_args.pop(0) if remaining_args else None)
    organization_id = kwargs.pop("organization_id", remaining_args.pop(0) if remaining_args else None)
    message = kwargs.pop("message", remaining_args.pop(0) if remaining_args else None)
    response_text = kwargs.pop("response_text", kwargs.pop("response", remaining_args.pop(0) if remaining_args else None))

    if session_id is None or widget_id is None or user_id is None or organization_id is None:
        raise TypeError("persist_conversation() missing required identifiers")

    if message is None or response_text is None:
        raise TypeError("persist_conversation() missing required message/response_text")

    retrieval_trace = kwargs.pop("retrieval_trace", None)
    token_usage = kwargs.pop("token_usage", None)

    # Ignore legacy compatibility extras that are not used by the new persistence API.
    kwargs.pop("sources", None)
    kwargs.pop("source_ids", None)
    kwargs.pop("metadata", None)

    conversation = persistence.persist_conversation_record(
        db=db,
        session_id=str(session_id),
        widget_id=str(widget_id),
        user_id=int(user_id),
        organization_id=int(organization_id),
        message=str(message),
        response_text=str(response_text),
        retrieval_trace=retrieval_trace,
    )

    if isinstance(token_usage, dict):
        persistence.finalize_conversation_metrics(
            db,
            conversation.id,
            int(organization_id),
            str(session_id),
            token_usage=token_usage,
        )

    return conversation


def translate_text(*args: Any, **kwargs: Any):
    return _orchestrator().translate_text(*args, **kwargs)


def translate_text_async(*args: Any, **kwargs: Any):
    return _orchestrator().translate_text_async(*args, **kwargs)


__all__ = [
    "append_appointment_cta_if_needed",
    "generate_chat_response",
    "generate_chat_response_async",
    "get_suggested_questions",
    "persist_conversation",
    "stream_chat_response",
    "stream_chat_response_async",
    "translate_text",
    "translate_text_async",
]
