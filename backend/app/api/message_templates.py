from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

from app.schemas.message_template import TemplateCreate, TemplateUpdate
from app.services import message_template_service

router = APIRouter(prefix="/api/templates", tags=["Templates"])


@router.post("/")
def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    return message_template_service.create_template(db, data)


@router.get("/")
def list_templates(db: Session = Depends(get_db)):
    return message_template_service.get_templates(db)


@router.get("/{template_id}")
def get_template(template_id: int, db: Session = Depends(get_db)):
    return message_template_service.get_template(db, template_id)


@router.put("/{template_id}")
def update_template(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db)):
    return message_template_service.update_template(db, template_id, data)


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    return message_template_service.delete_template(db, template_id)