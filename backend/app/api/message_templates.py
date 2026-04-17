from typing import Optional

from fastapi import APIRouter, Depends
from regex import search
from sqlalchemy.orm import Session
from app.database import get_db

from app.schemas.message_template import TemplateCreate, TemplateRequest, TemplateUpdate
from app.services import message_template_service
from app.auth import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/api/templates", 
    tags=["Templates"],
    dependencies=[Depends(get_current_user)]
    )


@router.post("/create")
def create_template(data: TemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return message_template_service.create_template(db, current_user.organization_id, data)


@router.get("/all")
def list_templates(params: TemplateRequest = Depends(), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return message_template_service.get_templates(db, current_user.organization_id, skip=params.skip, limit=params.limit, search=params.search)


@router.get("/{template_id:int}")
def get_template(template_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return message_template_service.get_template(db, template_id)


@router.put("/update/{template_id}")
def update_template(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return message_template_service.update_template(db, template_id, data)


@router.delete("/delete/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return message_template_service.delete_template(db, template_id)


@router.get("/lookup")
def get_template_lookup(
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return message_template_service.get_template_lookup(db, current_user.organization_id, type)