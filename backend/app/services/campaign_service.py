
from datetime import datetime
from typing import List
from fastapi import HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session
from backend.app.models.campaign_contacts import CampaignContact
from backend.app.models.campaign_schedules import CampaignSchedule
from backend.app.models.campaigns import Campaign
from backend.app.schemas.campaign import CampaignCreate, CampaignUpdate

def list_campaigns(db: Session):
    results = (
        db.query(
            Campaign.id,
            Campaign.name,
            Campaign.category,
            Campaign.status,
            func.count(CampaignContact.id).label("contacts"),
            func.sum(
                case(
                    (CampaignContact.status == "Completed", 1),
                    else_=0
                )
            ).label("completed_contacts")
        )
        .outerjoin(CampaignContact, Campaign.id == CampaignContact.campaign_id)
        .group_by(Campaign.id)
        .all()
    )

    campaigns = []

    for r in results:

        progress = 0
        if r.contacts:
            progress = int((r.completed_contacts or 0) / r.contacts * 100)

        campaigns.append({
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "status": r.status,
            "contacts": r.contacts,
            "progress": progress
        })

    return campaigns

def create_campaign(
    db: Session ,
    data: CampaignCreate
):

    campaign = Campaign(
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

    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.is_deleted == False
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

    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.is_deleted == False
    ).first()

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.is_deleted = True

    db.commit()

    return {"message": "Campaign deleted"}