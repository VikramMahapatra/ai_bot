from datetime import date, datetime
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from app.database import get_db
from sqlalchemy.orm import Session
from app.schemas.call_log import CallLogCreate, CallLogRequest, MoveToFunnelRequest
from app.services import call_log_service as service
from app.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/call-log", 
    tags=["call-log"],
    dependencies=[Depends(get_current_user)]
)


@router.post("/create")
def create_call_log(data: CallLogCreate, db: Session = Depends(get_db)):
    return service.create_call_log(db, data)

@router.get("/all")
def get_call_logs(
    background_tasks: BackgroundTasks,
    params: CallLogRequest = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.get_call_logs(background_tasks, db, current_user.organization_id, params)

@router.get("/contacts-by-type")
def get_call_contacts_by_type(
    campaign_id: int = Query(...),
    type: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.get_contacts_by_type(db, current_user.organization_id, campaign_id, type)


@router.post("/sync-call-logs")
def sync_call_logs(
    params: CallLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.sync_call_logs(db, current_user.organization_id, params.campaign_id, params.from_date, params.end_date)


