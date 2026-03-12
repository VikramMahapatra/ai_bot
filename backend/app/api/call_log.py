import logging
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends
from backend.app.database import get_db
from sqlalchemy.orm import Session
from backend.app.schemas.call_log import CallLogCreate
from backend.app.services import call_log_service as service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/call-log", tags=["call-log"])


@router.post("/create")
def create_call_log(data: CallLogCreate, db: Session = Depends(get_db)):
    return service.create_call_log(db, data)

@router.get("/all")
def get_call_logs(db: Session = Depends(get_db)):
    return service.get_call_logs(db)