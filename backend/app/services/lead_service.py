from sqlalchemy.orm import Session
from app.models import Lead, Conversation
import logging

logger = logging.getLogger(__name__)


def should_capture_lead(session_id: str, organization_id: int, widget_id: str, db: Session) -> bool:
    """Determine if lead should be captured based on conversation (org + widget scoped)"""
    try:
        # Check if lead already captured for this session in this org
        lead_query = db.query(Lead).filter(
            Lead.session_id == session_id,
            Lead.organization_id == organization_id
        )
        if widget_id:
            lead_query = lead_query.filter(Lead.widget_id == widget_id)
        existing_lead = lead_query.first()
        if existing_lead:
            return False
        
        # Check conversation turn count for this org
        conversation_query = db.query(Conversation).filter(
            Conversation.session_id == session_id,
            Conversation.organization_id == organization_id
        )
        if widget_id:
            conversation_query = conversation_query.filter(Conversation.widget_id == widget_id)
        conversation_count = conversation_query.count()
        
        # Trigger after 3 messages
        return conversation_count >= 3
        
    except Exception as e:
        logger.error(f"Error checking lead capture: {str(e)}")
        return False
