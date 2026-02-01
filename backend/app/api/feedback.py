from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.auth import get_current_user_optional
from app.models import Conversation, MessageFeedback, User
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("/submit", response_model=FeedbackResponse)
async def submit_feedback(
    feedback: FeedbackCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Submit feedback/rating for a message"""
    
    # Get conversation by session_id
    conversation = db.query(Conversation).filter(
        Conversation.session_id == feedback.session_id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Verify user has access (either owner or admin of organization)
    if current_user and conversation.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to submit feedback for this conversation"
        )
    
    # Validate rating
    if not (1 <= feedback.rating <= 5):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5"
        )
    
    # Check if feedback already exists for this message
    existing_feedback = db.query(MessageFeedback).filter(
        MessageFeedback.session_id == feedback.session_id,
        MessageFeedback.message_index == feedback.message_index
    ).first()
    
    if existing_feedback:
        # Update existing feedback
        existing_feedback.rating = feedback.rating
        existing_feedback.feedback_text = feedback.feedback_text
        existing_feedback.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_feedback)
        return existing_feedback
    
    # Create new feedback
    new_feedback = MessageFeedback(
        session_id=feedback.session_id,
        conversation_id=conversation.id,
        message_index=feedback.message_index,
        rating=feedback.rating,
        feedback_text=feedback.feedback_text,
        organization_id=conversation.organization_id
    )
    
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)
    
    return new_feedback


@router.get("/session/{session_id}")
async def get_session_feedback(
    session_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Get all feedback for a session"""
    
    # Get conversation by session_id
    conversation = db.query(Conversation).filter(
        Conversation.session_id == session_id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Verify user has access
    if current_user and conversation.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    feedback = db.query(MessageFeedback).filter(
        MessageFeedback.session_id == session_id
    ).all()
    
    return feedback


@router.get("/analytics")
async def get_feedback_analytics(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Get feedback analytics for organization"""
    
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    feedback_data = db.query(MessageFeedback).filter(
        MessageFeedback.organization_id == current_user.organization_id
    ).all()
    
    if not feedback_data:
        return {
            "total_feedbacks": 0,
            "average_rating": 0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            "feedback_rate": "0%"
        }
    
    ratings = [f.rating for f in feedback_data]
    rating_distribution = {i: ratings.count(i) for i in range(1, 6)}
    
    # Get total conversations to calculate feedback rate
    total_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.organization_id == current_user.organization_id
    ).scalar() or 0
    
    feedback_rate = (len(feedback_data) / total_conversations * 100) if total_conversations > 0 else 0
    
    return {
        "total_feedbacks": len(feedback_data),
        "average_rating": round(sum(ratings) / len(ratings), 2),
        "rating_distribution": rating_distribution,
        "feedback_rate": f"{feedback_rate:.1f}%",
        "total_conversations": total_conversations
    }
