
from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, joinedload
from app.models.campaign_contacts import CampaignContact
from app.models.campaign_schedules import CampaignSchedule
from app.models.call_campaigns import CallCampaign
from app.schemas.call_campaign import CampaignCreate, CampaignUpdate, ContactCreate
from app.models.campaign import Contact, ContactList
from app.utils.echoleads_client import EcholeadsClient
from app.models.calling_agents import CallingAgent


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
        if status == "Active":
            result["activeCampaigns"] = count
        elif status == "Paused":
            result["pausedCampaigns"] = count
        elif status == "Completed":
            result["completedCampaigns"] = count

    return result

def list_campaigns(
    db: Session,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10
):

    base_query = (
        db.query(
            CallCampaign.id,
            CallCampaign.name,
            CallCampaign.category,
            CallCampaign.status,
            func.count(CampaignContact.id).label("contacts"),
            func.sum(
                case(
                    (CampaignContact.status == "Completed", 1),
                    else_=0
                )
            ).label("completed_contacts")
        )
        .outerjoin(CampaignContact, CallCampaign.id == CampaignContact.campaign_id)
        .group_by(CallCampaign.id)
    )

    # SEARCH FILTER
    if search:
        base_query = base_query.filter(
            CallCampaign.name.ilike(f"%{search}%")
        )

    # TOTAL COUNT (before pagination)
    total = base_query.count()

    # PAGINATION
    results = (
        base_query
        .offset(skip)
        .limit(limit)
        .all()
    )

    rows = []

    for r in results:
        progress = 0
        if r.contacts:
            progress = int((r.completed_contacts or 0) / r.contacts * 100)

        rows.append({
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "status": r.status,
            "contacts": r.contacts,
            "progress": progress
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

        # Contacts → return contact_ids
        "contacts": [c.contact_id for c in campaign.contacts],

        # Schedule
        "start_datetime": schedule.start_datetime if schedule else None,
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
    
def create_campaign(db: Session, organization_id: int, data: CampaignCreate):

    if data.start_datetime:
        status = "scheduled"
        send_option = "schedule"
    else:
        status = "active"
        send_option = "instant"
        
    agent = db.query(CallingAgent).filter(
            CallingAgent.external_agent_a_id == data.agent_id
        ).first()

    external_contact_ids = get_external_contact_ids(db, data.contacts)
    
    payload = {
        "campaign_name": data.name,
        "agent_id": agent.external_agent_id,
        "from_number": data.from_number,
        "send_option": send_option,
        "schedule_date": data.start_datetime.split("T")[0] if data.start_datetime else None,
        "schedule_time": data.start_datetime.split("T")[1][:5] if data.start_datetime else None,
        "timezone": data.timezone,
        "concurrency_reserved": 2,
        "concurrency_allocated": 5,
        "contact_ids": external_contact_ids,
        "retries": data.max_retry_attempts,
        "retry_after": data.retry_interval
    }

    client = EcholeadsClient()

    response = client.create_campaign(payload)

    if not response.get("success"):
        raise HTTPException(status_code=400, detail="Failed to create campaign in Echoleads")

    echoleads_campaign_id = response["campaign"]["id"]
    echoleads_campaign_status = response["campaign"]["status"]

    campaign = CallCampaign(
        organization_id=organization_id,
        name=data.name,
        description=data.description,
        category=data.category,
        priority=data.priority,
        agent_id=data.agent_id,
        status= echoleads_campaign_status if echoleads_campaign_status else status,
        external_campaign_id=echoleads_campaign_id
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
        timezone=data.timezone,
        call_start_time=data.call_start_time,
        call_end_time=data.call_end_time,
        call_interval=data.call_interval,
        active_days=",".join(data.active_days),
        max_retry_attempts=data.max_retry_attempts,
        retry_interval=data.retry_interval,
        retry_no_answer=data.retry_on_no_answer,
        retry_busy=data.retry_on_busy,
        retry_voicemail=data.retry_on_voicemail
    )

    db.add(schedule)
    db.commit()

    return {
        "message": "Campaign created",
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

    update_data = data.dict(exclude_unset=True)
    
    # Determine campaign status
    if data.start_datetime:
        campaign.status = "scheduled"
    else:
        campaign.status = "active"  # Send Now

    # update basic fields
    for field in ["name", "description", "category", "priority", "agent_id"]:
        if field in update_data:
            setattr(campaign, field, update_data[field])

    # update contacts
    if data.contacts is not None:

        db.query(CampaignContact).filter(
            CampaignContact.campaign_id == campaign_id
        ).delete()

        for contact_id in data.contacts:
            cc = CampaignContact(
                campaign_id=campaign_id,
                contact_id=contact_id
            )
            db.add(cc)

    # update schedule
    schedule = db.query(CampaignSchedule).filter(
        CampaignSchedule.campaign_id == campaign_id
    ).first()

    if not schedule:
        schedule = CampaignSchedule(campaign_id=campaign_id)
        db.add(schedule)

    if data.start_datetime is not None:
        schedule.start_datetime = datetime.fromisoformat(data.start_datetime)

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

    db.commit()

    return {
        "message": "Campaign updated",
        "campaign_id": campaign.id
    }

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

    campaign.is_deleted = True

    db.commit()

    return {"message": "Campaign deleted"}


#### Campaign Contacts

def get_contacts_by_ids(db: Session, ids: list[int]):
    return db.query(Contact).filter(Contact.id.in_(ids)).all()

def get_contacts(
    db: Session,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):

    query = (
        db.query(Contact)
        .join(ContactList, Contact.contact_list_id == ContactList.id)
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
                "name": row.name,
                "email": row.email,
                "phone": row.phone,
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
    
def get_contacts_lookup(db: Session):

    rows = (
        db.query(Contact)
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
        }
        for row in rows
    ]


def get_contact_lists(db: Session):
    return db.query(ContactList).all()


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


def get_external_contact_ids(db: Session, contact_ids: list[int]) -> list[int]:

    client = EcholeadsClient()
    external_contact_ids = []

    contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()

    contact_map = {c.id: c for c in contacts}

    for cid in contact_ids:

        contact = contact_map.get(cid)

        if not contact:
            raise HTTPException(status_code=404, detail=f"Contact {cid} not found")

        # Already synced
        if contact.external_contact_id:
            external_contact_ids.append(contact.external_contact_id)
            continue

        # Create contact in EchoLeads
        payload = {
            "firstName": contact.first_name,
            "phone": contact.phone
        }

        response = client.create_contact(payload)

        if not response.get("success"):
            raise HTTPException(status_code=400, detail="Failed to create contact in Echoleads")

        external_id = response["contact"]["id"]

        contact.external_contact_id = external_id
        external_contact_ids.append(external_id)

    db.commit()

    return external_contact_ids