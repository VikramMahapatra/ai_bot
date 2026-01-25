from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Conversation
from app.schemas import ChatMessage, ChatResponse, ConversationHistoryItem
from app.services import generate_chat_response, should_capture_lead
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    message: ChatMessage,
    db: Session = Depends(get_db)
):
    """Chat endpoint with RAG"""
    try:
        # Generate response
        response = generate_chat_response(
            message.message,
            message.session_id,
            message.widget_id,
            db
        )
        
        return ChatResponse(
            response=response,
            session_id=message.session_id
        )
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}", response_model=List[ConversationHistoryItem])
async def get_history(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get conversation history"""
    conversations = db.query(Conversation).filter(
        Conversation.session_id == session_id
    ).order_by(Conversation.created_at).all()
    
    return conversations


@router.get("/should-capture-lead/{session_id}")
async def check_lead_capture(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Check if lead should be captured"""
    should_capture = should_capture_lead(session_id, db)
    return {"should_capture": should_capture}
