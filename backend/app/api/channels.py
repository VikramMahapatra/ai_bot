import logging
from typing import Optional

from fastapi import APIRouter, Depends
from requests import Session
from app.auth import require_superadmin
from app.database import get_db
from app.models.user import User
from app.schemas.channel import ChannelCreate, ChannelRequest, ChannelUpdate
from app.models.super_admin import SuperAdmin
from app.services import channel_service as service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/superadmin/channels",
    tags=["superadmin"],
    dependencies=[Depends(require_superadmin)],
)


@router.post("/create", response_model=None)
def create(
    data: ChannelCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.create(db, data)


@router.get("/all")
def get_all(
    params: ChannelRequest = Depends(),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.get_all(db, params.skip, params.limit, params.search)


@router.put("/update/{channel_id}", response_model=None)
def update(
    channel_id: int,
    data: ChannelUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.update(db, channel_id, data)


@router.delete("/delete/{channel_id}", response_model=None)
def delete(
    channel_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.soft_delete(db, channel_id)
