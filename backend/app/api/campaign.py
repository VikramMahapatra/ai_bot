import logging
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends
from backend.app.database import get_db
from sqlalchemy.orm import Session
from backend.app.schemas.campaign import CampaignCreate, CampaignUpdate
from backend.app.services import campaign_service as service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/campaigns", tags=["campaign"])

@router.get("/all")
def list_campaigns(db: Session = Depends(get_db)):
    return service.list_campaigns(db)

@router.post("/create") 
def create_campaign( data: CampaignCreate, db: Session = Depends(get_db)):
    return service.create_campaign(db, data)

@router.put("/{campaign_id:int}/update")
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