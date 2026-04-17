from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.models.message_templates import MessageTemplate
from app.schemas.message_template import TemplateCreate, TemplateUpdate


def create_template(db: Session, organization_id: int, data: TemplateCreate):
    template = MessageTemplate(organization_id=organization_id, **data.dict())
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return {
        "success": True,
        "message": "Template created successfully"
    }


def get_templates(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None
):
    query = db.query(MessageTemplate).filter(
        MessageTemplate.organization_id == organization_id
    )

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                MessageTemplate.name.ilike(search_term),
                MessageTemplate.type.ilike(search_term),
                MessageTemplate.subject.ilike(search_term),
                MessageTemplate.content.ilike(search_term)
            )
        )

    total = query.count()

    templates = (
        query
        .order_by(MessageTemplate.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": templates,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }
    


def get_template(db: Session, template_id: int):
    return db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()


def update_template(db: Session, template_id: int, data: TemplateUpdate):
    template = get_template(db, template_id)
    if not template:
        return None

    for k, v in data.dict(exclude_unset=True).items():
        setattr(template, k, v)

    db.commit()
    db.refresh(template)
    return {
        "success": True,
        "message": "Template updated successfully"
    }


def delete_template(db: Session, template_id: int):
    template = get_template(db, template_id)
    if not template:
        return None

    db.delete(template)
    db.commit()
    return True



def get_template_lookup(
    db: Session, 
    organization_id: int,
    type: Optional[str] = None):

    query = db.query(MessageTemplate).filter(
        MessageTemplate.organization_id == organization_id
    )

    if type:
        query = query.filter(
            MessageTemplate.type == type
        )

    templates = query.order_by(MessageTemplate.name.asc()).all()

    return [
        {
            "id": t.id,
            "name": t.name,
            "type": t.type
        }
        for t in templates
    ]
   