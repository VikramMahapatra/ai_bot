
from datetime import datetime, timedelta, timezone
import json
import logging
from typing import List, Optional
from urllib import response
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import case, func, literal, or_
from sqlalchemy.orm import Session, joinedload
from app.models.campaign_contacts import CampaignContact
from app.models.campaign_schedules import CampaignSchedule
from app.models.call_campaigns import CallCampaign
from app.schemas.call_campaign import CampaignCreate, CampaignLookupParameters, CampaignStatusUpdate, CampaignUpdate, ContactCreate
from app.models.campaign import Contact, ContactList
from app.utils.echoleads_client import EcholeadsClient
from app.models.calling_agents import CallingAgent
from app.models.call_logs import CallLog, CallTranscript
from app.services.call_log_service import process_call, save_transcripts
from app.models.user import Organization
from app.models.organization_limits import OrganizationLimits
from app.models.call_campaign_analytics import CampaignAIRecommendation, CampaignKeyInsight, CampaignSentiment
from app.models.products import Product


STALE_MINUTES = 1
SYNC_STATUSES = ["active", "running", "pending", "scheduled"] 

logger = logging.getLogger(__name__)


def should_sync(campaign):
    if campaign.status not in SYNC_STATUSES:
        return False

    # if not campaign.updated_at:
    #     return True

    #return campaign.updated_at < datetime.utcnow() - timedelta(minutes=STALE_MINUTES)
    return True


def get_campaign_stats(db: Session, organization_id: int):

    stats = db.query(
        CallCampaign.status,
        func.count(CallCampaign.id)
    ).filter(
        CallCampaign.organization_id == organization_id,
        CallCampaign.is_deleted == False
    ).group_by(CallCampaign.status).all()

    result = {
        "totalCampaigns": 0,
        "activeCampaigns": 0,
        "pausedCampaigns": 0,
        "completedCampaigns": 0
    }

    for status, count in stats:
        result["totalCampaigns"] += count
        if status == "active":
            result["activeCampaigns"] = count
        elif status == "paused":
            result["pausedCampaigns"] = count
        elif status == "completed":
            result["completedCampaigns"] = count

    return result

