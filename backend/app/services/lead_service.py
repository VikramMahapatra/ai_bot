from sqlalchemy.orm import Session
from app.models import Lead, Conversation
import logging

logger = logging.getLogger(__name__)


def should_capture_lead(session_id: str, db: Session) -> bool:
    """Determine if lead should be captured based on conversation"""
    try:
        # Check if lead already captured for this session
        existing_lead = db.query(Lead).filter(Lead.session_id == session_id).first()
        if existing_lead:
            return False
        
        # Check conversation turn count
        conversation_count = db.query(Conversation).filter(
            Conversation.session_id == session_id
        ).count()
        
        # Trigger after 3 messages
        return conversation_count >= 3
        
    except Exception as e:
        logger.error(f"Error checking lead capture: {str(e)}")
        return False
