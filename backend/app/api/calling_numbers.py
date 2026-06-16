import logging
from typing import Optional

from fastapi import APIRouter, Depends
from requests import Session
from app.auth import require_superadmin
from app.database import get_db
from app.models.user import User
from app.schemas.calling_number import (
    CallingNumberCreate,
    CallingNumberRequest,
    CallingNumberUpdate,
)
from app.models.super_admin import SuperAdmin
from app.services import calling_number_service as service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/superadmin/calling-numbers",
    tags=["superadmin"],
    dependencies=[Depends(require_superadmin)],
)


@router.post("/create", response_model=None)
def create(
    data: CallingNumberCreate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.create(db, data)


@router.get("/all")
def get_all(
    params: CallingNumberRequest = Depends(),
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.get_all(db, params.skip, params.limit, params.search)


@router.put("/update/{calling_number_id}", response_model=None)
def update(
    calling_number_id: int,
    data: CallingNumberUpdate,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.update(db, calling_number_id, data)


@router.delete("/delete/{calling_number_id}", response_model=None)
def delete(
    calling_number_id: int,
    db: Session = Depends(get_db),
    superadmin: SuperAdmin = Depends(require_superadmin),
):
    return service.soft_delete(db, calling_number_id)
