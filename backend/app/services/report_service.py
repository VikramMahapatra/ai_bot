from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models import ConversationMetrics, Conversation, Lead, Plan
from app.services.limits_service import get_active_subscription, get_subscription_days_left, get_or_create_subscription_usage, get_effective_limits
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)


def get_conversation_metrics_query(
    db: Session,
    organization_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    widget_id: Optional[str] = None,
    min_tokens: Optional[int] = None,
    max_tokens: Optional[int] = None,
    has_lead: Optional[int] = None,
):
    """Build filtered query for conversation metrics"""
    query = db.query(ConversationMetrics).filter(
        ConversationMetrics.organization_id == organization_id
    )
    
    if start_date:
        query = query.filter(ConversationMetrics.conversation_start >= start_date)
    
    if end_date:
        query = query.filter(ConversationMetrics.conversation_start <= end_date)
    
    if widget_id:
        query = query.filter(ConversationMetrics.widget_id == widget_id)
    
    if min_tokens is not None:
        query = query.filter(ConversationMetrics.total_tokens >= min_tokens)
    
    if max_tokens is not None:
        query = query.filter(ConversationMetrics.total_tokens <= max_tokens)
    
    if has_lead is not None:
        query = query.filter(ConversationMetrics.has_lead == has_lead)
    
    return query


def get_report_summary(
    db: Session,
    organization_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    widget_id: Optional[str] = None,
):
    """Get aggregated report summary"""
    query = get_conversation_metrics_query(
        db, organization_id, start_date, end_date, widget_id
    )
    
    metrics = query.all()
    
    plan_usage = get_plan_usage_summary(db, organization_id)

    if not metrics:
        return {
            "total_conversations": 0,
            "total_messages": 0,
            "total_tokens": 0,
            "average_tokens_per_conversation": 0.0,
            "total_leads_captured": 0,
            "average_conversation_duration": 0.0,
            "average_satisfaction_rating": None,
            "plan_usage": plan_usage,
        }
    
    # Calculate aggregations
    total_conversations = len(metrics)
    total_messages = sum(m.total_messages for m in metrics)
    total_tokens = sum(m.total_tokens for m in metrics)
    average_tokens = total_tokens / total_conversations if total_conversations > 0 else 0
    total_leads = sum(1 for m in metrics if m.has_lead == 1)
    average_duration = sum(m.conversation_duration for m in metrics) / total_conversations if total_conversations > 0 else 0
    
    # Calculate average satisfaction
    ratings = [m.user_satisfaction for m in metrics if m.user_satisfaction is not None]
    average_satisfaction = sum(ratings) / len(ratings) if ratings else None
    
    return {
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "total_tokens": total_tokens,
        "average_tokens_per_conversation": round(average_tokens, 2),
        "total_leads_captured": total_leads,
        "average_conversation_duration": round(average_duration, 2),
        "average_satisfaction_rating": round(average_satisfaction, 2) if average_satisfaction else None,
        "plan_usage": plan_usage,
    }


def get_plan_usage_summary(db: Session, organization_id: int) -> Optional[Dict]:
    subscription = get_active_subscription(db, organization_id)
    if not subscription:
        return None

    plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
    limits = get_effective_limits(db, organization_id)
    usage = get_or_create_subscription_usage(db, organization_id)

    conversations_used = getattr(usage, "conversations_count", 0) if usage else 0
    messages_used = getattr(usage, "messages_count", 0) if usage else 0
    tokens_used = getattr(usage, "tokens_used", 0) if usage else 0
    crawl_pages_used = getattr(usage, "crawl_pages_count", 0) if usage else 0
    documents_used = getattr(usage, "documents_count", 0) if usage else 0

    conversation_limit = limits.get("monthly_conversation_limit")
    token_limit = limits.get("monthly_token_limit")
    message_limit = conversation_limit * 2 if conversation_limit is not None else None
    crawl_pages_limit = limits.get("monthly_crawl_pages_limit")
    document_limit = limits.get("monthly_document_limit")

    return {
        "plan_id": plan.id if plan else None,
        "plan_name": plan.name if plan else None,
        "billing_cycle": subscription.billing_cycle,
        "start_date": subscription.start_date,
        "end_date": subscription.end_date,
        "days_left": get_subscription_days_left(subscription),
        "status": subscription.status,
        "limits": {
            "monthly_conversation_limit": conversation_limit,
            "monthly_message_limit": message_limit,
            "monthly_token_limit": token_limit,
            "monthly_crawl_pages_limit": crawl_pages_limit,
            "monthly_document_limit": document_limit,
        },
        "used": {
            "conversations_used": conversations_used,
            "messages_used": messages_used,
            "tokens_used": tokens_used,
            "crawl_pages_used": crawl_pages_used,
            "documents_used": documents_used,
        },
        "remaining": {
            "conversations_remaining": None if conversation_limit is None else max(conversation_limit - conversations_used, 0),
            "messages_remaining": None if message_limit is None else max(message_limit - messages_used, 0),
            "tokens_remaining": None if token_limit is None else max(token_limit - tokens_used, 0),
            "crawl_pages_remaining": None if crawl_pages_limit is None else max(crawl_pages_limit - crawl_pages_used, 0),
            "documents_remaining": None if document_limit is None else max(document_limit - documents_used, 0),
        }
    }


