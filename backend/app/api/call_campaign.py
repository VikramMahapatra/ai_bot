from datetime import date
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends
from app.database import get_db
from sqlalchemy.orm import Session
from app.schemas.call_campaign import (
    CampaignCreate,
    CampaignListParams,
    CampaignLookupParameters,
    CampaignStatusUpdate,
    CampaignUpdate,
    ContactByIdsRequest,
    ContactCreate,
)
from app.services import call_campaign_service as service
from app.models.user import User
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/call-campaigns",
    tags=["call-campaign"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/stats")
def get_campaign_stats(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return service.get_campaign_stats(db, current_user.organization_id)


@router.get("/all")
def list_campaigns(
    background_tasks: BackgroundTasks,
    params: CampaignListParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_campaigns(
        background_tasks, db, current_user.organization_id, params
    )


@router.get("/{campaign_id:int}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    return service.get_campaign(db, campaign_id)


@router.get("/{campaign_id:int}/detail")
def get_campaign_detail(
    campaign_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
):
    return service.get_campaign_detail(background_tasks, db, campaign_id)


@router.get("/{campaign_id:int}/contacts/{contact_id:int}/workflow-history")
def get_workflow_history(
    campaign_id: int, contact_id: int, db: Session = Depends(get_db)
):
    return service.get_workflow_history(db, campaign_id, contact_id)


@router.post("/create")
def create_campaign(
    data: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_campaign(db, current_user.organization_id, data)


@router.put("/update/{campaign_id:int}")
def update_campaign(
    campaign_id: int, data: CampaignUpdate, db: Session = Depends(get_db)
):
    return service.update_campaign(db, campaign_id, data)


@router.delete("/{campaign_id:int}/delete")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    return service.delete_campaign(db, campaign_id)


@router.post("/contacts/by-ids")
def get_contacts_by_ids(params: ContactByIdsRequest, db: Session = Depends(get_db)):
    return service.get_contacts_by_ids(db, params.ids)


@router.get("/contacts")
def get_contacts(
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_contacts(
        db, current_user.organization_id, sort_by, search, skip, limit
    )


@router.get("/contacts/lookup")
def contacts_lookup(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return service.get_contacts_lookup(db, current_user.organization_id)


@router.get("/contact-lists")
def get_contact_lists(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return service.get_contact_lists(db, current_user.organization_id)


@router.post("/contacts/create")
def create_contact(data: ContactCreate, db: Session = Depends(get_db)):
    return service.create_contact(db, data)


@router.put("/contacts/update/{contact_id:int}")
def update_contact(contact_id: int, data: ContactCreate, db: Session = Depends(get_db)):
    return service.update_contact(db, contact_id, data)


@router.post("/{campaign_id:int}/status")
def update_campaign_status(
    campaign_id: int, data: CampaignStatusUpdate, db: Session = Depends(get_db)
):
    return service.update_campaign_status(db, campaign_id, data)


@router.get("/lookup")
def get_campaign_lookup(
    params: CampaignLookupParameters = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.campaign_lookup(db, current_user.organization_id, params)


@router.get("/{campaign_id}/analytics")
def campaign_analytics(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_campaign_analytics(db, campaign_id, current_user.organization_id)
