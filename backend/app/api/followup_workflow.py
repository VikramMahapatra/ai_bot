import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends
from app.database import get_db
from sqlalchemy.orm import Session
from app.services import followup_workflow_service as service
from app.models.user import User
from app.auth import get_current_user
from app.schemas.followup_workflow import FollowUpWorkflowCreate
from app.models.followup_workflows import FollowUpWorkflow

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/followup-workflows", 
    tags=["followup-workflows"],
    dependencies=[Depends(get_current_user)]
)


@router.post("/")
def create_workflow(
    data: FollowUpWorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return service.create_followup_workflow(
        db,
        current_user.organization_id,
        data
    )
    
@router.get("/")
def list_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return service.get_followup_workflows(
        db,
        current_user.organization_id
    )
    
    
@router.delete("/{workflow_id}")
def delete_workflow(
    workflow_id: int,
    db: Session = Depends(get_db)
):

    db.query(FollowUpWorkflow).filter(
        FollowUpWorkflow.id == workflow_id
    ).delete()

    db.commit()

    return {"message": "Deleted"}