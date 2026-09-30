from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.qualification_template import (
    QualificationStatusUpdate,
    QualificationTemplateListParams,
    QualificationTemplateListResponse,
    QualificationTemplateLookup,
    QualificationTemplatePayload,
    QualificationTemplateResponse,
    QualificationTemplateSummary,
)
from app.services import qualification_template_service

router = APIRouter(
    prefix="/api/qualification-templates", tags=["Qualification Templates"]
)


@router.get("/lookup", response_model=List[QualificationTemplateLookup])
def list_qualification_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return qualification_template_service.template_lookup(
        db, current_user.organization_id
    )


@router.get("/{template_id:int}", response_model=QualificationTemplateResponse)
def get_qualification_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return qualification_template_service.get_template(
        db, current_user.organization_id, template_id
    )


@router.put("/{template_id}", response_model=QualificationTemplateResponse)
async def update_qualification_template(
    template_id: int,
    payload: QualificationTemplatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return await qualification_template_service.update_template(
        db, current_user.organization_id, template_id, payload
    )


@router.patch("/{template_id:int}/status", response_model=QualificationTemplateSummary)
async def update_qualification_template_status(
    template_id: int,
    payload: QualificationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return qualification_template_service.update_status(
        db, current_user.organization_id, template_id, payload.status.value
    )


@router.delete("/{template_id:int}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_qualification_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    await qualification_template_service.delete_template(
        db, current_user.organization_id, template_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{template_id:int}/sync")
async def sync_qualification_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    organization_id = current_user.organization_id

    try:
        return await qualification_template_service.sync_template(
            db=db,
            organization_id=organization_id,
            template_id=template_id,
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.get("", response_model=QualificationTemplateListResponse)
def list_qualification_templates(
    params: QualificationTemplateListParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return qualification_template_service.list_templates(
        db,
        current_user.organization_id,
        params.search,
        params.status.value if params.status else None,
        params.skip,
        params.limit,
    )


@router.post(
    "",
    response_model=QualificationTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_qualification_template(
    payload: QualificationTemplatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return await qualification_template_service.create_template(
        db, current_user.organization_id, payload
    )
