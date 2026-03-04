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


def get_session_conversations_report(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 10,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    widget_id: Optional[str] = None,
    min_tokens: Optional[int] = None,
    max_tokens: Optional[int] = None,
    has_lead: Optional[int] = None,
    sort_by: str = "conversation_start",
    sort_order: str = "desc",
):
    """Get paginated conversation report aggregated by session_id."""
    conversation_filters = [
        Conversation.organization_id == organization_id,
        Conversation.session_id.isnot(None),
    ]

    if start_date:
        conversation_filters.append(Conversation.created_at >= start_date)
    if end_date:
        conversation_filters.append(Conversation.created_at <= end_date)
    if widget_id:
        conversation_filters.append(Conversation.widget_id == widget_id)

    sessions_subquery = db.query(
        Conversation.session_id.label("session_id"),
        func.min(Conversation.id).label("id"),
        func.min(Conversation.created_at).label("conversation_start"),
        func.max(Conversation.created_at).label("conversation_end"),
        func.max(Conversation.created_at).label("created_at"),
        func.max(Conversation.widget_id).label("widget_id"),
        func.count(Conversation.id).label("turn_count"),
        func.max(Conversation.outcome).label("outcome"),
    ).filter(
        *conversation_filters
    ).group_by(
        Conversation.session_id
    ).subquery()

    metrics_filters = [
        ConversationMetrics.organization_id == organization_id,
    ]
    if start_date:
        metrics_filters.append(ConversationMetrics.conversation_start >= start_date)
    if end_date:
        metrics_filters.append(ConversationMetrics.conversation_start <= end_date)
    if widget_id:
        metrics_filters.append(ConversationMetrics.widget_id == widget_id)

    metrics_subquery = db.query(
        ConversationMetrics.session_id.label("session_id"),
        func.sum(ConversationMetrics.total_tokens).label("total_tokens"),
        func.sum(ConversationMetrics.prompt_tokens).label("prompt_tokens"),
        func.sum(ConversationMetrics.completion_tokens).label("completion_tokens"),
        func.avg(ConversationMetrics.average_response_time).label("average_response_time"),
        func.avg(ConversationMetrics.user_satisfaction).label("user_satisfaction"),
        func.max(ConversationMetrics.has_lead).label("has_lead"),
    ).filter(
        *metrics_filters
    ).group_by(
        ConversationMetrics.session_id
    ).subquery()

    leads_subquery = db.query(
        Lead.session_id.label("session_id"),
        func.max(Lead.name).label("lead_name"),
        func.max(Lead.email).label("lead_email"),
    ).filter(
        Lead.organization_id == organization_id
    ).group_by(
        Lead.session_id
    ).subquery()

    query = db.query(
        sessions_subquery.c.id.label("id"),
        sessions_subquery.c.session_id.label("session_id"),
        sessions_subquery.c.widget_id.label("widget_id"),
        sessions_subquery.c.turn_count.label("turn_count"),
        sessions_subquery.c.conversation_start.label("conversation_start"),
        sessions_subquery.c.conversation_end.label("conversation_end"),
        sessions_subquery.c.created_at.label("created_at"),
        sessions_subquery.c.outcome.label("outcome"),
        func.coalesce(metrics_subquery.c.total_tokens, 0).label("total_tokens"),
        func.coalesce(metrics_subquery.c.prompt_tokens, 0).label("prompt_tokens"),
        func.coalesce(metrics_subquery.c.completion_tokens, 0).label("completion_tokens"),
        func.coalesce(metrics_subquery.c.average_response_time, 0.0).label("average_response_time"),
        metrics_subquery.c.user_satisfaction.label("user_satisfaction"),
        func.coalesce(metrics_subquery.c.has_lead, 0).label("has_lead"),
        leads_subquery.c.lead_name.label("lead_name"),
        leads_subquery.c.lead_email.label("lead_email"),
    ).select_from(
        sessions_subquery
    ).outerjoin(
        metrics_subquery,
        metrics_subquery.c.session_id == sessions_subquery.c.session_id,
    ).outerjoin(
        leads_subquery,
        leads_subquery.c.session_id == sessions_subquery.c.session_id,
    )

    if min_tokens is not None:
        query = query.filter(func.coalesce(metrics_subquery.c.total_tokens, 0) >= min_tokens)
    if max_tokens is not None:
        query = query.filter(func.coalesce(metrics_subquery.c.total_tokens, 0) <= max_tokens)
    if has_lead is not None:
        query = query.filter(func.coalesce(metrics_subquery.c.has_lead, 0) == has_lead)

    total = query.count()

    sort_map = {
        "conversation_start": sessions_subquery.c.conversation_start,
        "total_tokens": func.coalesce(metrics_subquery.c.total_tokens, 0),
        "total_messages": sessions_subquery.c.turn_count,
        "has_lead": func.coalesce(metrics_subquery.c.has_lead, 0),
    }
    sort_field = sort_map.get(sort_by, sessions_subquery.c.conversation_start)
    if sort_order == "asc":
        query = query.order_by(sort_field.asc())
    else:
        query = query.order_by(sort_field.desc())

    rows = query.offset(skip).limit(limit).all()

    metrics = []
    for row in rows:
        conversation_duration = 0.0
        if row.conversation_start and row.conversation_end:
            conversation_duration = max(
                (row.conversation_end - row.conversation_start).total_seconds(),
                0.0,
            )

        turn_count = int(row.turn_count or 0)
        metrics.append({
            "id": int(row.id),
            "session_id": row.session_id,
            "organization_id": organization_id,
            "widget_id": row.widget_id,
            "total_messages": turn_count * 2,
            "total_tokens": int(row.total_tokens or 0),
            "prompt_tokens": int(row.prompt_tokens or 0),
            "completion_tokens": int(row.completion_tokens or 0),
            "average_response_time": float(row.average_response_time or 0.0),
            "conversation_duration": float(conversation_duration),
            "user_satisfaction": float(row.user_satisfaction) if row.user_satisfaction is not None else None,
            "has_lead": int(row.has_lead or 0),
            "lead_name": row.lead_name,
            "lead_email": row.lead_email,
            "outcome": row.outcome,
            "conversation_start": row.conversation_start,
            "conversation_end": row.conversation_end,
            "created_at": row.created_at,
        })

    return {"metrics": metrics, "total": total}


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

        session_start, session_end, session_turns = db.query(
            func.min(Conversation.created_at),
            func.max(Conversation.created_at),
            func.count(Conversation.id),
        ).filter(
            Conversation.organization_id == organization_id,
            Conversation.session_id == session_id,
        ).first()

        conversation_duration = 0.0
        if session_start and session_end:
            conversation_duration = max((session_end - session_start).total_seconds(), 0.0)

        total_turns = int(session_turns or 0)
        total_messages = total_turns * 2
        
        if existing:
            # Update existing metrics
            existing.has_lead = 1 if lead else 0
            existing.lead_name = lead.name if lead else None
            existing.lead_email = lead.email if lead else None
            existing.lead_company = lead.company if lead else None
            existing.total_messages = total_messages
            existing.total_user_messages = total_turns
            existing.total_ai_messages = total_turns
            existing.conversation_start = session_start
            existing.conversation_end = session_end
            existing.conversation_duration = conversation_duration

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
                total_messages=total_messages,
                total_user_messages=total_turns,
                total_ai_messages=total_turns,
                total_tokens=total_tokens,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                conversation_start=session_start or conversation.created_at,
                conversation_end=session_end,
                conversation_duration=conversation_duration,
                has_lead=1 if lead else 0,
                lead_name=lead.name if lead else None,
                lead_email=lead.email if lead else None,
                lead_company=lead.company if lead else None,
            )
            db.add(metrics)
        
        db.commit()
    except Exception as e:
        logger.error(f"Error syncing conversation metrics: {str(e)}", exc_info=True)
