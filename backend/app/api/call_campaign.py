import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends
from app.database import get_db
from sqlalchemy.orm import Session
from app.schemas.call_campaign import CampaignCreate, CampaignUpdate, ContactByIdsRequest, ContactCreate
from app.services import call_campaign_service as service
from app.models.user import User
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/call-campaigns", 
    tags=["call-campaign"],
    dependencies=[Depends(get_current_user)]
)

@router.get("/stats")
def get_campaign_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.get_campaign_stats(db, current_user.organization_id)

@router.get("/all")
def list_campaigns( 
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db)):
    return service.list_campaigns(db, search, skip, limit)

@router.get("/{campaign_id:int}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    return service.get_campaign(db, campaign_id)

@router.get("/{campaign_id:int}/detail")
def get_campaign_detail(campaign_id: int, db: Session = Depends(get_db)):
    return service.get_campaign_detail(db, campaign_id)

@router.post("/create") 
def create_campaign( 
    data: CampaignCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.create_campaign(db,current_user.organization_id, data)

@router.put("/update/{campaign_id:int}")
def update_campaign(
    campaign_id: int,
    data: CampaignUpdate,
    db: Session = Depends(get_db)
):
    return service.update_campaign(db, campaign_id, data)


@router.post("/{campaign_id:int}/delete")
def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db)
):
    return service.delete_campaign(db, campaign_id)

@router.post("/contacts/by-ids")
def get_contacts_by_ids(params: ContactByIdsRequest, db: Session = Depends(get_db)):
    return service.get_contacts_by_ids(db, params.ids)

@router.get("/contacts")
def get_contacts(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)):
    return service.get_contacts(db, search, skip, limit)

@router.get("/contacts/lookup")
def contacts_lookup(db: Session = Depends(get_db)):
    return service.get_contacts_lookup(db)

@router.get("/contact-lists")
def get_contact_lists(db: Session = Depends(get_db)):
    return service.get_contact_lists(db)

@router.post("/contacts/create")
def create_contact(data: ContactCreate, db: Session = Depends(get_db)):
    return service.create_contact(db, data)

@router.put("/contacts/update/{contact_id:int}")
def update_contact(contact_id: int, data: ContactCreate, db: Session = Depends(get_db)):
    return service.update_contact(db, contact_id, data)