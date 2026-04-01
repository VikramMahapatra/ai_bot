from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime
from typing import Optional
from app.auth import get_current_user
from app.models.user import User
from app.models.call_campaigns import CallCampaign
from app.models.call_logs import CallLog
import logging
from app.database import get_db
from app.services.call_log_service import sync_call_logs
from app.models.appointment import Appointment
from app.utils.echoleads_client import EcholeadsClient
from dateutil import parser

from app.models.calling_agents import CallingAgent
from app.models.widget_config import WidgetConfig
from app.models.organization_calling_numbers import OrganizationCallingNumber
from app.models.campaign import Contact
from app.schemas.calling_agent import CallingNumberRequest

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/calls", 
    tags=["calls"],
    dependencies=[Depends(get_current_user)]
)

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

@router.get("/analytics")
def call_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org_id = current_user.organization_id
    
    ## SYNC WITH ECHOLEADS
    #sync_call_logs(db, org_id, None, start_date, end_date)
    
    # --- Get all campaigns in the org ---
    campaigns = db.query(CallCampaign).filter(
        CallCampaign.organization_id == org_id,
        CallCampaign.is_deleted == False
    ).all()
    
    if not campaigns:
        return {
            "summary": {
                "total_calls": 0,
                "successful_calls": 0,
                "pickup_rate": 0,
                "conversion_rate": 0,
                "total_duration": 0,
                "active_campaigns": 0,
                "live_calls": []
            },
            "charts": {
                "call_volume": [],
                "pickup_trend": [],
                "call_outcomes": [],
                "intent_distribution": []
            }
        }

    
    campaign_ids = [c.id for c in campaigns]
    
    total_calls = sum(c.total_calls or 0 for c in campaigns)
    successful_calls = sum(c.completed_calls or 0 for c in campaigns)
    pickup_rate = (successful_calls / total_calls * 100) if total_calls else 0
    
    # Conversion rate = average of all campaigns' success_rate
    conversion_rate = round(
        sum(c.success_rate or 0 for c in campaigns) / len(campaigns), 2
    )
    
    # Total duration in minutes
    total_duration_sec = db.query(func.coalesce(func.sum(CallLog.duration), 0)).filter(
        CallLog.campaign_id.in_(campaign_ids)
    ).scalar()
    total_duration = total_duration_sec // 60
    
    # Active campaigns
    active_campaigns = db.query(CallCampaign).filter(
        CallCampaign.organization_id == org_id,
        CallCampaign.status.in_(["active", "running"]),
        CallCampaign.is_deleted == False
    ).count()
    
    call_query = db.query(CallLog).filter(CallLog.campaign_id.in_(campaign_ids))
    if start_date:
        call_query = call_query.filter(CallLog.start_time >= start_date)
    if end_date:
        call_query = call_query.filter(CallLog.start_time <= end_date)
    
    # Live calls
    now = datetime.utcnow()
    live_call_logs  = call_query.filter(
        CallLog.start_time <= now,
        CallLog.end_time >= now,
        CallLog.organization_id == org_id
    ).all()
    
    live_calls = []
    for log in live_call_logs:
        # Agent or contact name (adjust depending on your data)
        contact_name = getattr(log.contact, "name", "N/A") if log.contact_id else "N/A"
        campaign_name = getattr(log.campaign, "name", "N/A") if log.campaign_id else "N/A"
        
        # Calculate duration so far in MM:SS
        duration_sec = (now - log.start_time).total_seconds()
        minutes = int(duration_sec // 60)
        seconds = int(duration_sec % 60)
        duration_str = f"{minutes:02d}:{seconds:02d}"
        
        live_calls.append({
            "name": contact_name,
            "campaign": campaign_name,
            "duration": duration_str
        })
    
    # --- Charts ---
    # Call Volume Timeline (hourly)
    call_volume_data = (
        db.query(
            extract("hour", CallLog.start_time).label("hour"),
            func.count(CallLog.id).label("calls")
        )
        .filter(CallLog.campaign_id.in_(campaign_ids))
        .group_by("hour")
        .order_by("hour")
        .all()
    )
    call_volume = [{"hour": int(r.hour), "calls": r.calls} for r in call_volume_data]
    
    # Pickup Trend
    
    pickup_trend_data = (
        db.query(
            extract("dow", CallLog.start_time).label("weekday"),  # 0=Sun, 1=Mon, ..., 6=Sat
            func.count(CallLog.id).label("total"),
            func.count(func.nullif(CallLog.status != "ended", True)).label("ended")
        )
        .filter(CallLog.campaign_id.in_(campaign_ids))
        .group_by("weekday")
        .order_by("weekday")
        .all()
    )

    # Transform into desired format: { day: "Mon", rate: 52 }
    pickup_trend = []
    for row in pickup_trend_data:
        weekday_num = int(row.weekday)
        # SQLAlchemy's extract("dow") returns 0=Sunday, 1=Monday, ...
        day_name = WEEKDAYS[(weekday_num + 6) % 7]  # Shift so 0=Mon, 6=Sun
        total = row.total or 0
        completed = row.ended or 0
        rate = round((completed / total) * 100, 2) if total else 0
        pickup_trend.append({
            "day": day_name,
            "rate": rate
        })
        
    # Call Outcomes
    outcomes_data = (
        db.query(
            CallLog.status,
            func.count(CallLog.id)
        )
        .filter(CallLog.campaign_id.in_(campaign_ids))
        .group_by(CallLog.status)
        .all()
    )

    # Transform to array of { name, value }
    call_outcomes = [
        {"name": r[0], "value": r[1]}
        for r in outcomes_data
    ]
    
    # Intent Distribution
    intent_mapping = {
        "true": "Successful",
        "false": "Not Successful"
    }

    intent_distribution = []

    success_dist_data = (
        db.query(
            CallLog.success_evaluation,
            func.count(CallLog.id)
        )
        .filter(CallLog.campaign_id.in_(campaign_ids))
        .group_by(CallLog.success_evaluation)
        .all()
    )

    intent_distribution = [
        {"intent": "Successful" if r[0] == "true" else "Not Successful", "value": r[1]}
        for r in success_dist_data
    ]
    
    # --- Return ---
    return {
        "summary": {
            "total_calls": total_calls,
            "successful_calls": successful_calls,
            "pickup_rate": round(pickup_rate, 2),
            "conversion_rate": conversion_rate,
            "total_duration": total_duration,
            "active_campaigns": active_campaigns,
            "live_calls": live_calls
        },
        "charts": {
            "call_volume": call_volume,
            "pickup_trend": pickup_trend,
            "call_outcomes": call_outcomes,
            "intent_distribution": intent_distribution
        }
    }
    
@router.post("/sync-bookings")
def sync_bookings( 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    # Call Echoleads API
    client = EcholeadsClient()
    response = client.fetch_bookings()

    bookings = response.get("bookings", [])

    inserted_records = []

    for booking in bookings:
        
        call_id = booking.get("call_id")
        
        call_log = db.query(CallLog).filter(
            CallLog.external_call_a_id == call_id
        ).first()
        
        if not call_log or not call_log.external_call_a_id:
            continue

        # Avoid duplicate insert
        existing = (
            db.query(Appointment)
            .filter(Appointment.session_id == call_log.external_call_a_id)
            .first()
        )

        if existing:
            continue      
        
        contact = db.query(Contact).filter(
            Contact.id == call_log.contact_id   
        ).first() if call_log and call_log.contact_id else None
        
        campaign = db.query(CallCampaign).filter(
            CallCampaign.id == call_log.campaign_id   
        ).first() if call_log and call_log.campaign_id else None
        
        phone = booking.get("customer_number")
        if phone:
            phone = phone if phone.startswith("+") else f"+{phone}"
        else:
            phone = None  # or handle error / skip / raise
        

        appointment = Appointment(
            organization_id=call_log.organization_id,
            session_id=call_log.external_call_a_id,
            widget_id = call_log.agent_id,
            name=contact.name if contact else "Unknown",
            phone=phone,
            appointment_at=parser.parse(booking.get("start_date")),
            status="booked",

            # Optional fields
            email=None,
            notes=None,
            timezone= campaign.schedule.timezone if campaign else "UTC",
        )

        db.add(appointment)
        inserted_records.append(appointment)

    db.commit()

    return inserted_records


@router.get("/org/calling-numbers")
def get_calling_numbers(
    params: CallingNumberRequest = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(OrganizationCallingNumber).filter(
        OrganizationCallingNumber.organization_id == current_user.organization_id,
        OrganizationCallingNumber.is_active == True,
        OrganizationCallingNumber.type == params.type
    ).all()