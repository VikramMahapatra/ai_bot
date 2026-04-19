import logging
from typing import Optional

from fastapi import APIRouter, Depends
from requests import Session
from app.auth import get_current_user
from app.services import workflow_service as service
from app.database import get_db
from app.models.user import User
from app.schemas.workflow import WorkflowCreate, WorkflowRequest


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

@router.get("/{workflow_id:int}")
def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    return service.get_workflow_by_id(
        db,
        workflow_id,
        user.organization_id
    )

@router.get("/lookup")
def get_workflow_lookup(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.workflow_lookup(db, current_user.organization_id, search)



@router.post("/create", response_model=None)
def create(
    data : WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return service.save_workflow(db, current_user.organization_id, data)


@router.put("/{workflow_id:int}")
def update(
    workflow_id: int,
    payload: WorkflowCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return service.update_workflow(
        db,
        workflow_id,
        user.organization_id,
        payload
    )