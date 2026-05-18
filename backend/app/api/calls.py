from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.auth import get_current_user
from app.models.user import User
from app.models.call_campaigns import CallCampaign
from app.models.call_logs import CallLog, CallTranscript
import logging
from app.database import get_db
from app.models.appointment import Appointment
from app.utils.echoleads_client import EcholeadsClient
from dateutil import parser

from app.models.calling_agents import CallingAgent
from app.models.widget_config import WidgetConfig
from app.models.organization_calling_numbers import OrganizationCallingNumber
from app.models.campaign import Contact
from app.schemas.calling_agent import CallingNumberRequest
from app.models.lead import Lead
from app.enums.credit_feature_codes import FeatureCodes
from app.services import organization_credit_service
from app.services.calling_agent_service import test_call
from app.models.conversation import Conversation
from app.services import call_log_service
from app.models.campaign_schedules import CampaignSchedule

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/calls", tags=["calls"], dependencies=[Depends(get_current_user)]
)

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

ENDED_REASON_GROUP: dict[str, str] = {
    "customer-busy": "Not Connected",
    "customer-did-not-answer": "Not Connected",
    "silence-timed-out": "Not Connected",
    "exceeded-max-duration": "Connected",
    "customer-ended-call": "Connected",
    "assistant-ended-call": "Connected",
}


