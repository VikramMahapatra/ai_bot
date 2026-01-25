from openai import OpenAI
from app.config import settings
from app.services.rag import chroma_client
from app.models import Conversation
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_chat_response(message: str, session_id: str, widget_id: str, db: Session) -> str:
    """Generate AI response using RAG"""
    try:
        # Query ChromaDB for relevant context
        results = chroma_client.query(message, n_results=5)
        
        # Build context from retrieved documents
        context_parts = []
        if results and results.get('documents') and results['documents'][0]:
            for doc in results['documents'][0]:
                context_parts.append(doc)
        
        context = "\n\n".join(context_parts) if context_parts else "No relevant context found."
        
        # Get conversation history
        history = db.query(Conversation).filter(
            Conversation.session_id == session_id
        ).order_by(Conversation.created_at.desc()).limit(5).all()
        
        # Build messages for OpenAI
        messages = [
            {
                "role": "system",
                "content": f"""You are a helpful AI assistant. Answer questions based on the following context.
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
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        # Save conversation
        conversation = Conversation(
            session_id=session_id,
            widget_id=widget_id,
            message=message,
            response=ai_response,
            role="user"
        )
        db.add(conversation)
        db.commit()
        
        return ai_response
        
    except Exception as e:
        logger.error(f"Error generating chat response: {str(e)}")
        raise
