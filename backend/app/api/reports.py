from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User, ConversationMetrics
from app.schemas.report import (
    ConversationMetricsResponse,
    ReportResponse,
    DetailedReportResponse,
    TokenUsageReport,
    LeadReportResponse,
)
from app.services.report_service import (
    get_conversation_metrics_query,
    get_report_summary,
    get_token_usage_report,
    get_leads_report,
    get_daily_conversation_stats,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/summary", response_model=ReportResponse)
async def get_report_summary_endpoint(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    widget_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get report summary (aggregated metrics)"""
    # Parse date strings to datetime objects
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    summary = get_report_summary(
        db,
        current_user.organization_id,
        start_dt,
        end_dt,
        widget_id,
    )
    return summary


@router.get("/conversations", response_model=DetailedReportResponse)
async def get_conversations_report(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=500),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    widget_id: Optional[str] = Query(None),
    min_tokens: Optional[int] = Query(None),
    max_tokens: Optional[int] = Query(None),
    has_lead: Optional[int] = Query(None),
    sort_by: str = Query("conversation_start", regex="^(conversation_start|total_tokens|total_messages|has_lead)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed conversation metrics with pagination and filtering"""
    
    # Parse date strings
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    query = get_conversation_metrics_query(
        db,
        current_user.organization_id,
        start_dt,
        end_dt,
        widget_id,
        min_tokens,
        max_tokens,
        has_lead,
    )
    
    # Sorting
    sort_field = getattr(ConversationMetrics, sort_by)
    if sort_order == "desc":
        query = query.order_by(sort_field.desc())
    else:
        query = query.order_by(sort_field.asc())
    
    # Get total count
    total = query.count()
    
    # Pagination
    metrics = query.offset(skip).limit(limit).all()
    
    # Get summary
    summary = get_report_summary(
        db,
        current_user.organization_id,
        start_dt,
        end_dt,
        widget_id,
    )
    
    return DetailedReportResponse(
        summary=summary,
        metrics=metrics,
        pagination={"skip": skip, "limit": limit, "total": total},
    )


@router.get("/tokens", response_model=TokenUsageReport)
async def get_token_usage_report_endpoint(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get token usage analytics"""
    # Parse date strings
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    report = get_token_usage_report(
        db,
        current_user.organization_id,
        start_dt,
        end_dt,
    )
    return report


@router.get("/leads", response_model=LeadReportResponse)
async def get_leads_report_endpoint(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get leads analytics"""
    # Parse date strings
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    report = get_leads_report(
        db,
        current_user.organization_id,
        start_dt,
        end_dt,
    )
    return report


@router.get("/daily-stats")
async def get_daily_stats_endpoint(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get daily conversation statistics"""
    stats = get_daily_conversation_stats(db, current_user.organization_id, days)
    return {"daily_stats": stats}


@router.get("/export/csv")
async def export_conversations_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    widget_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export conversation metrics to CSV"""
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse
    
    # Parse date strings
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    query = get_conversation_metrics_query(
        db,
        current_user.organization_id,
        start_dt,
        end_dt,
        widget_id,
    )
    
    metrics = query.order_by(ConversationMetrics.conversation_start.desc()).all()
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "Session ID",
        "Widget ID",
        "Total Messages",
        "Total Tokens",
        "Prompt Tokens",
        "Completion Tokens",
        "Avg Response Time (s)",
        "Duration (s)",
        "Satisfaction",
        "Lead Captured",
        "Lead Name",
        "Lead Email",
        "Start Time",
        "End Time",
    ])
    
    # Write data
    for metric in metrics:
        writer.writerow([
            metric.session_id,
            metric.widget_id or "",
            metric.total_messages,
            metric.total_tokens,
            metric.prompt_tokens,
            metric.completion_tokens,
            f"{metric.average_response_time:.2f}",
            f"{metric.conversation_duration:.2f}",
            f"{metric.user_satisfaction:.1f}" if metric.user_satisfaction else "",
            "Yes" if metric.has_lead else "No",
            metric.lead_name or "",
            metric.lead_email or "",
            metric.conversation_start.strftime("%Y-%m-%d %H:%M:%S") if metric.conversation_start else "",
            metric.conversation_end.strftime("%Y-%m-%d %H:%M:%S") if metric.conversation_end else "",
        ])
    
    # Return as streaming response
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=conversation_report.csv"},
    )