def get_token_usage_report(
    db: Session,
    organization_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    """Get token usage analytics"""
    query = get_conversation_metrics_query(db, organization_id, start_date, end_date)
    metrics = query.all()
    
    if not metrics:
        return {
            "total_tokens": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "average_tokens_per_conversation": 0.0,
            "conversations_count": 0,
            "cost_estimate": None,
        }
    
    total_tokens = sum(m.total_tokens for m in metrics)
    prompt_tokens = sum(m.prompt_tokens for m in metrics)
    completion_tokens = sum(m.completion_tokens for m in metrics)
    conversations_count = len(metrics)
    average_tokens = total_tokens / conversations_count if conversations_count > 0 else 0
    
    # Estimate cost (GPT-4: $0.03 per 1K prompt tokens, $0.06 per 1K completion tokens)
    prompt_cost = (prompt_tokens / 1000) * 0.03
    completion_cost = (completion_tokens / 1000) * 0.06
    cost_estimate = prompt_cost + completion_cost
    
    return {
        "total_tokens": total_tokens,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "average_tokens_per_conversation": round(average_tokens, 2),
        "conversations_count": conversations_count,
        "cost_estimate": round(cost_estimate, 4),
    }


def get_leads_report(
    db: Session,
    organization_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    """Get leads analytics"""
    query = get_conversation_metrics_query(db, organization_id, start_date, end_date)
    metrics = query.all()
    
    total_conversations = len(metrics)
    total_leads = sum(1 for m in metrics if m.has_lead == 1)
    leads_with_email = sum(1 for m in metrics if m.has_lead == 1 and m.lead_email)
    conversion_rate = (total_leads / total_conversations * 100) if total_conversations > 0 else 0
    
    # Group by widget
    leads_by_widget = {}
    for metric in metrics:
        if metric.has_lead == 1:
            widget = metric.widget_id or "direct"
            leads_by_widget[widget] = leads_by_widget.get(widget, 0) + 1
    
    # Group by date
    leads_by_date = {}
    for metric in metrics:
        if metric.has_lead == 1 and metric.conversation_start:
            date_key = metric.conversation_start.strftime("%Y-%m-%d")
            leads_by_date[date_key] = leads_by_date.get(date_key, 0) + 1
    
    return {
        "total_leads": total_leads,
        "leads_by_widget": leads_by_widget,
        "leads_by_date": leads_by_date,
        "leads_with_email": leads_with_email,
        "conversion_rate": round(conversion_rate, 2),
    }


def get_daily_conversation_stats(
    db: Session,
    organization_id: int,
    days: int = 30,
):
    """Get conversation statistics grouped by day"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(
        func.date(ConversationMetrics.conversation_start).label("date"),
        func.count(ConversationMetrics.id).label("conversation_count"),
        func.sum(ConversationMetrics.total_messages).label("total_messages"),
        func.sum(ConversationMetrics.total_tokens).label("total_tokens"),
        func.sum(ConversationMetrics.has_lead).label("leads_captured"),
    ).filter(
        ConversationMetrics.organization_id == organization_id,
        ConversationMetrics.conversation_start >= start_date,
    ).group_by(
        func.date(ConversationMetrics.conversation_start)
    ).order_by(
        func.date(ConversationMetrics.conversation_start).desc()
    )
    
    return [
        {
            "date": str(row[0]),
            "conversation_count": row[1] or 0,
            "total_messages": row[2] or 0,
            "total_tokens": row[3] or 0,
            "leads_captured": row[4] or 0,
        }
        for row in query.all()
    ]


def sync_conversation_metrics(
    db: Session,
    conversation_id: int,
    organization_id: int,
    session_id: str,
    token_usage: Optional[Dict] = None,
):
    """Sync metrics from conversation record to metrics table"""
    try:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            logger.warning(f"Conversation {conversation_id} not found for sync")
            return
        
        # Check if metrics already exist
        existing = db.query(ConversationMetrics).filter(
            ConversationMetrics.conversation_id == conversation_id
        ).first()
        
        # Get lead info if exists
        lead = db.query(Lead).filter(
            Lead.session_id == session_id
        ).first()
        
        if existing:
            # Update existing metrics
            existing.has_lead = 1 if lead else 0
            existing.lead_name = lead.name if lead else None
            existing.lead_email = lead.email if lead else None
            existing.lead_company = lead.company if lead else None
            existing.total_messages = 2

            if token_usage:
                existing.prompt_tokens = token_usage.get("prompt_tokens", 0)
                existing.completion_tokens = token_usage.get("completion_tokens", 0)
                existing.total_tokens = token_usage.get("total_tokens", 0)
        else:
            prompt_tokens = token_usage.get("prompt_tokens", 0) if token_usage else 0
            completion_tokens = token_usage.get("completion_tokens", 0) if token_usage else 0
            total_tokens = token_usage.get("total_tokens", 0) if token_usage else 0

            # Create new metrics
            metrics = ConversationMetrics(
                conversation_id=conversation_id,
                session_id=session_id,
                organization_id=organization_id,
                widget_id=conversation.widget_id,
                user_id=conversation.user_id,
                total_messages=2,
                total_tokens=total_tokens,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                conversation_start=conversation.created_at,
                has_lead=1 if lead else 0,
                lead_name=lead.name if lead else None,
                lead_email=lead.email if lead else None,
                lead_company=lead.company if lead else None,
            )
            db.add(metrics)
        
        db.commit()
    except Exception as e:
        logger.error(f"Error syncing conversation metrics: {str(e)}", exc_info=True)
