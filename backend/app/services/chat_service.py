from openai import OpenAI
from app.config import settings
from app.services.rag import chroma_client
from app.models import Conversation, KnowledgeSource
from app.services.report_service import sync_conversation_metrics
from sqlalchemy.orm import Session
import logging
from typing import Tuple, List, Dict, Optional
import re

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAPI_KEY2)


_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was",
    "were", "what", "when", "where", "which", "who", "how", "why", "can", "could",
    "would", "should", "a", "an", "in", "on", "of", "to", "is", "it", "as", "at",
    "by", "or", "we", "our", "us", "i", "me", "my", "they", "their", "them", "about",
}


_QUERY_GROUPS = [
    {"address", "location", "office", "hq", "head", "branch"},
    {"contact", "email", "phone", "support", "help"},
    {"price", "pricing", "cost", "fee", "charge", "plan"},
    {"hours", "timing", "opening", "open", "close"},
    {"delivery", "shipping", "ship"},
    {"refund", "return", "cancel", "cancellation"},
    {"features", "capabilities", "feature"},
    {"integration", "integrations", "api", "webhook", "sdk"},
    {"security", "privacy", "compliance", "gdpr", "soc"},
    {"setup", "install", "onboarding", "getting", "started"},
]


def _keyword_query(text: str) -> str:
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
    keywords = [t for t in tokens if t not in _STOPWORDS]
    return " ".join(keywords[:12])


def _expand_queries(base_query: str, raw_message: str) -> List[str]:
    queries = [base_query]
    raw_tokens = set(re.findall(r"[a-zA-Z0-9]+", raw_message.lower()))
    for group in _QUERY_GROUPS:
        if raw_tokens & group:
            related = " ".join(sorted(group))
            queries.append(f"{base_query}\n\nRelated terms: {related}")
            break

    keyword_query = _keyword_query(raw_message)
    if keyword_query and keyword_query not in base_query:
        queries.append(keyword_query)

    # limit to avoid latency spikes
    return queries[:3]


def _prepare_chat_payload(
    message: str,
    session_id: str,
    widget_id: str,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None
) -> Tuple[List[Dict], List[Dict]]:
    history = db.query(Conversation).filter(
        Conversation.session_id == session_id,
        Conversation.widget_id == widget_id,
    ).order_by(Conversation.created_at.desc()).limit(5).all()

    query_text = retrieval_message or message
    if history:
        recent_user_message = history[0].message
        if recent_user_message and recent_user_message.strip() and recent_user_message.strip() != message.strip():
            query_text = f"{query_text}\n\nPrevious user message: {recent_user_message.strip()}"

    context_parts = []
    source_ids = set()
    seen_chunks = set()

    def _add_results(results: Dict, max_chunks: int = 12, apply_threshold: bool = True) -> None:
        nonlocal context_parts
        distances = None
        if results and results.get('distances') and results['distances'][0]:
            distances = results['distances'][0]
        min_distance = min(distances) if distances else None
        distance_threshold = None
        if apply_threshold and min_distance is not None:
            distance_threshold = min(0.6, min_distance + 0.2)

        if results and results.get('documents') and results['documents'][0]:
            for idx, doc in enumerate(results['documents'][0]):
                if len(context_parts) >= max_chunks:
                    break
                if not doc:
                    continue
                if distances and distance_threshold is not None and idx < len(distances):
                    if distances[idx] is not None and distances[idx] > distance_threshold:
                        continue

                normalized = " ".join(doc.split()).strip().lower()
                if normalized in seen_chunks:
                    continue
                seen_chunks.add(normalized)

                context_parts.append(doc)
                if results.get('metadatas') and results['metadatas'][0] and idx < len(results['metadatas'][0]):
                    metadata = results['metadatas'][0][idx]
                    if isinstance(metadata, dict) and 'source_id' in metadata:
                        source_ids.add(int(metadata['source_id']))

                    if isinstance(metadata, dict):
                        label = metadata.get('title') or metadata.get('filename') or metadata.get('url')
                        if label:
                            context_parts[-1] = f"Source: {label}\n{context_parts[-1]}"

    primary_results = chroma_client.query(
        query_text,
        n_results=8,
        organization_id=organization_id,
        widget_id=widget_id,
    )
    _add_results(primary_results, apply_threshold=True)

    if not context_parts:
        query_variants = _expand_queries(query_text, message)
        for q in query_variants[1:]:
            if len(context_parts) >= 12:
                break
            results = chroma_client.query(
                q,
                n_results=8,
                organization_id=organization_id,
                widget_id=widget_id,
            )
            _add_results(results, apply_threshold=False)

    if not context_parts:
        fallback_results = chroma_client.query(
            query_text,
            n_results=15,
            organization_id=organization_id,
            widget_id=widget_id,
        )
        _add_results(fallback_results, max_chunks=12, apply_threshold=False)

    context = "\n\n".join(context_parts) if context_parts else ""

    sources = []
    if source_ids:
        source_records = db.query(KnowledgeSource).filter(
            KnowledgeSource.id.in_(source_ids),
            KnowledgeSource.organization_id == organization_id,
            KnowledgeSource.widget_id == widget_id,
        ).all()

        for source in source_records:
            source_info = {
                "id": source.id,
                "name": source.name,
                "type": source.source_type.value,
                "url": source.url
            }
            sources.append(source_info)

    language_instruction = ''
    if language_label or language_code:
        label = language_label or 'the requested language'
        code = language_code or 'unknown'
        language_instruction = f"\n\nAlways respond in {label} ({code})."

    messages = [
        {
            "role": "system",
            "content": f"""You are a helpful AI assistant. Answer using only the context from the user's knowledge base and the conversation history.
If the answer is not in the context, say you don't know and ask a brief clarifying question.
Do not use outside knowledge or make assumptions.
You may derive simple aggregates (e.g., price ranges) from the provided context if present, but do not expose step-by-step reasoning.
{language_instruction}

Context:
{context if context else "(No relevant context found in the knowledge base.)"}"""
        }
    ]

    for conv in reversed(history):
        messages.append({"role": "user", "content": conv.message})
        messages.append({"role": "assistant", "content": conv.response})

    messages.append({"role": "user", "content": message})

    return messages, sources


