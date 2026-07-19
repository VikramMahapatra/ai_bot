import json
import logging
from typing import Annotated, List, Optional
from uuid import UUID
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    UploadFile,
    HTTPException,
)
from app.schemas.calling_agent import (
    AgentStatusUpdate,
    CallingAgentCreate,
    CallingAgentRead,
    CallingAgentUpdate,
    TestCallRequest,
)
from app.database import get_db
from app.config import settings
from sqlalchemy.orm import Session
from app.services import calling_agent_service as service
from app.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)


def _validate_file_sizes(files: Optional[List[UploadFile]]) -> None:
    """Validate that uploaded files don't exceed size limits."""
    if not files:
        return

    total_size = 0
    for file in files:
        # Check individual file size
        if file.size and file.size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"File '{file.filename}' exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB. Current file size: {file.size / (1024*1024):.2f}MB",
            )
        total_size += file.size or 0

    # Check total upload size
    if total_size > settings.MAX_TOTAL_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Total upload size exceeds maximum allowed size of {settings.MAX_TOTAL_UPLOAD_SIZE_MB}MB. Current total: {total_size / (1024*1024):.2f}MB",
        )


router = APIRouter(
    prefix="/api/calling-agent",
    tags=["calling-agent"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/create", response_model=None)
def create_agent(
    agent: str = Form(...),
    attachments: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_file_sizes(attachments)
    agent_dict = json.loads(agent)
    agent_data = CallingAgentCreate(**agent_dict)
    return service.create_agent(
        db, current_user.organization_id, agent_data, attachments
    )


@router.post("/update/{agent_id:int}", response_model=None)
def update_agent(
    agent_id: int,
    agent: str = Form(...),
    attachments: Optional[Annotated[List[UploadFile], File(multiple=True)]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_file_sizes(attachments)
    agent_dict = json.loads(agent)
    agent_data = CallingAgentUpdate(**agent_dict)
    return service.update_agent(db, agent_id, agent_data, attachments)


@router.get("/all")
def read_agents(
    background_tasks: BackgroundTasks,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    sortBy: str = "newest",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.read_agents(
        background_tasks, db, current_user.organization_id, search, skip, limit, sortBy
    )


@router.get("/{agent_id:int}", response_model=CallingAgentRead)
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    return service.get_agent(db, agent_id)


@router.post("/{agent_id:int}/test-call")
def test_call(agent_id: int, data: TestCallRequest, db: Session = Depends(get_db)):
    return service.test_call(db, agent_id, data)


@router.post("/{agent_id:int}/status")
def update_agent_status(
    agent_id: int, data: AgentStatusUpdate, db: Session = Depends(get_db)
):
    return service.update_agent_status(db, agent_id, data)


@router.post("/{agent_id:int}/publish")
def publish_agent(agent_id: int, db: Session = Depends(get_db)):
    return service.publish_agent(db, agent_id)


@router.delete("/{agent_id:int}/delete")
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    return service.delete_agent(db, agent_id)


@router.get("/lookup")
def get_agent_lookup(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.agent_lookup(db, current_user.organization_id, search)


@router.get("/all-agent-lookup")
def all_agent_lookup(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.all_agent_lookup(db, current_user.organization_id, search)


@router.get("/voices")
def get_voices(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_voices(background_tasks, db, current_user.organization_id)