@router.get("/analytics")
def call_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    campaign_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = current_user.organization_id

    # --- Get all campaigns in the org ---
    campaigns = (
        db.query(CallCampaign)
        .filter(
            CallCampaign.organization_id == org_id, CallCampaign.is_deleted == False
        )
        .all()
    )

    if campaign_id:
        campaigns = [c for c in campaigns if c.id == campaign_id]

    if not campaigns:
        return {
            "summary": {
                "total_calls": 0,
                "successful_calls": 0,
                "pickup_rate": 0,
                "conversion_rate": 0,
                "total_duration": 0,
                "active_campaigns": 0,
                "live_calls": [],
            },
            "charts": {
                "call_volume": [],
                "pickup_trend": [],
                "call_outcomes": [],
                "intent_distribution": [],
            },
        }

    campaign_ids = [c.id for c in campaigns]

    filters = [CallLog.campaign_id.in_(campaign_ids)]

    if start_date:
        start_date = datetime.strptime(start_date, "%Y-%m-%d")
        filters.append(CallLog.start_time >= start_date)

    if end_date:
        end_date = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        filters.append(CallLog.start_time < end_date)

    attempted_calls_data = (
        db.query(CallLog.campaign_id, func.count(CallLog.id).label("attempted_calls"))
        .filter(*filters)
        .group_by(CallLog.campaign_id)
        .all()
    )

    attempted_calls_map = {
        row.campaign_id: row.attempted_calls for row in attempted_calls_data
    }

    successful_calls_data = (
        db.query(
            CallLog.campaign_id,
            func.count(func.distinct(CallLog.id)).label("successful_calls"),
        )
        .join(CallTranscript, CallTranscript.call_log_id == CallLog.id)
        .filter(*filters)
        .group_by(CallLog.campaign_id)
        .all()
    )

    successful_calls_map = {
        row.campaign_id: row.successful_calls for row in successful_calls_data
    }

    total_calls = sum(c.total_calls or 0 for c in campaigns)
    total_attempted_calls = sum(attempted_calls_map.get(c.id, 0) for c in campaigns)
    successful_calls = sum(successful_calls_map.get(c.id, 0) for c in campaigns)
    pickup_rate = (
        (successful_calls / total_attempted_calls * 100) if total_attempted_calls else 0
    )

    # Conversion rate = average of all campaigns' success_rate
    latest_conv_subq = (
        db.query(
            Conversation.session_id,
            Conversation.is_lead,
            func.row_number()
            .over(
                partition_by=Conversation.session_id,
                order_by=Conversation.created_at.desc(),
            )
            .label("rn"),
        )
        .filter(Conversation.organization_id == org_id)
        .subquery()
    )

    latest_conv = (
        db.query(latest_conv_subq.c.session_id, latest_conv_subq.c.is_lead)
        .filter(latest_conv_subq.c.rn == 1)
        .subquery()
    )

    converted_calls = (
        db.query(func.count(CallLog.id))
        .join(latest_conv, latest_conv.c.session_id == CallLog.call_session_id)
        .filter(*filters, latest_conv.c.is_lead == True)
        .scalar()
    )

    conversion_rate = (converted_calls / total_calls) * 100 if total_calls else 0

    # Total duration in minutes
    total_duration_sec = (
        db.query(func.coalesce(func.sum(CallLog.duration), 0)).filter(*filters).scalar()
    )

    total_duration = total_duration_sec // 60

    # Active campaigns
    active_campaigns = (
        db.query(CallCampaign)
        .filter(
            CallCampaign.organization_id == org_id,
            CallCampaign.status.in_(["active", "running"]),
            CallCampaign.is_deleted == False,
        )
        .count()
    )

    # Recent calls
    # Define how far back you consider "recent"
    now = datetime.now(timezone.utc)
    recent_window = now - timedelta(minutes=30)  # last 30 minutes

    recent_call_logs = (
        db.query(CallLog)
        .filter(
            *filters,
            CallLog.organization_id == org_id,
            CallLog.start_time >= recent_window,
        )
        .order_by(CallLog.start_time.desc())
        .all()
    )

    recent_calls = []
    for log in recent_call_logs:
        contact_name = getattr(log.contact, "name", "N/A") if log.contact_id else "N/A"
        campaign_name = (
            getattr(log.campaign, "name", "N/A") if log.campaign_id else "N/A"
        )
        phone = getattr(log.contact, "phone", None) if log.contact_id else None
        agent_name = getattr(log.agent, "name", None) if hasattr(log, "agent") else None

        # Duration: if ended, show total; if ongoing, show duration so far
        end_time = log.end_time or now
        duration_sec = (end_time - log.start_time).total_seconds()
        minutes = int(duration_sec // 60)
        seconds = int(duration_sec % 60)
        duration_str = f"{minutes:02d}:{seconds:02d}"

        # Map status to allowed values
        status = (
            log.status.lower() if log.status in ["queued", "live", "ended"] else "ended"
        )

        recent_calls.append(
            {
                "name": contact_name,
                "campaign": campaign_name,
                "duration": duration_str,
                "status": status,
                "phone": phone,
                "agent": agent_name,
            }
        )

    # --- Charts ---
    # Call Volume Timeline (hourly)
    call_volume_data = (
        db.query(
            extract(
                "hour",
                func.timezone(
                    func.coalesce(CampaignSchedule.timezone, "Asia/Kolkata"),
                    CallLog.start_time,
                ),
            ).label("hour"),
            func.count(CallLog.id).label("calls"),
        )
        .join(CallCampaign, CallCampaign.id == CallLog.campaign_id)
        .join(CampaignSchedule, CampaignSchedule.campaign_id == CallCampaign.id)
        .filter(*filters)
        .group_by("hour")
        .order_by("hour")
        .all()
    )
    start_hour = 9
    end_hour = 21  # inclusive

    hour_map = {int(r.hour): r.calls for r in call_volume_data}

    call_volume = [
        {"hour": hour, "calls": hour_map.get(hour, 0)}
        for hour in range(start_hour, end_hour + 1)
    ]

    # Pickup Trend

    pickup_trend_data = (
        db.query(
            extract("dow", CallLog.start_time).label("weekday"),
            func.count(CallLog.id).label("total"),
            func.count(func.nullif(CallLog.status != "ended", True)).label("ended"),
        )
        .filter(*filters)
        .group_by("weekday")
        .order_by("weekday")
        .all()
    )

    # Transform into desired format: { day: "Mon", rate: 52 }
    pickup_trend = []
    weekday_map = {int(row.weekday): row for row in pickup_trend_data}
    for i, day_name in enumerate(WEEKDAYS):  # i = 0..6
        # Original SQL dow: 0=Sun → shift
        sql_dow = (i + 1) % 7  # Mon=1, Tue=2, ..., Sun=0
        row = weekday_map.get(sql_dow)

        total = row.total if row else 0
        completed = row.ended if row else 0
        rate = round((completed / total) * 100, 2) if total else 0

        pickup_trend.append({"day": day_name, "rate": rate})

    # Call Outcomes
    # Fetch all call logs for the selected campaign
    call_logs = db.query(CallLog.ended_reason).filter(*filters).all()

    # Map to user-friendly status
    mapped_status = [
        ENDED_REASON_GROUP.get(r.ended_reason, "Not Connected") for r in call_logs
    ]

    # Count occurrences
    status_counts = Counter(mapped_status)

    # Transform for frontend
    call_status_data = [{"name": k, "value": v} for k, v in status_counts.items()]

    latest_conversation = (
        db.query(
            Conversation.id,
            Conversation.session_id,
            Conversation.outcome,
            func.row_number()
            .over(
                partition_by=Conversation.session_id,
                order_by=Conversation.created_at.desc(),  # latest conversation
            )
            .label("rn"),
        )
    ).subquery()

    lead_outcome_distribution = (
        db.query(
            latest_conversation.c.outcome.label("outcome"),
            func.count(CallLog.id).label("value"),
        )
        .join(
            latest_conversation,
            latest_conversation.c.session_id == CallLog.call_session_id,
        )
        .filter(
            CallLog.campaign_id.in_(campaign_ids),
            latest_conversation.c.rn == 1,
        )
    )

    if start_date:
        lead_outcome_distribution = lead_outcome_distribution.filter(
            CallLog.start_time >= start_date
        )

    if end_date:
        lead_outcome_distribution = lead_outcome_distribution.filter(
            CallLog.start_time < end_date
        )

    lead_outcome_distribution = lead_outcome_distribution.group_by(
        latest_conversation.c.outcome
    ).all()

    lead_outcome_data = [
        {
            "intent": r.outcome or "Pending",
            "value": r.value,
        }
        for r in lead_outcome_distribution
    ]

    # --- Return ---
    return {
        "summary": {
            "total_calls": total_calls,
            "attempted_calls": total_attempted_calls,
            "successful_calls": successful_calls,
            "pickup_rate": round(pickup_rate, 2),
            "conversion_rate": conversion_rate,
            "total_duration": total_duration,
            "active_campaigns": active_campaigns,
            "recent_calls": recent_calls,
        },
        "charts": {
            "call_volume": call_volume,
            "pickup_trend": pickup_trend,
            "call_outcomes": call_status_data,
            "lead_outcome_data": lead_outcome_data,
        },
    }


@router.post("/sync-bookings")
def sync_bookings(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return call_log_service.sync_echoleads_bookings(
        db=db,
        organization_id=current_user.organization_id,
    )


@router.get("/org/calling-numbers")
def get_calling_numbers(
    params: CallingNumberRequest = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(OrganizationCallingNumber)
        .filter(
            OrganizationCallingNumber.organization_id == current_user.organization_id,
            OrganizationCallingNumber.is_active == True,
            OrganizationCallingNumber.type == params.type,
        )
        .all()
    )