def list_campaigns(
    db: Session,
    organization_id:int,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10
):
    ###SYNC FROM ECHOLEAD
    campaign_models = db.query(CallCampaign).filter(
        CallCampaign.is_deleted == False,
        CallCampaign.organization_id == organization_id
    )

    if search:
        campaign_models = campaign_models.filter(
            CallCampaign.name.ilike(f"%{search}%")
        )

    campaign_models = campaign_models.order_by(CallCampaign.created_at.desc()).offset(skip).limit(limit).all()
    
    echolead_client = EcholeadsClient()

    for campaign in campaign_models:
        if should_sync(campaign):
            sync_campaign_from_echoleads(db, echolead_client, campaign)

    db.commit()

    base_query = (
        db.query(
            CallCampaign.id,
            CallCampaign.name,
            CallCampaign.category,
            CallCampaign.status,
            CallCampaign.created_at,
            CallingAgent.name.label("agent_name"),
            CallCampaign.calling_no,
            (Product.name + " (" + Product.code + ")").label("product_name"),
            CallCampaign.total_calls,
            CallCampaign.completed_calls,
            func.count(CampaignContact.id).label("contact_count")
        )
        .join(CallingAgent, CallingAgent.id == CallCampaign.agent_id)
        .outerjoin(Product, Product.id == CallCampaign.product_id)
        .outerjoin(CampaignContact, CallCampaign.id == CampaignContact.campaign_id)
        .filter(CallCampaign.organization_id == organization_id, CallCampaign.is_deleted == False)
        .group_by(CallCampaign.id)
    )

    # SEARCH FILTER
    if search:
        base_query = base_query.filter(
            CallCampaign.name.ilike(f"%{search}%")
        )

    # TOTAL COUNT (before pagination)
    total = base_query.count()
    
    print(total)

    # PAGINATION
    campaigns = (
        base_query
        .order_by(CallCampaign.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    rows = []
    for campaign in campaigns:
        progress = 0
        if campaign.total_calls:
            progress = int((campaign.completed_calls / campaign.total_calls) * 100)
            
        rows.append({
            "id": campaign.id,
            "name": campaign.name,
            "category": campaign.category,
            "agent_name": campaign.agent_name,
            "product_name": campaign.product_name,
            "calling_no": campaign.calling_no,
            "status": campaign.status,
            "contacts": campaign.contact_count,
            "progress": progress,
            "created_at": campaign.created_at.replace(tzinfo=timezone.utc).isoformat()
        })

    return {
        "items": rows,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }
    
def get_campaign(db: Session, campaign_id: int):

    campaign = (
        db.query(CallCampaign)
        .options(
            joinedload(CallCampaign.contacts),
            joinedload(CallCampaign.schedule)
        )
        .filter(CallCampaign.id == campaign_id)
        .first()
    )

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    schedule = campaign.schedule

    return {
        "id": campaign.id,
        "name": campaign.name,
        "description": campaign.description,
        "category": campaign.category,
        "priority": campaign.priority,
        "agent_id": campaign.agent_id,
        "calling_no": campaign.calling_no,
        "product_id": campaign.product_id,
        
        # Contacts → return contact_ids
        "contacts": [c.contact_id for c in campaign.contacts],

        # Schedule
        "start_datetime": schedule.start_datetime if schedule else None,
        "end_datetime": schedule.end_datetime if schedule else None,
        "timezone": schedule.timezone if schedule else None,
        "call_start_time": schedule.call_start_time if schedule else None,
        "call_end_time": schedule.call_end_time if schedule else None,
        "call_interval": schedule.call_interval if schedule else None,

        # Convert "Mon,Tue,Wed" → ["Mon","Tue","Wed"]
        "active_days": schedule.active_days.split(",") if schedule and schedule.active_days else [],

        "max_retry_attempts": schedule.max_retry_attempts if schedule else None,
        "retry_interval": schedule.retry_interval if schedule else None,

        "retry_on_no_answer": schedule.retry_no_answer if schedule else None,
        "retry_on_busy": schedule.retry_busy if schedule else None,
        "retry_on_voicemail": schedule.retry_voicemail if schedule else None
    }
    
def get_campaign_detail(db: Session, campaign_id: int):
    campaign = (
        db.query(
            CallCampaign,
            Product.name.label("product_name"),
            CampaignSchedule
        )
        .outerjoin(Product, Product.id == CallCampaign.product_id)
        .outerjoin(CampaignSchedule, CampaignSchedule.campaign_id == CallCampaign.id)
        .filter(
            CallCampaign.id == campaign_id,
            CallCampaign.is_deleted == False
        )
        .first()
    )

    if not campaign:
        return None

    campaign_obj, product_name, schedule = campaign
    
    send_option = "scheduled" if schedule and (schedule.start_datetime or schedule.active_days) else "instant"

        # Total contacts
    total_contacts = db.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign_id
    ).count()

    scheduled_calls = db.query(CallLog).filter(
        CallLog.campaign_id == campaign_id,
        CallLog.status == "Scheduled"
    ).count()

    return {
        "id": campaign_obj.id,
        "name": campaign_obj.name,
        "category": campaign_obj.category,

        "send_option": send_option,

        "scheduled_at": schedule.start_datetime if schedule else None,
        "timezone": schedule.timezone if schedule else None,
        "call_start_time": schedule.call_start_time if schedule else None,
        "call_end_time": schedule.call_end_time if schedule else None,
        "call_interval": schedule.call_interval if schedule else None,
        "active_days": schedule.active_days if schedule else None,

        "agent_name": campaign_obj.agent.name,
        "calling_no": campaign_obj.calling_no,
        "product_name": product_name,

        "status": campaign_obj.status,
        "created_at": campaign_obj.created_at,
        "total_calls": campaign_obj.total_calls,
        "completed_calls": campaign_obj.completed_calls,
        "success_rate": campaign_obj.success_rate,
        "response_rate": campaign_obj.response_rate,

        "total_contacts": total_contacts,
        "scheduled_calls": scheduled_calls,
    }
    
def create_campaign(db: Session, organization_id: int, data: CampaignCreate):
    org = db.query(Organization).filter(
        Organization.id == organization_id
    ).first()
    
    limits = db.query(OrganizationLimits).filter(
        OrganizationLimits.organization_id == organization_id
    ).first()

    # Count existing agents
    existing_campaigns_count = db.query(CallCampaign).filter(
        CallCampaign.organization_id == organization_id,
        CallCampaign.status.in_(["completed", "running", "scheduled"]) 
    ).count()

    # Check max_agents limit
    if limits and limits.max_agents is not None and limits.max_agents > 0:
        if existing_campaigns_count >= limits.max_campaigns:
            raise HTTPException(
                status_code=400,
                detail = f"Cannot create campaign. Maximum allowed agents: {limits.max_campaigns}"
            )
            
    total_calls_used = db.query(CallLog).filter(
        CallLog.organization_id == organization_id,
        CallLog.status.in_(["queued", "ended", "completed"])
    ).count()
    
    contacts_count = len(data.contacts)
    retries = data.max_retry_attempts or 0

    calls_needed = contacts_count * (1 + retries)
            
    if limits and limits.max_calls is not None and limits.max_calls > 0:
        if total_calls_used + calls_needed > limits.max_calls:
            raise HTTPException(
                status_code=400,
                detail=f"Call limit exceeded. Allowed: {limits.max_calls}, Used: {total_calls_used}, Required: {calls_needed}"
            )
            
    if data.start_datetime or data.active_days:
        status = "scheduled"
        send_option = "schedule"
    else:
        status = "active"
        send_option = "instant"
        
    agent = db.query(CallingAgent).filter(
            CallingAgent.id == data.agent_id
        ).first()
    
    unique_campaign_code = f"ORG{org.id}CAM{uuid4().hex[:5]}".upper()

    campaign = CallCampaign(
        organization_id=organization_id,
        name=data.name,
        description=data.description,
        calling_no=data.calling_no,
        category=data.category,
        priority=data.priority,
        agent_id=data.agent_id,
        product_id=data.product_id,
        status= "draft",
        external_campaign_name= unique_campaign_code
    )

    db.add(campaign)
    db.flush()

    # contacts
    for contact_id in data.contacts:
        db.add(
            CampaignContact(
                campaign_id=campaign.id,
                contact_id=contact_id
            )
        )

    # schedule
    schedule = CampaignSchedule(
        campaign_id=campaign.id,
        start_datetime=datetime.fromisoformat(data.start_datetime) if data.start_datetime else None,
        end_datetime=datetime.fromisoformat(data.end_datetime) if data.end_datetime else None,
        timezone=data.timezone,
        call_start_time=data.call_start_time,
        call_end_time=data.call_end_time,
        call_interval=data.call_interval,
        active_days=",".join(data.active_days) if data.active_days else None,
        max_retry_attempts=data.max_retry_attempts,
        retry_interval=data.retry_interval,
        retry_no_answer=data.retry_on_no_answer,
        retry_busy=data.retry_on_busy,
        retry_voicemail=data.retry_on_voicemail
    )
    db.add(schedule)
    
    external_contact_ids = get_external_contact_ids(db, data.contacts)
    
    contacts = db.query(Contact).filter(
        Contact.id.in_(data.contacts)
    ).all()
    
    contacts_payload = [
        {
            "id": contact.external_contact_id,
            "other_fields": [
                {
                    "field": "name",
                    "value": contact.name,
                    "mergeField": "name"
                }
            ]
        }
        for contact in contacts
    ]
    
    dialer_start_date = None
    dialer_end_date = None
    schedule_date = None
    schedule_time = None

    if data.start_datetime:
        schedule_date = data.start_datetime.split("T")[0]
        schedule_time = data.call_start_time
        dialer_start_date = schedule_date

    if data.end_datetime:
        dialer_end_date = data.end_datetime.split("T")[0]
        
    # Active Days Selected
    if data.active_days and not data.start_datetime:
        today = datetime.utcnow().date()
        ten_years_later = today.replace(year=today.year + 10)

        dialer_start_date = today.isoformat()
        dialer_end_date = ten_years_later.isoformat()
        
        schedule_date = dialer_start_date
        schedule_time = data.call_start_time
    
    payload = {
        "campaign_name": unique_campaign_code,
        "agent_id": agent.external_agent_id,
        "from_number": data.calling_no,
        "send_option": send_option,
        "schedule_date": schedule_date,
        "schedule_time": schedule_time,
        "dialer_schedule_start_date": dialer_start_date,
        "dialer_schedule_end_date": dialer_end_date,
        "timezone": data.timezone,
        "concurrency_reserved": 2,
        "concurrency_allocated": 5,
        "contact_ids": external_contact_ids,
        "retries": data.max_retry_attempts,
        "retry_after": data.retry_interval,
        "contacts": contacts_payload,
        "dialer_schedule_days": build_schedule_days(data)
    }

    client = EcholeadsClient()
    echo_failed = False
    echoleads_campaign_id = None
    echoleads_campaign_status = "draft"
    try:
        echo_response = client.create_campaign(payload)
        
        if echo_response and "campaign" in echo_response:
            echoleads_campaign_id = echo_response["campaign"]["id"]
            echoleads_campaign_status = echo_response["campaign"]["status"]
        else:
            echo_failed = True
    except Exception as e:
        print(f"EchoLeads API failed: {str(e)}")
        echo_failed = True
        
    campaign.status = echoleads_campaign_status
    campaign.external_campaign_id = echoleads_campaign_id
    
    db.flush() 
    db.commit()    
    
    if echo_failed:
        message = "Campaign created successfully, but sync failed. Please reload the page to sync the campaign."
    else:
        message = "Campaign created successfully"

    return {
        "message": message,
        "campaign_id": campaign.id,
        "echoleads_campaign_id": echoleads_campaign_id
    }

def update_campaign(
    db: Session,
    campaign_id: int,
    data: CampaignUpdate,
):

    campaign = db.query(CallCampaign).filter(
        CallCampaign.id == campaign_id,
        CallCampaign.is_deleted == False
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    org = db.query(Organization).filter(
        Organization.id == campaign.organization_id
    ).first()

    update_data = data.dict(exclude_unset=True)

    # Determine campaign status
    if data.start_datetime or data.active_days:
        campaign.status = "scheduled"
        send_option = "schedule"
    else:
        campaign.status = "active"
        send_option = "instant"

    # Fetch agent external id if agent updated
    agent = None
    if "agent_id" in update_data:
        agent = db.query(CallingAgent).filter(
            CallingAgent.id == update_data["agent_id"]
        ).first()
    else:
        agent = db.query(CallingAgent).filter(
            CallingAgent.id == campaign.agent_id
        ).first()
        
    # update contacts (DB + external)
    external_contact_ids = None
    if data.contacts is not None:

        db.query(CampaignContact).filter(
            CampaignContact.campaign_id == campaign_id
        ).delete()

        for contact_id in data.contacts:
            db.add(
                CampaignContact(
                    campaign_id=campaign_id,
                    contact_id=contact_id
                )
            )

        # get external ids
        external_contact_ids = get_external_contact_ids(db, data.contacts)
        
    contacts = db.query(Contact).filter(
        Contact.id.in_(data.contacts)
    ).all()
    
    contacts_payload = [
        {
            "id": contact.external_contact_id,
            "other_fields": [
                {
                    "field": "name",
                    "value": contact.name,
                    "mergeField": "name"
                }
            ]
        }
        for contact in contacts
    ]
    
    dialer_start_date = None
    dialer_end_date = None
    schedule_date = None
    schedule_time = None

    if data.start_datetime:
        schedule_date = data.start_datetime.split("T")[0]
        schedule_time = data.call_start_time
        dialer_start_date = schedule_date

    if data.end_datetime:
        dialer_end_date = data.end_datetime.split("T")[0]
        
    # Active Days Selected
    if data.active_days and not data.start_datetime:
        today = datetime.utcnow().date()
        ten_years_later = today.replace(year=today.year + 10)

        dialer_start_date = today.isoformat()
        dialer_end_date = ten_years_later.isoformat()
        
        schedule_date = dialer_start_date
        schedule_time = data.call_start_time
        
    unique_campaign_code = f"ORG{org.id}CAM{uuid4().hex[:5]}".upper()
    if not campaign.external_campaign_name:
        campaign.external_campaign_name = unique_campaign_code
        
        
    payload = {
        "campaign_name": campaign.external_campaign_name,
        "agent_id": agent.external_agent_id if agent else None,
        "from_number": data.calling_no,
        "send_option": send_option,
        "schedule_date": schedule_date,
        "schedule_time": schedule_time,
        "dialer_schedule_start_date": dialer_start_date,
        "dialer_schedule_end_date": dialer_end_date,
        "timezone": data.timezone,
        "concurrency_reserved": 2,
        "concurrency_allocated": 5,
        "contact_ids": external_contact_ids,
        "retries": data.max_retry_attempts,
        "retry_after": data.retry_interval,
        "dialer_schedule_days": build_schedule_days(data)
    }
    
    print("Update campaign payload:", payload)

    if external_contact_ids is not None:
        payload["contact_ids"] = external_contact_ids
        payload["contacts"] = contacts_payload
        
    print(payload)

    client = EcholeadsClient()
    echo_failed = False
    try:
        response = client.update_campaign(
            campaign.external_campaign_id,
            payload
        )
        
        if response and "campaign" in response:
            campaign.status = response["campaign"].get("status", campaign.status)
    except Exception as e:
        print(f"EchoLeads API failed: {str(e)}")
        echo_failed = False

    # update basic fields
    for field in ["name", "description", "category", "priority", "agent_id", "calling_no"]:
        if field in update_data:
            setattr(campaign, field, update_data[field])

    # update schedule
    schedule = db.query(CampaignSchedule).filter(
        CampaignSchedule.campaign_id == campaign_id
    ).first()

    if not schedule:
        schedule = CampaignSchedule(campaign_id=campaign_id)
        db.add(schedule)

    if data.start_datetime is not None:
        schedule.start_datetime = datetime.fromisoformat(data.start_datetime)
        
    if data.end_datetime is not None:
        schedule.end_datetime = datetime.fromisoformat(data.end_datetime)

    if data.timezone is not None:
        schedule.timezone = data.timezone

    if data.call_start_time is not None:
        schedule.call_start_time = data.call_start_time

    if data.call_end_time is not None:
        schedule.call_end_time = data.call_end_time

    if data.call_interval is not None:
        schedule.call_interval = data.call_interval

    if data.active_days is not None:
        schedule.active_days = ",".join(data.active_days)

    if data.max_retry_attempts is not None:
        schedule.max_retry_attempts = data.max_retry_attempts

    if data.retry_interval is not None:
        schedule.retry_interval = data.retry_interval

    if data.retry_on_no_answer is not None:
        schedule.retry_no_answer = data.retry_on_no_answer

    if data.retry_on_busy is not None:
        schedule.retry_busy = data.retry_on_busy

    if data.retry_on_voicemail is not None:
        schedule.retry_voicemail = data.retry_on_voicemail
    
    if echo_failed:
        message = "Campaign updated successfully, but sync failed. Please reload the list to sync the campaign."
    else:
        message = "Campaign updated successfully"
        
    db.commit()

    return {
        "success": echo_failed == False,
        "message": message,
        "campaign_id": campaign.id
    }

def build_schedule_days(data):
    schedule_days = {}

    DAY_MAP = {
        "mon": "mon", "monday": "mon",
        "tue": "tue", "tuesday": "tue",
        "wed": "wed", "wednesday": "wed",
        "thu": "thu", "thursday": "thu",
        "fri": "fri", "friday": "fri",
        "sat": "sat", "saturday": "sat",
        "sun": "sun", "sunday": "sun",
    }

    active_days = [
        DAY_MAP.get(day.lower())
        for day in (data.active_days or [])
    ]
    
    print("start date and end date:", data.start_datetime, data.end_datetime)

    if data.start_datetime and data.end_datetime:
        start = datetime.fromisoformat(data.start_datetime)
        end = datetime.fromisoformat(data.end_datetime)

        current = start

        while current <= end:
            date_key = current.strftime("%Y-%m-%d")
            weekday = current.strftime("%a").lower()

            is_active = weekday in active_days

            schedule_days[date_key] = {
                "startTime": data.call_start_time if is_active else None,
                "endTime": data.call_end_time if is_active else None
            }

            current += timedelta(days=1)

    else:
        if data.active_days:
            for day in active_days:
                schedule_days[day] = {
                    "startTime": data.call_start_time,
                    "endTime": data.call_end_time
                }

    return schedule_days

def delete_campaign(
    db: Session,
    campaign_id: int,
):

    campaign = db.query(CallCampaign).filter(
        CallCampaign.id == campaign_id,
        CallCampaign.is_deleted == False
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    
    if campaign.status not in ["draft", "completed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete the campaign because its status is '{campaign.status}'. Only Draft or Completed campaigns can be deleted."
        )
    
    # echoleads = EcholeadsClient()
    
    # echo_payload = {
    #     "status": "paused"
    # }

    # # Update Echoleads agent
    # if campaign.external_campaign_id:
    #     echoleads.update_agent(campaign.external_campaign_id, echo_payload)

    campaign.is_deleted = True

    db.commit()

    return {"message": "Campaign deleted"}


#### Campaign Contacts

def get_contacts_by_ids(db: Session, ids: list[int]):
    contacts = db.query(Contact).filter(Contact.id.in_(ids)).all()
    
    return [
            {
                "id": row.id,
                "label": f"{row.name} ({row.phone})",
                "name": row.name,
                "email": row.email,
                "phone": row.phone,
                "company": row.company,
                "contact_list_id": row.contact_list_id,
                "created_at": row.created_at,
            }
            for row in contacts
        ]

def get_contacts(
    db: Session,
    organization_id: int,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):

    query = (
        db.query(Contact)
        .join(ContactList, Contact.contact_list_id == ContactList.id)
        .filter(ContactList.organization_id == organization_id)
    )

    # ---------------------------
    # Search filter
    # ---------------------------
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Contact.name.ilike(search_term),
                Contact.email.ilike(search_term),
                Contact.phone.ilike(search_term),
                ContactList.list_name.ilike(search_term),
            )
        )

    # ---------------------------
    # Total count (before pagination)
    # ---------------------------
    total = query.count()

    # ---------------------------
    # Pagination
    # ---------------------------
    rows = (
        query
        .order_by(Contact.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # ---------------------------
    # Response
    # ---------------------------
    return {
        "items": [
            {
                "id": row.id,
                "label": f"{row.name} ({row.phone})",
                "name": row.name,
                "email": row.email,
                "phone": row.phone,
                "company": row.company,
                "contact_list_id": row.contact_list_id,
                "created_at": row.created_at,
            }
            for row in rows
        ],
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
        },
    }
    
def get_contacts_lookup(db: Session, organization_id: int):

    rows = (
        db.query(Contact)
        .join(ContactList, Contact.contact_list_id == ContactList.id)
        .filter(ContactList.organization_id == organization_id)
        .order_by(Contact.name.asc())
        .all()
    )

    return [
        {
            "id": row.id,
            "label": f"{row.name} ({row.phone})",
            "name": row.name,
            "email": row.email,
            "phone": row.phone,
            "company": row.company,
        }
        for row in rows
    ]


def get_contact_lists(db: Session, organization_id: int):
    return db.query(ContactList).filter(ContactList.organization_id == organization_id).all()


def create_contact(db: Session, data: ContactCreate):
    contact = Contact(**data.dict())
    db.add(contact)
    db.commit()
    db.refresh(contact)
   
    return {
        **contact.__dict__,
       "label": f"{contact.name} ({contact.phone})"
    }


def update_contact(db: Session, contact_id: int, data: ContactCreate):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()

    for key, value in data.dict().items():
        setattr(contact, key, value)

    db.commit()
    return contact

def update_campaign_status(
    db: Session,
    campaign_id: int,
    data: CampaignStatusUpdate,
):
    # Get the agent
    campaign = db.query(CallCampaign).filter(CallCampaign.id == campaign_id).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if not campaign.external_campaign_id:
        raise HTTPException(status_code=404, detail="Campaign not sync, kindly refresh the campaign list")

    # If pausing, check for active campaigns
    if data.status.lower() == "paused":
        if campaign.status !=  "running":
            raise HTTPException(
                status_code=400,
                detail=f"Only running campaign can be paused"
            )
    elif data.status.lower() == "running":
        if campaign.status !=  "paused":
            raise HTTPException(
                status_code=400,
                detail=f"Only paused campaign can be started"
            )
            
    payload = {
        "status": data.status
    }

    client = EcholeadsClient()
    echo_success = True
    try:
        
        if data.status.lower() == "running": 
            response = client.update_campaign(
                campaign.external_campaign_id,
                payload
            )
            
            if response and "campaign" in response:
                campaign.status = response["campaign"].get("status", campaign.status)
            else:
                echo_success = False
        else:
            response = client.start_campaign(campaign.external_campaign_id)
            campaign.status = "running"
        
    except Exception as e:
        print(f"EchoLeads API failed: {str(e)}")
        echo_success = False

    
    db.commit()
    db.refresh(campaign)
    
    error_status_code = "start" if data.status.lower() == "paused" else "pause"

    return {
        "message": "Campaign status updated" if echo_success else f"Failed to {error_status_code} the campaign",
        "agent_id": campaign.id,
        "status": campaign.status,
        "success": echo_success
    }
    
def campaign_lookup(
    db: Session, 
    organization_id: int,
    params: CampaignLookupParameters):

    query = db.query(
        CallCampaign.id,
        CallCampaign.name
    ).filter(
        CallCampaign.organization_id == organization_id, 
        CallCampaign.is_deleted == False,
    )

    if params.search:
        query = query.filter(
            CallCampaign.name.ilike(f"%{params.search}%")
        )
        
    if params.agent_id:
        query = query.filter(
            CallCampaign.agent_id == params.agent_id
        )
        

    campaigns = query.order_by(CallCampaign.name.asc()).all()

    return [
        {
            "id": campaign.id,
            "name": campaign.name
        }
        for campaign in campaigns
    ]
    
def get_campaign_analytics(
    db: Session,
    campaign_id: int,
    organization_id: int
):
    campaign = (
        db.query(CallCampaign)
        .filter(
            CallCampaign.id == campaign_id,
            CallCampaign.organization_id == organization_id,
            CallCampaign.is_deleted == False
        )
        .first()
    )

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Key Insights
    key_insights = db.query(CampaignKeyInsight).filter(
        CampaignKeyInsight.campaign_id == campaign_id
    ).all()

    # Sentiment
    sentiments = db.query(CampaignSentiment).filter(
        CampaignSentiment.campaign_id == campaign_id
    ).all()

    # AI Recommendations
    ai_recommendations = db.query(CampaignAIRecommendation).filter(
        CampaignAIRecommendation.campaign_id == campaign_id
    ).all()

    # Convert sentiment list to object
    sentiment_map = {
        "positive": 0,
        "neutral": 0,
        "negative": 0
    }

    for s in sentiments:
        sentiment_map[s.sentiment] = s.rate

    return {
        "name": campaign.name,
        "description": campaign.description,
        "total_calls": campaign.total_calls,
        "completed_calls": campaign.completed_calls,
        "avg_duration": getattr(campaign, "avg_duration", "00:00"),
        "response_rate": f"{campaign.response_rate}%",
        "status": campaign.status,

        # Sentiment
        "sentiment": sentiment_map,

        # Timeline
        "timeline": {
            "created_at": campaign.created_at.strftime("%m/%d/%Y, %I:%M %p")
            if campaign.created_at else None,
            "updated_at": campaign.updated_at.strftime("%m/%d/%Y, %I:%M %p")
            if campaign.updated_at else None,
        },

        # Key Insights
        "key_insights": [
            {
                "title": k.title,
                "value": f"{k.percentage}%",
                "change": f"{k.change}%",
                "description": k.description,
                "color": get_insight_color(k.title)
            }
            for k in key_insights
        ],

        # AI Recommendations
        "ai_recommendations": [
            {
                "title": r.recommendation,
                "impact": r.impact_level
            }
            for r in ai_recommendations
        ],

        # Engagement
        "engagement": {
            "engagement_rate": campaign.response_rate,
            "conversion": campaign.success_rate,
            "avg_call_time": getattr(campaign, "avg_duration", "00:00")
        }
    }
    
def get_insight_color(title):
    title = title.lower()

    if "response" in title:
        return "blue"
    if "lead" in title:
        return "purple"
    if "follow" in title:
        return "green"
    if "performance" in title:
        return "orange"

    return "blue"
    
    
############### SYNC METHODS


def get_external_contact_ids(db: Session, contact_ids: list[int]) -> list[int]:

    client = EcholeadsClient()
    external_contact_ids = []

    contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
    contact_map = {c.id: c for c in contacts}

    contacts_to_create = []
    unsynced_contacts = []

    for cid in contact_ids:
        contact = contact_map.get(cid)

        if not contact:
            raise HTTPException(status_code=404, detail=f"Contact {cid} not found")

        # Already synced
        if contact.external_contact_id:
            external_contact_ids.append(contact.external_contact_id)
        else:
            contacts_to_create.append({
                "firstName": contact.name,
                "phone": normalize_phone(contact.phone)
            })
            unsynced_contacts.append(contact)

    if contacts_to_create:
        response = client.create_contacts_bulk(contacts_to_create)
        
        
        print(response)

        if not response.get("success"):
            raise HTTPException(status_code=400, detail="Bulk contact creation failed")

        created_contacts = response.get("contacts", [])
        skipped_contacts = response.get("skipped", [])

        created_map = {
            normalize_phone(c["phone"]): c["id"]
            for c in created_contacts
        }

        skipped_map = {
            normalize_phone(c["phone"]): c["id"]
            for c in skipped_contacts
        }

        combined_map = {**created_map, **skipped_map}
        
        for c in unsynced_contacts:
            print(c.id, c.name, c.phone)

        for contact in unsynced_contacts:
            normalized_phone = normalize_phone(contact.phone)
            external_id = combined_map.get(normalized_phone)

            if not external_id:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to map contact {contact.phone}"
                )

            contact.external_contact_id = external_id
            external_contact_ids.append(external_id)

    db.commit()

    return external_contact_ids

def normalize_phone(phone: str):
    if not phone:
        return None

    phone = phone.strip().replace(" ", "")

    # Add default country code if missing (India example)
    if not phone.startswith("+"):
        phone = "+91" + phone

    return phone


def sync_campaign_from_echoleads(
    db: Session,
    echolead_client: EcholeadsClient,
    campaign: CallCampaign
):
    try:
        # Fetch Campaign
        if campaign.external_campaign_name and not campaign.external_campaign_id:
            
            response = echolead_client.get_campaign_by_name(
                campaign.external_campaign_name
            )
            campaigns = response.get("campaigns", []) if response else []
            campaign_data = campaigns[0] if campaigns else None
        elif  campaign.external_campaign_id:
            response = echolead_client.get_campaign_by_id(
                    campaign.external_campaign_id
                )
            campaign_data = response.get("campaign") if response else None
            

        if not campaign_data:
            return

        # -------------------------
        # Update Basic Campaign Data
        # -------------------------
        campaign.status = campaign_data.get("status", campaign.status)
        campaign.external_campaign_id = campaign_data.get(
            "id", campaign.external_campaign_id
        )
        campaign.updated_at = datetime.utcnow()

        campaign.total_calls = campaign_data.get("total_calls", 0)
        campaign.completed_calls = campaign_data.get("completed_calls", 0)
        campaign.success_rate = campaign_data.get("success_rate", 0.0)
        campaign.response_rate = campaign_data.get("response_rate", 0.0)

        # -------------------------
        # Sync Calls
        # -------------------------
        for call in campaign_data.get("calls", []):
            agent = db.query(CallingAgent).filter(
                CallingAgent.external_agent_id == call.get("agent_id")
            ).first()

            if agent:
                process_call(db, call, agent)

        # -------------------------
        # Clear Old Analytics
        # -------------------------
        db.query(CampaignKeyInsight).filter(
            CampaignKeyInsight.campaign_id == campaign.id
        ).delete()

        db.query(CampaignSentiment).filter(
            CampaignSentiment.campaign_id == campaign.id
        ).delete()

        db.query(CampaignAIRecommendation).filter(
            CampaignAIRecommendation.campaign_id == campaign.id
        ).delete()

        # -------------------------
        # Sync Key Insights
        # -------------------------
        for insight in campaign_data.get("campaign_key_insights", []):
            db.add(
                CampaignKeyInsight(
                    campaign_id=campaign.id,
                    title=insight.get("key_insights_title"),
                    description=insight.get("key_insights_desc"),
                    percentage=insight.get("key_insights_per"),
                    change=insight.get("key_insights_updown")
                )
            )

        # -------------------------
        # Sync Sentiment
        # -------------------------
        for sentiment in campaign_data.get(
            "campaign_sentiment_dists", []
        ):
            db.add(
                CampaignSentiment(
                    campaign_id=campaign.id,
                    sentiment=sentiment.get("sentiment_info"),
                    rate=sentiment.get("sentiment_rate"),
                    value=sentiment.get("sentiment_value")
                )
            )

        # -------------------------
        # Sync AI Recommendations
        # -------------------------
        for rec in campaign_data.get("ai_recommendations", []):
            db.add(
                CampaignAIRecommendation(
                    campaign_id=campaign.id,
                    recommendation=rec.get("recommendation"),
                    impact_level=rec.get("impact_level")
                )
            )

        db.commit()

    except Exception as e:
        print("Sync failed:", str(e))
    

def parse_datetime(dt):
    if not dt:
        return None
    return datetime.fromisoformat(dt.replace("Z", "+00:00"))