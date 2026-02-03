from openai import OpenAI
from app.config import settings
from app.services.rag import chroma_client
from app.models import Conversation, KnowledgeSource
from app.services.report_service import sync_conversation_metrics
from sqlalchemy.orm import Session
import logging
from typing import Tuple, List, Dict

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAPI_KEY2)


def generate_chat_response(message: str, session_id: str, widget_id: str, user_id: int, organization_id: int, db: Session) -> Tuple[str, List[Dict]]:
    """Generate AI response using RAG with organization-scoped knowledge base. Returns (response, sources)."""
    try:
        # Query ChromaDB for relevant context filtered by organization
        results = chroma_client.query(
            message,
            n_results=5,
            organization_id=organization_id,
            widget_id=widget_id,
        )
        
        # Build context from retrieved documents and extract source info
        context_parts = []
        source_ids = set()
        
        if results and results.get('documents') and results['documents'][0]:
            for idx, doc in enumerate(results['documents'][0]):
                context_parts.append(doc)
                # Extract source_id from metadata if available
                if results.get('metadatas') and results['metadatas'][0] and idx < len(results['metadatas'][0]):
                    metadata = results['metadatas'][0][idx]
                    if isinstance(metadata, dict) and 'source_id' in metadata:
                        source_ids.add(int(metadata['source_id']))
        
        context = "\n\n".join(context_parts) if context_parts else "No relevant context found."
        
        # Fetch source information from database
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
        
        
        # Get conversation history
        history = db.query(Conversation).filter(
            Conversation.session_id == session_id,
            Conversation.widget_id == widget_id,
        ).order_by(Conversation.created_at.desc()).limit(5).all()
        
        # Build messages for OpenAI
        messages = [
            {
                "role": "system",
                "content": f"""You are a helpful AI assistant. Answer questions based on the following context from the user's knowledge base.
If the answer is not in the context, say you don't know and try to be helpful anyway.

Context:
{context}"""
            }
        ]
        
        # Add conversation history (in reverse order)
        for conv in reversed(history):
            messages.append({"role": "user", "content": conv.message})
            messages.append({"role": "assistant", "content": conv.response})
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Generate response
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        # Save conversation
        conversation = Conversation(
            session_id=session_id,
            widget_id=widget_id,
            user_id=user_id,
            organization_id=organization_id,
            message=message,
            response=ai_response,
            role="user"
        )
        db.add(conversation)
        db.flush()  # Get the conversation ID
        
        # Sync metrics for this conversation
        sync_conversation_metrics(db, conversation.id, organization_id, session_id)
        db.commit()
        
        return ai_response, sources
        
    except Exception as e:
        logger.error(f"Error generating chat response: {str(e)}")
        raise
