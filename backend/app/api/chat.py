from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models import Conversation, WidgetConfig, User
from app.schemas import ChatMessage, ChatResponse, ConversationHistoryItem
from app.services import generate_chat_response, should_capture_lead
from app.services.email_service import send_conversation_email
from app.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class EmailConversationRequest(BaseModel):
    session_id: str
    email: EmailStr


@router.post("", response_model=ChatResponse)
async def chat(
    message: ChatMessage,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Chat endpoint with RAG - uses user's knowledge base"""
    try:
        # Get user_id from widget_id or authenticated user
        user_id = None
        if message.widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == message.widget_id
            ).first()
            if widget_config:
                user_id = widget_config.user_id
        elif current_user:
            # If authenticated admin user, use their ID
            user_id = current_user.id
        
        # If no user_id found, return error
        if user_id is None:
            raise HTTPException(
                status_code=400, 
                detail="Invalid widget_id or user not found. Please provide a valid widget_id or authenticate."
            )
        
        # Resolve organization for scoping
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found for chat context")

        # Generate response with organization-scoped knowledge base
        response_text, sources = generate_chat_response(
            message.message,
            message.session_id,
            message.widget_id,
            user_id,
            user.organization_id,
            db
        )
        
        return ChatResponse(
            response=response_text,
            session_id=message.session_id,
            sources=sources
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}", response_model=List[ConversationHistoryItem])
async def get_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get conversation history (scoped to user's organization)"""
    conversations = db.query(Conversation).filter(
        Conversation.session_id == session_id,
        Conversation.organization_id == current_user.organization_id
    ).order_by(Conversation.created_at).all()
    
    return conversations


@router.get("/should-capture-lead/{session_id}")
async def check_lead_capture(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if lead should be captured (scoped to user's organization)"""
    should_capture = should_capture_lead(session_id, current_user.organization_id, db)
    return {"should_capture": should_capture}


@router.post("/email-conversation")
async def email_conversation(
    request: EmailConversationRequest,
    db: Session = Depends(get_db)
):
    """Send conversation transcript via email"""
    try:
        # Get conversation history
        conversations = db.query(Conversation).filter(
            Conversation.session_id == request.session_id
        ).order_by(Conversation.created_at).all()
        
        if not conversations:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Format conversation data
        conversation_data = []
        for conv in conversations:
            conversation_data.append({
                "role": conv.role,
                "content": conv.message if conv.role == "user" else conv.response
            })
        
        # Send email
        success = send_conversation_email(request.email, conversation_data)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send email")
        
        return {"message": "Email sent successfully", "email": request.email}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending conversation email: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
