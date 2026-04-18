import logging
from typing import Optional

from fastapi import APIRouter, Depends
from requests import Session
from app.auth import get_current_user
from app.services import workflow_service as service
from app.database import get_db
from app.models.user import User
from app.schemas.workflow import WorkflowRequest


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/workflows", 
    tags=["workflows"],
    dependencies=[Depends(get_current_user)]
)

    
@router.get("/all") 
def get_all(
    params: WorkflowRequest = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.get_all(db, current_user.organization_id, params.skip, params.limit, params.search)


@router.get("/lookup")
def get_workflow_lookup(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.workflow_lookup(db, current_user.organization_id, search)