
from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session
from app.models.campaign_contacts import CampaignContact
from app.models.campaign_schedules import CampaignSchedule
from app.models.call_campaigns import CallCampaign
from app.schemas.call_campaign import CampaignCreate, CampaignUpdate, ContactCreate
from app.models.campaign import Contact, ContactList


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

def create_campaign(
    db: Session ,
    data: CampaignCreate
):

    campaign = CallCampaign(
        name=data.name,
        description=data.description,
        category=data.category,
        priority=data.priority,
        agent_id=data.agent_id
    )

    db.add(campaign)
    db.flush()

    # contacts
    for contact_id in data.contacts:
        cc = CampaignContact(
            campaign_id=campaign.id,
            contact_id=contact_id
        )
        db.add(cc)

    # schedule
    s = data.schedule

    schedule = CampaignSchedule(
        campaign_id=campaign.id,
        start_datetime=s["start_datetime"],
        timezone=s["timezone"],
        call_start_time=s["call_start_time"],
        call_end_time=s["call_end_time"],
        call_interval=s["call_interval"],
        active_days=",".join(s["active_days"]),
        max_retry_attempts=s["max_retry_attempts"],
        retry_interval=s["retry_interval"],
        retry_no_answer=s["retry_no_answer"],
        retry_busy=s["retry_busy"],
        retry_voicemail=s["retry_voicemail"]
    )

    db.add(schedule)
    db.commit()

    return {"message": "Campaign created"}

def update_campaign(
    db: Session ,
    campaign_id: str,
    data: CampaignUpdate,
):

    campaign = db.query(CallCampaign).filter(
        CallCampaign.id == campaign_id,
        CallCampaign.is_deleted == False
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # update basic fields
    update_data = data.dict(exclude_unset=True)

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
    if data.schedule is not None:

        schedule = db.query(CampaignSchedule).filter(
            CampaignSchedule.campaign_id == campaign_id
        ).first()

        s = data.schedule

        if not schedule:
            schedule = CampaignSchedule(campaign_id=campaign_id)
            db.add(schedule)

        schedule.start_datetime = s.get("start_datetime")
        schedule.timezone = s.get("timezone")
        schedule.call_start_time = s.get("call_start_time")
        schedule.call_end_time = s.get("call_end_time")
        schedule.call_interval = s.get("call_interval")

        if s.get("active_days"):
            schedule.active_days = ",".join(s["active_days"])

        schedule.max_retry_attempts = s.get("max_retry_attempts")
        schedule.retry_interval = s.get("retry_interval")
        schedule.retry_no_answer = s.get("retry_no_answer")
        schedule.retry_busy = s.get("retry_busy")
        schedule.retry_voicemail = s.get("retry_voicemail")

    db.commit()

    return {"message": "Campaign updated"}

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


def get_contact_lists(db: Session):
    return db.query(ContactList).all()


def create_contact(db: Session, data: ContactCreate):
    contact = Contact(**data.dict())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def update_contact(db: Session, contact_id: int, data: ContactCreate):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()

    for key, value in data.dict().items():
        setattr(contact, key, value)

    db.commit()
    return contact