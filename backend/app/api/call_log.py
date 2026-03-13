from datetime import datetime
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends
from app.database import get_db
from sqlalchemy.orm import Session
from app.schemas.call_log import CallLogCreate
from app.services import call_log_service as service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/call-log", tags=["call-log"])


@router.post("/create")
def create_call_log(data: CallLogCreate, db: Session = Depends(get_db)):
    return service.create_call_log(db, data)

@router.get("/all")
def get_call_logs(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    from_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return service.get_call_logs(db, search, skip, limit, from_date, end_date)