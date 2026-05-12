from typing import Optional

from fastapi import APIRouter, Depends
from regex import search
from sqlalchemy.orm import Session
from app.database import get_db

from app.schemas.message_template import (
    StatusUpdateRequest,
    TemplateCreate,
    TemplateRequest,
    TemplateUpdate,
)
from app.services import message_template_service
from app.auth import get_current_user
from app.models.user import User
from app.models.message_templates import MessageTemplate

router = APIRouter(
    prefix="/api/templates",
    tags=["Templates"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/sync-whatsapp")
def create_template(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return message_template_service.sync_whatsapp_templates(
        db, current_user.organization_id
    )


@router.post("/create")
def create_template(
    data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return message_template_service.create_template(
        db, current_user.organization_id, data
    )


@router.get("/all")
def list_templates(
    params: TemplateRequest = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return message_template_service.get_templates(
        db,
        current_user.organization_id,
        skip=params.skip,
        limit=params.limit,
        search=params.search,
        template_type=params.type,
    )


@router.get("/{template_id:int}")
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return message_template_service.get_template(db, template_id)


@router.put("/update/{template_id}")
def update_template(
    template_id: int,
    data: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return message_template_service.update_template(db, template_id, data)


@router.patch("/{template_id:int}/status")
def update_status(
    template_id: int,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return message_template_service.update_template_status(
        db, template_id, payload.status
    )


@router.delete("/delete/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return message_template_service.delete_template(db, template_id)


@router.get("/lookup")
def get_template_lookup(
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return message_template_service.get_template_lookup(
        db, current_user.organization_id, type
    )


@router.get("/whatsapp/utility-templates")
def get_utility_whatsapp_templates(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    query = db.query(MessageTemplate).filter(
        MessageTemplate.organization_id == current_user.organization_id,
        MessageTemplate.type == "whatsapp",
        MessageTemplate.meta_status == "APPROVED",
        MessageTemplate.is_latest == True,
        MessageTemplate.is_archived == False,
        MessageTemplate.status == "Active",
    )

    if category:
        query = query.filter(MessageTemplate.category == category)

    templates = query.order_by(MessageTemplate.created_at.desc()).all()

    return [
        {
            "id": t.id,
            "name": t.name,
            "content": t.content,
            "category": t.category,
            "language": t.language,
            "meta_template_id": t.meta_template_id,
            "whatsapp_template_name": t.whatsapp_template_name,
            "variable_mappings": t.variable_mappings,
        }
        for t in templates
    ]
