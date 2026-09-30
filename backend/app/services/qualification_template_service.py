from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from datetime import datetime, timezone
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
from app.models.qualification_engine_integrations import QualificationEngineIntegration
from app.services.qualification_engine_service import QualificationEngineService
from app.models.call_campaigns import CallCampaign
from app.models.calling_agents import CallingAgent
from app.models.widget_config import WidgetConfig

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
        query.order_by(
            QualificationTemplate.updated_at.desc().nullslast(),
            QualificationTemplate.created_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total, "skip": skip, "limit": limit}


def template_lookup(db: Session, organization_id: int):
    query = db.query(QualificationTemplate).filter(
        QualificationTemplate.organization_id == organization_id,
        QualificationTemplate.sync_status == "synced",
        QualificationTemplate.status == QualificationTemplateStatus.active,
    )

    items = query.order_by(
        QualificationTemplate.updated_at.desc().nullslast(),
        QualificationTemplate.created_at.desc(),
    ).all()
    return items


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Qualification template not found",
        )
    return template


def _replace_sections(
    template: QualificationTemplate, payload: QualificationTemplatePayload
) -> None:
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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=duplicate_message
        ) from exc


async def create_template(
    db: Session,
    organization_id: int,
    payload: QualificationTemplatePayload,
):
    template = QualificationTemplate(
        organization_id=organization_id,
        name=payload.name,
        description=payload.description,
        objective=payload.objective,
        qualification_mode=payload.qualification_mode,
        temperature_mode=payload.temperature_mode,
        status=QualificationTemplateStatus(payload.status.value),
        sync_status="pending",
    )

    _replace_sections(template, payload)

    db.add(template)

    _commit(
        db,
        "A qualification template with this name already exists",
    )

    db.refresh(template)

    return get_template(
        db,
        organization_id,
        template.id,
    )


async def update_template(
    db: Session,
    organization_id: int,
    template_id: int,
    payload: QualificationTemplatePayload,
):
    template = get_template(
        db,
        organization_id,
        template_id,
    )

    # ---------------------------------------------------------
    # 1. Update local template
    # ---------------------------------------------------------

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

    # Template has changed locally, so previous sync is no longer current.
    template.sync_status = "pending"
    template.sync_error = None

    # Save local changes first
    _commit(
        db,
        "A qualification template with this name already exists",
    )

    db.refresh(template)

    return get_template(
        db,
        organization_id,
        template_id,
    )


def update_status(
    db: Session, organization_id: int, template_id: int, template_status: str
):
    template = get_template(db, organization_id, template_id)

    # ---------------------------------------------------------
    # Check whether template is being used anywhere
    # ---------------------------------------------------------
    if (
        QualificationTemplateStatus(template_status)
        == QualificationTemplateStatus.inactive
    ):
        calling_agent = (
            db.query(CallingAgent)
            .filter(
                CallingAgent.organization_id == organization_id,
                CallingAgent.qualification_template_id == template_id,
            )
            .first()
        )

        if calling_agent:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Qualification template '{template.name}' is attached "
                    f"to calling agent '{calling_agent.name}'. "
                    "Detach it from the calling agent before deactivating the template."
                ),
            )

        call_campaign = (
            db.query(CallCampaign)
            .filter(
                CallCampaign.organization_id == organization_id,
                CallCampaign.qualification_template_id == template_id,
            )
            .first()
        )

        if call_campaign:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Qualification template '{template.name}' is attached "
                    f"to call campaign '{call_campaign.name}'. "
                    "Detach it from the campaign before deactivating the template."
                ),
            )

        widget = (
            db.query(WidgetConfig)
            .filter(
                WidgetConfig.organization_id == organization_id,
                WidgetConfig.qualification_template_id == template_id,
            )
            .first()
        )

        if widget:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Qualification template '{template.name}' is attached "
                    "to a widget. Detach it from the widget before deactivating "
                    "the template."
                ),
            )

    template.status = QualificationTemplateStatus(template_status)
    db.commit()
    db.refresh(template)
    return template


