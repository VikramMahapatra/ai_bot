from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.qualification_template import (
    QualificationStatusUpdate,
    QualificationTemplateListParams,
    QualificationTemplateListResponse,
    QualificationTemplatePayload,
    QualificationTemplateResponse,
    QualificationTemplateSummary,
)
from app.services import qualification_template_service


router = APIRouter(prefix="/api/qualification-templates", tags=["Qualification Templates"])


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


@router.post("", response_model=QualificationTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_qualification_template(
    payload: QualificationTemplatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return qualification_template_service.create_template(db, current_user.organization_id, payload)


@router.get("/{template_id}", response_model=QualificationTemplateResponse)
def get_qualification_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return qualification_template_service.get_template(db, current_user.organization_id, template_id)


@router.put("/{template_id}", response_model=QualificationTemplateResponse)
def update_qualification_template(
    template_id: int,
    payload: QualificationTemplatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return qualification_template_service.update_template(
        db, current_user.organization_id, template_id, payload
    )


@router.patch("/{template_id}/status", response_model=QualificationTemplateSummary)
def update_qualification_template_status(
    template_id: int,
    payload: QualificationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return qualification_template_service.update_status(
        db, current_user.organization_id, template_id, payload.status.value
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_qualification_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    qualification_template_service.delete_template(db, current_user.organization_id, template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)