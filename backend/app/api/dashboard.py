from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from app.database import get_db
from app.auth import require_admin
from app.models import User, Conversation, Lead, WidgetConfig, KnowledgeSource
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/dashboard", tags=["dashboard"])


def _to_iso_string(dt_value):
    """Convert datetime value to ISO string, handling both datetime objects and strings"""
    if dt_value is None:
        return None
    if isinstance(dt_value, str):
        return dt_value
    if hasattr(dt_value, 'isoformat'):
        return dt_value.isoformat()
    return str(dt_value)


@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get comprehensive dashboard statistics"""
    try:
        org_id = current_user.organization_id
        logger.info(f"Dashboard stats for org_id: {org_id}, user: {current_user.username}")
        
        # Total conversations
        total_conversations = db.query(func.count(Conversation.id)).filter(
            Conversation.organization_id == org_id
        ).scalar() or 0
        
        # Total leads
        total_leads = db.query(func.count(Lead.id)).filter(
            Lead.organization_id == org_id
        ).scalar() or 0
        
        # Total widgets
        total_widgets = db.query(func.count(WidgetConfig.id)).filter(
            WidgetConfig.organization_id == org_id
        ).scalar() or 0
        
        # Total knowledge sources
        total_knowledge_sources = db.query(func.count(KnowledgeSource.id)).filter(
            KnowledgeSource.organization_id == org_id
        ).scalar() or 0
        
        # Conversations in last 7 days
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        conversations_7d = db.query(func.count(Conversation.id)).filter(
            and_(
                Conversation.organization_id == org_id,
                Conversation.created_at >= seven_days_ago
            )
        ).scalar() or 0
        
        # Leads in last 7 days
        leads_7d = db.query(func.count(Lead.id)).filter(
            and_(
                Lead.organization_id == org_id,
                Lead.created_at >= seven_days_ago
            )
        ).scalar() or 0
        
        # Calculate conversion rate (leads from conversations)
        conversion_rate = 0
        if total_conversations > 0:
            conversion_rate = (total_leads / total_conversations) * 100
        
        # Average messages per session
        avg_messages_per_session = 0
        if total_conversations > 0:
            # Get message counts per session, then calculate average
            session_counts = db.query(
                func.count(Conversation.id).label('count')
            ).filter(
                Conversation.organization_id == org_id
            ).group_by(Conversation.session_id).all()
            if session_counts:
                total_messages = sum([count[0] for count in session_counts])
                avg_messages_per_session = round(total_messages / len(session_counts), 2)
        
        return {
            "total_conversations": total_conversations,
            "total_leads": total_leads,
            "total_widgets": total_widgets,
            "total_knowledge_sources": total_knowledge_sources,
            "conversations_7d": conversations_7d,
            "leads_7d": leads_7d,
            "conversion_rate": round(conversion_rate, 2),
            "avg_messages_per_session": avg_messages_per_session,
        }
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/daily")
async def get_daily_conversations(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get daily conversation count for the last N days"""
    try:
        org_id = current_user.organization_id
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all conversations in the date range
        conversations = db.query(Conversation).filter(
            and_(
                Conversation.organization_id == org_id,
                Conversation.created_at >= start_date
            )
        ).all()
        
        # Group by date in Python
        date_counts = {}
        for conv in conversations:
            if conv.created_at:
                date_str = conv.created_at.strftime('%Y-%m-%d')
                date_counts[date_str] = date_counts.get(date_str, 0) + 1
        
        # Format response
        data = []
        for date_str in sorted(date_counts.keys()):
            data.append({
                "date": date_str,
                "count": date_counts[date_str]
            })
        
        return {"data": data}
    except Exception as e:
        logger.error(f"Error getting daily conversations: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leads/recent")
