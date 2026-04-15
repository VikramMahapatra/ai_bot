from sqlalchemy.orm import Session
from app.models.message_templates import MessageTemplate
from app.schemas.message_template import TemplateCreate, TemplateUpdate


def create_template(db: Session, data: TemplateCreate):
    template = MessageTemplate(**data.dict())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def get_templates(db: Session):
    return db.query(MessageTemplate).all()


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
    return template


def delete_template(db: Session, template_id: int):
    template = get_template(db, template_id)
    if not template:
        return None

    db.delete(template)
    db.commit()
    return True