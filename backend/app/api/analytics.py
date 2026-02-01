"""
Analytics API endpoints for dashboard analytics and performance metrics.
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Conversation, Lead, User
from app.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/sessions-messages")
async def get_sessions_messages(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get sessions and message counts grouped by day.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all conversations in range
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"  # Count only user messages
        ).all()

        # Group by date
        data_dict = {}
        for conv in conversations:
            if conv.created_at:
                date_str = conv.created_at.strftime('%Y-%m-%d')
                if date_str not in data_dict:
                    data_dict[date_str] = {"sessions": set(), "messages": 0}
                data_dict[date_str]["sessions"].add(conv.session_id)
                data_dict[date_str]["messages"] += 1

        # Format response
        data = []
        for date_str in sorted(data_dict.keys()):
            data.append({
                "date": date_str,
                "sessions": len(data_dict[date_str]["sessions"]),
                "messages": data_dict[date_str]["messages"]
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching sessions/messages: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-engagement")
async def get_user_engagement(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user engagement by hour of day over the specified period.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all conversations in range
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).all()

        # Group by hour
        hour_counts = {}
        for conv in conversations:
            if conv.created_at:
                hour = conv.created_at.strftime('%H:00')
                hour_counts[hour] = hour_counts.get(hour, 0) + 1

        # Create data for all 24 hours
        data = []
        for hour in [f"{i:02d}:00" for i in range(24)]:
            data.append({
                "hour": hour,
                "users": hour_counts.get(hour, 0)
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching user engagement: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/response-time")
async def get_response_time(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get average response time (response length as proxy) by day.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all conversations in range
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "assistant"  # Get assistant responses
        ).all()

        # Group by date and calculate average response length
        data_dict = {}
        for conv in conversations:
            if conv.created_at and conv.response:
                date_str = conv.created_at.strftime('%Y-%m-%d')
                if date_str not in data_dict:
                    data_dict[date_str] = {"total_length": 0, "count": 0}
                data_dict[date_str]["total_length"] += len(conv.response)
                data_dict[date_str]["count"] += 1

        # Calculate averages and format (response time in seconds, normalized)
        data = []
        for date_str in sorted(data_dict.keys()):
            avg_length = data_dict[date_str]["total_length"] / data_dict[date_str]["count"]
            # Normalize: assume ~0.1 seconds per 100 characters
            avg_time = round(max(0.5, min(3.0, avg_length / 300)), 1)
            data.append({
                "date": date_str,
                "time": avg_time
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching response time: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_analytics_metrics(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get key analytics metrics: total sessions, message volume, conversion rate, avg response time.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all conversations and leads
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date
        ).all()

        leads = db.query(Lead).filter(
            Lead.organization_id == org_id,
            func.date(Lead.created_at) >= start_date,
            func.date(Lead.created_at) <= end_date
        ).all()

        # Calculate metrics
        unique_sessions = len(set(conv.session_id for conv in conversations if conv.session_id))
        total_messages = len([c for c in conversations if c.role == "user"])
        
        # Conversion rate: leads / unique sessions
        conversion_rate = 0
        if unique_sessions > 0:
            conversion_rate = round((len(leads) / unique_sessions) * 100, 1)

        # Average response time
        assistant_responses = [c for c in conversations if c.role == "assistant" and c.response]
        avg_response_time = 0.0
        if assistant_responses:
            avg_length = sum(len(c.response) for c in assistant_responses) / len(assistant_responses)
            avg_response_time = round(max(0.5, min(3.0, avg_length / 300)), 1)

        return {
            "total_sessions": unique_sessions,
            "total_messages": total_messages,
            "conversion_rate": conversion_rate,
            "avg_response_time": avg_response_time,
            "total_leads": len(leads)
        }

    except Exception as e:
        logger.error(f"Error fetching analytics metrics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/message-volume")
async def get_message_volume(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get total message volume by day.
    """
    try:
        org_id = current_user.organization_id
        if not org_id:
            raise HTTPException(status_code=401, detail="Organization not found")

        # Calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Get all user messages (role='user') grouped by date
        conversations = db.query(Conversation).filter(
            Conversation.organization_id == org_id,
            func.date(Conversation.created_at) >= start_date,
            func.date(Conversation.created_at) <= end_date,
            Conversation.role == "user"
        ).all()

        # Group by date
        data_dict = {}
        for conv in conversations:
            if conv.created_at:
                date_str = conv.created_at.strftime('%Y-%m-%d')
                data_dict[date_str] = data_dict.get(date_str, 0) + 1

        # Format response
        data = []
        for date_str in sorted(data_dict.keys()):
            data.append({
                "date": date_str,
                "messages": data_dict[date_str]
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching message volume: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