def persist_conversation(
    db: Session,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    message: str,
    response_text: str,
    token_usage: Dict
) -> None:
    conversation = Conversation(
        session_id=session_id,
        widget_id=widget_id,
        user_id=user_id,
        organization_id=organization_id,
        message=message,
        response=response_text,
        role="user"
    )
    db.add(conversation)
    db.flush()

    sync_conversation_metrics(db, conversation.id, organization_id, session_id, token_usage=token_usage)
    db.commit()


def generate_chat_response(
    message: str,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None
) -> Tuple[str, List[Dict], Dict]:
    """Generate AI response using RAG with organization-scoped knowledge base. Returns (response, sources, token_usage)."""
    try:
        messages, sources = _prepare_chat_payload(
            message,
            session_id,
            widget_id,
            organization_id,
            db,
            language_code=language_code,
            language_label=language_label,
            retrieval_message=retrieval_message
        )
        
        # Generate response
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=500,
            temperature=0.3
        )
        
        ai_response = response.choices[0].message.content

        usage = getattr(response, "usage", None)
        token_usage = {
            "prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
            "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
            "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
        }
        
        persist_conversation(
            db,
            session_id=session_id,
            widget_id=widget_id,
            user_id=user_id,
            organization_id=organization_id,
            message=message,
            response_text=ai_response,
            token_usage=token_usage
        )

        return ai_response, sources, token_usage
        
    except Exception as e:
        logger.error(f"Error generating chat response: {str(e)}")
        raise


def stream_chat_response(
    message: str,
    session_id: str,
    widget_id: str,
    user_id: int,
    organization_id: int,
    db: Session,
    language_code: Optional[str] = None,
    language_label: Optional[str] = None,
    retrieval_message: Optional[str] = None
):
    messages, sources = _prepare_chat_payload(
        message,
        session_id,
        widget_id,
        organization_id,
        db,
        language_code=language_code,
        language_label=language_label,
        retrieval_message=retrieval_message
    )

    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=500,
        temperature=0.3,
        stream=True,
        stream_options={"include_usage": True}
    )

    return stream, sources


def translate_text(text: str, target_language_code: Optional[str] = None, target_language_label: Optional[str] = None) -> str:
    if not text.strip():
        return text

    label = target_language_label or 'the requested language'
    code = target_language_code or 'unknown'
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": f"Translate the user's text to {label} ({code}). Return only the translated text, no extra commentary."
            },
            {"role": "user", "content": text}
        ],
        max_tokens=400,
        temperature=0.2
    )

    return response.choices[0].message.content or text
