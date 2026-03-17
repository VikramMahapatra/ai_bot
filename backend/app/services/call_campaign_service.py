
from datetime import datetime, timedelta
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
from app.models.call_logs import CallLog
from app.services.call_log_service import save_transcripts


STALE_MINUTES = 1
SYNC_STATUSES = ["active", "pending"] 

def should_sync(campaign):
    if campaign.status not in SYNC_STATUSES:
        return False

    if not campaign.updated_at:
        return True

    return campaign.updated_at < datetime.utcnow() - timedelta(minutes=STALE_MINUTES)


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
    ###SYNC FROM ECHOLEAD
    campaign_models = db.query(CallCampaign).filter(
        CallCampaign.is_deleted == False
    )

    if search:
        campaign_models = campaign_models.filter(
            CallCampaign.name.ilike(f"%{search}%")
        )

    campaign_models = campaign_models.offset(skip).limit(limit).all()
    
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
            CallingAgent.calling_no.label("from_number"),
            CallCampaign.total_calls,
            CallCampaign.completed_calls
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
    campaigns = (
        base_query
        .offset(skip)
        .limit(limit)
        .all()
    )

    rows = []
    
    echolead_client = EcholeadsClient()

    for campaign in campaigns:
        progress = 0
        if campaign.total_calls:
            progress = int((campaign.completed_calls / campaign.total_calls) * 100)
            
        rows.append({
            "id": campaign.id,
            "name": campaign.name,
            "category": campaign.category,
            "agent_name": campaign.agent_name,
            "from_number": campaign.from_number,
            "status": campaign.status,
            "contacts": campaign.total_calls,
            "progress": progress,
            "created_at": campaign.created_at
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
            CallingAgent.id == data.agent_id
        ).first()

    external_contact_ids = get_external_contact_ids(db, data.contacts)
    
    payload = {
        "campaign_name": data.name,
        "agent_id": agent.external_agent_id,
        "from_number": agent.calling_no,
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
        
    payload = {
        "campaign_name": campaign.name,
        "agent_id": agent.external_agent_id if agent else None,
        "send_option": send_option,
        "schedule_date": (
            data.start_datetime.split("T")[0]
            if data.start_datetime else None
        ),
        "schedule_time": (
            data.start_datetime.split("T")[1][:5]
            if data.start_datetime else None
        ),
        "timezone": data.timezone,
        "concurrency_reserved": 2,
        "concurrency_allocated": 5,
        "contact_ids": external_contact_ids,
        "retries": data.max_retry_attempts,
        "retry_after": data.retry_interval
    }

    if external_contact_ids is not None:
        payload["contact_ids"] = external_contact_ids

    client = EcholeadsClient()

    response = client.update_campaign(
        campaign.external_campaign_id,
        payload
    )

    if not response.get("success"):
        raise HTTPException(
            status_code=400,
            detail="Failed to update campaign in Echoleads"
        )

    # update basic fields
    for field in ["name", "description", "category", "priority", "agent_id"]:
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

    

    # sync status from Echoleads
    campaign.status = response["campaign"].get("status", campaign.status)

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
    
    echoleads = EcholeadsClient()
    
    echo_payload = {
        "status": "paused"
    }

    # Update Echoleads agent
    if campaign.external_campaign_id:
        echoleads.update_agent(campaign.external_campaign_id, echo_payload)

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
                "contact_list_id": row.contact_list_id,
                "created_at": row.created_at,
            }
            for row in contacts
        ]

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
                "label": f"{row.name} ({row.phone})",
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
            "firstName": contact.name,
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


def sync_campaign_from_echoleads(db: Session, echolead_client : EcholeadsClient, campaign: CallCampaign):
    if not campaign.external_campaign_id:
        return

    try:
        response = echolead_client.get_campaign_by_id(campaign.external_campaign_id)

        if not response or not response.get("campaign"):
            return

        data = response["campaign"]

        # ✅ Update campaign fields
        campaign.status = data.get("status", campaign.status)
        campaign.updated_at = datetime.utcnow()

        # OPTIONAL: store metrics if you want faster listing later
        total_calls = data.get("total_calls", 0)
        completed_calls = data.get("completed_calls", 0)

        # You can store these in DB if needed
        campaign.total_calls = total_calls
        campaign.completed_calls = completed_calls

        db.add(campaign)

        # ✅ Sync call logs (IMPORTANT)
        for call in data.get("calls", []):
            existing_call = db.query(CallLog).filter(
                CallLog.external_call_id == call["id"]
            ).first()

            if existing_call:
                continue
            
            agent = db.query(CallingAgent).filter(
                CallingAgent.external_agent_id == call.get("agent_id")
            ).first()

            new_call = CallLog(
                external_call_id=call["id"],
                organization_id=campaign.organization_id,
                campaign_id=campaign.id,
                agent_id=agent.id,
                type=agent.type,
                phone=call.get("phone"),
                mode="Voice",
                status=call.get("status"),
                start_time=parse_datetime(call.get("call_started_at")),
                end_time=parse_datetime(call.get("call_ended_at")),
                audio_url=call.get("recording_url"),
                cost=call.get("cost"),
            )

            db.add(new_call)
            db.flush()
            save_transcripts(db, new_call.id, call.get("transcript"))

        db.commit()

    except Exception as e:
        print("Sync failed:", str(e))
        db.rollback()
        
        
def parse_datetime(dt):
    if not dt:
        return None
    return datetime.fromisoformat(dt.replace("Z", "+00:00"))