async def get_recent_leads(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get recent leads"""
    try:
        org_id = current_user.organization_id
        
        leads = db.query(Lead).filter(
            Lead.organization_id == org_id
        ).order_by(Lead.created_at.desc()).limit(limit).all()
        
        return {
            "leads": [
                {
                    "id": lead.id,
                    "name": lead.name,
                    "email": lead.email,
                    "phone": lead.phone,
                    "company": lead.company,
                    "session_id": lead.session_id,
                    "created_at": _to_iso_string(lead.created_at),
                }
                for lead in leads
            ]
        }
    except Exception as e:
        logger.error(f"Error getting recent leads: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/widgets")
async def get_widgets_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get widget configurations and their stats"""
    try:
        org_id = current_user.organization_id
        
        widgets = db.query(WidgetConfig).filter(
            WidgetConfig.organization_id == org_id
        ).all()
        
        widget_data = []
        for widget in widgets:
            # Count leads from this widget
            widget_leads = db.query(func.count(Lead.id)).filter(
                and_(
                    Lead.widget_id == widget.widget_id,
                    Lead.organization_id == org_id
                )
            ).scalar() or 0
            
            # Count conversations from this widget
            widget_conversations = db.query(func.count(Conversation.id)).filter(
                and_(
                    Conversation.widget_id == widget.widget_id,
                    Conversation.organization_id == org_id
                )
            ).scalar() or 0
            
            widget_data.append({
                "id": widget.id,
                "name": widget.name,
                "widget_id": widget.widget_id,
                "position": widget.position,
                "lead_capture_enabled": widget.lead_capture_enabled,
                "leads_count": widget_leads,
                "conversations_count": widget_conversations,
                "created_at": _to_iso_string(widget.created_at),
            })
        
        return {"widgets": widget_data}
    except Exception as e:
        logger.error(f"Error getting widgets summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/knowledge-sources")
async def get_knowledge_sources_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get knowledge sources summary"""
    try:
        org_id = current_user.organization_id
        
        sources = db.query(KnowledgeSource).filter(
            KnowledgeSource.organization_id == org_id
        ).all()
        
        sources_data = []
        for source in sources:
            sources_data.append({
                "id": source.id,
                "name": source.name,
                "source_type": source.source_type,
                "status": source.status,
                "url": source.url,
                "created_at": _to_iso_string(source.created_at),
            })
        
        return {"sources": sources_data}
    except Exception as e:
        logger.error(f"Error getting knowledge sources: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leads/by-source")
async def get_leads_by_source(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get leads distribution by widget/source"""
    try:
        org_id = current_user.organization_id
        
        leads_by_widget = db.query(
            Lead.widget_id,
            func.count(Lead.id).label('count')
        ).filter(
            Lead.organization_id == org_id
        ).group_by(Lead.widget_id).all()
        
        data = []
        for widget_id, count in leads_by_widget:
            widget_name = "Direct (No Widget)"
            if widget_id:
                widget = db.query(WidgetConfig).filter(
                    WidgetConfig.widget_id == widget_id
                ).first()
                if widget:
                    widget_name = widget.name
            
            data.append({
                "source": widget_name,
                "count": count,
                "widget_id": widget_id
            })
        
        return {"data": data}
    except Exception as e:
        logger.error(f"Error getting leads by source: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/top-sessions")
async def get_top_sessions(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get top conversations by message count"""
    try:
        org_id = current_user.organization_id
        
        # Get top sessions
        top_sessions = db.query(
            Conversation.session_id,
            func.count(Conversation.id).label('message_count'),
            func.max(Conversation.created_at).label('last_message')
        ).filter(
            Conversation.organization_id == org_id
        ).group_by(Conversation.session_id).order_by(
            func.count(Conversation.id).desc()
        ).limit(limit).all()
        
        data = []
        for session_id, msg_count, last_msg in top_sessions:
            # Check if this session has a lead (organization-scoped)
            lead = db.query(Lead).filter(
                Lead.session_id == session_id,
                Lead.organization_id == org_id
            ).first()
            
            data.append({
                "session_id": session_id,
                "message_count": msg_count,
                "last_message_at": _to_iso_string(last_msg),
                "has_lead": lead is not None,
                "lead_name": lead.name if lead else None,
            })
        
        return {"sessions": data}
    except Exception as e:
        logger.error(f"Error getting top sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation-trend")
async def get_conversation_trend(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get conversation vs leads trend"""
    try:
        org_id = current_user.organization_id
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Query conversations with date string extraction
        conversations = db.query(Conversation).filter(
            and_(
                Conversation.organization_id == org_id,
                Conversation.created_at >= start_date
            )
        ).all()
        
        # Query leads with date string extraction
        leads = db.query(Lead).filter(
            and_(
                Lead.organization_id == org_id,
                Lead.created_at >= start_date
            )
        ).all()
        
        # Build date dictionaries manually in Python
        conv_dict = {}
        for conv in conversations:
            if conv.created_at:
                date_str = conv.created_at.strftime('%Y-%m-%d')
                conv_dict[date_str] = conv_dict.get(date_str, 0) + 1
        
        lead_dict = {}
        for lead in leads:
            if lead.created_at:
                date_str = lead.created_at.strftime('%Y-%m-%d')
                lead_dict[date_str] = lead_dict.get(date_str, 0) + 1
        
        # Get all dates and build response
        all_dates = sorted(set(list(conv_dict.keys()) + list(lead_dict.keys())))
        
        data = []
        for date_str in all_dates:
            data.append({
                "date": str(date_str),  # Ensure it's a string
                "conversations": int(conv_dict.get(date_str, 0)),  # Ensure it's an int
                "leads": int(lead_dict.get(date_str, 0)),  # Ensure it's an int
            })
        
        return {"data": data}
    except Exception as e:
        logger.error(f"Error getting conversation trend: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
