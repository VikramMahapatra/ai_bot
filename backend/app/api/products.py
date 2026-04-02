import logging
from typing import Optional

from fastapi import APIRouter, Depends
from requests import Session
from app.auth import get_current_user
from app.services import product_service as service
from app.schemas.product import ProductCreate, ProductRequest, ProductUpdate
from app.database import get_db
from app.models.user import User


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/products", 
    tags=["call-campaign"],
    dependencies=[Depends(get_current_user)]
)

@router.post("/create", response_model=None)
def create(
    data : ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.create(db, current_user.organization_id, data)
    
@router.get("/all") 
def get_all(
    params: ProductRequest = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.get_all(db, current_user.organization_id, params.skip, params.limit, params.search)

@router.put("/update/{product_id}", response_model=None)
def update(
    product_id: int,
    data : ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.update(db, current_user.organization_id, product_id, data)

@router.delete("/delete/{product_id}", response_model=None)
def delete(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.soft_delete(db, product_id)


@router.get("/lookup")
def get_agent_lookup(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.product_lookup(db, current_user.organization_id, search)