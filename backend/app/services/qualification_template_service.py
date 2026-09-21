from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.qualification_templates import (
    DisqualificationCriterion,
    LeadTemperatureRule,
    QualificationAttribute,
    QualificationCriterion,
    QualificationPositiveSignal,
    QualificationTemplate,
    QualificationTemplateStatus,
)
from app.schemas.qualification_template import QualificationTemplatePayload


DETAIL_OPTIONS = (
    selectinload(QualificationTemplate.criteria),
    selectinload(QualificationTemplate.attributes),
    selectinload(QualificationTemplate.positive_signals),
    selectinload(QualificationTemplate.disqualification_criteria),
    selectinload(QualificationTemplate.lead_temperatures),
)


def list_templates(
    db: Session,
    organization_id: int,
    search: str | None,
    template_status: str | None,
    skip: int,
    limit: int,
):
    query = db.query(QualificationTemplate).filter(
        QualificationTemplate.organization_id == organization_id
    )
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                QualificationTemplate.name.ilike(term),
                QualificationTemplate.description.ilike(term),
                QualificationTemplate.objective.ilike(term),
            )
        )
    if template_status:
        query = query.filter(
            QualificationTemplate.status == QualificationTemplateStatus(template_status)
        )

    total = query.count()
    items = (
        query.order_by(QualificationTemplate.updated_at.desc().nullslast(), QualificationTemplate.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total, "skip": skip, "limit": limit}


def get_template(db: Session, organization_id: int, template_id: int):
    template = (
        db.query(QualificationTemplate)
        .options(*DETAIL_OPTIONS)
        .filter(
            QualificationTemplate.id == template_id,
            QualificationTemplate.organization_id == organization_id,
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Qualification template not found")
    return template


def _replace_sections(template: QualificationTemplate, payload: QualificationTemplatePayload) -> None:
    template.criteria = [
        QualificationCriterion(sort_order=index, **item.model_dump())
        for index, item in enumerate(payload.criteria)
    ]
    template.attributes = [
        QualificationAttribute(sort_order=index, **item.model_dump())
        for index, item in enumerate(payload.attributes)
    ]
    template.positive_signals = [
        QualificationPositiveSignal(sort_order=index, **item.model_dump())
        for index, item in enumerate(payload.positive_signals)
    ]
    template.disqualification_criteria = [
        DisqualificationCriterion(sort_order=index, **item.model_dump())
        for index, item in enumerate(payload.disqualification_criteria)
    ]
    template.lead_temperatures = [
        LeadTemperatureRule(sort_order=index, **item.model_dump())
        for index, item in enumerate(payload.lead_temperatures)
    ]


def _commit(db: Session, duplicate_message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=duplicate_message) from exc


def create_template(db: Session, organization_id: int, payload: QualificationTemplatePayload):
    template = QualificationTemplate(
        organization_id=organization_id,
        name=payload.name,
        description=payload.description,
        objective=payload.objective,
        qualification_mode=payload.qualification_mode,
        temperature_mode=payload.temperature_mode,
        status=QualificationTemplateStatus(payload.status.value),
    )
    _replace_sections(template, payload)
    db.add(template)
    _commit(db, "A qualification template with this name already exists")
    db.refresh(template)
    return get_template(db, organization_id, template.id)


def update_template(
    db: Session,
    organization_id: int,
    template_id: int,
    payload: QualificationTemplatePayload,
):
    template = get_template(db, organization_id, template_id)
    template.name = payload.name
    template.description = payload.description
    template.objective = payload.objective
    template.qualification_mode = payload.qualification_mode
    template.temperature_mode = payload.temperature_mode
    template.status = QualificationTemplateStatus(payload.status.value)
    template.criteria.clear()
    template.attributes.clear()
    template.positive_signals.clear()
    template.disqualification_criteria.clear()
    template.lead_temperatures.clear()
    db.flush()
    _replace_sections(template, payload)
    _commit(db, "A qualification template with this name already exists")
    db.expire_all()
    return get_template(db, organization_id, template_id)


def update_status(db: Session, organization_id: int, template_id: int, template_status: str):
    template = get_template(db, organization_id, template_id)
    template.status = QualificationTemplateStatus(template_status)
    db.commit()
    db.refresh(template)
    return template


def delete_template(db: Session, organization_id: int, template_id: int) -> None:
    template = get_template(db, organization_id, template_id)
    db.delete(template)
    db.commit()