async def delete_template(
    db: Session,
    organization_id: int,
    template_id: int,
) -> None:

    template = get_template(
        db,
        organization_id,
        template_id,
    )

    # ---------------------------------------------------------
    # Check whether template is being used anywhere
    # ---------------------------------------------------------

    calling_agent = (
        db.query(CallingAgent)
        .filter(
            CallingAgent.organization_id == organization_id,
            CallingAgent.qualification_template_id == template_id,
        )
        .first()
    )

    if calling_agent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Qualification template '{template.name}' is attached "
                f"to calling agent '{calling_agent.name}'. "
                "Detach it from the calling agent before deleting the template."
            ),
        )

    call_campaign = (
        db.query(CallCampaign)
        .filter(
            CallCampaign.organization_id == organization_id,
            CallCampaign.qualification_template_id == template_id,
        )
        .first()
    )

    if call_campaign:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Qualification template '{template.name}' is attached "
                f"to call campaign '{call_campaign.name}'. "
                "Detach it from the campaign before deleting the template."
            ),
        )

    widget = (
        db.query(WidgetConfig)
        .filter(
            WidgetConfig.organization_id == organization_id,
            WidgetConfig.qualification_template_id == template_id,
        )
        .first()
    )

    if widget:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Qualification template '{template.name}' is attached "
                "to a widget. Detach it from the widget before deleting "
                "the template."
            ),
        )

    # ---------------------------------------------------------
    # Delete from Qualification Engine
    # ---------------------------------------------------------

    engine_service = QualificationEngineService()

    if template.engine_template_id:
        api_key = engine_service.get_api_key(
            db,
            organization_id,
        )

        await engine_service.delete_template(
            api_key=api_key,
            engine_template_id=str(template.engine_template_id),
        )

    # ---------------------------------------------------------
    # Delete local template
    # ---------------------------------------------------------

    db.delete(template)
    db.commit()


async def sync_template(
    db: Session,
    organization_id: int,
    template_id: int,
):
    template = get_template(
        db,
        organization_id,
        template_id,
    )

    integration = (
        db.query(QualificationEngineIntegration)
        .filter(
            QualificationEngineIntegration.organization_id == organization_id,
            QualificationEngineIntegration.enabled.is_(True),
        )
        .first()
    )

    if not integration:
        raise RuntimeError("Qualification Engine is not connected")

    try:
        engine_service = QualificationEngineService()

        if template.engine_template_id:
            # Existing Engine template:
            # create a new Engine version.
            engine_template = await engine_service.update_template(
                db=db,
                organization_id=organization_id,
                template=template,
            )

            new_version = template.version + 1

        else:
            # First sync.
            engine_template = await engine_service.create_template(
                db=db,
                organization_id=organization_id,
                template=template,
            )

            new_version = template.version

        engine_template_id = engine_template.get("id") or engine_template.get(
            "template_id"
        )

        if not engine_template_id:
            raise RuntimeError("Qualification Engine did not return a template ID")

        # Update local template only after Engine creation succeeds.
        template.engine_template_id = str(engine_template_id)
        template.version = new_version
        template.sync_status = "synced"
        template.sync_error = None
        template.last_synced_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(template)

        return {
            "status": "synced",
            "message": "Qualification template synced successfully.",
            "template_id": template.id,
            "engine_template_id": template.engine_template_id,
            "version": template.version,
            "sync_status": template.sync_status,
            "last_synced_at": template.last_synced_at,
        }

    except Exception as exc:
        db.rollback()

        # Re-fetch because rollback expires/reverts SQLAlchemy state.
        template = get_template(
            db,
            organization_id,
            template_id,
        )

        template.sync_status = "failed"
        template.sync_error = str(exc)

        db.commit()
        db.refresh(template)

        raise RuntimeError(f"Failed to sync qualification template: {exc}")
