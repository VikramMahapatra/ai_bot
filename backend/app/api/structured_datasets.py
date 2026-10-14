"""Admin-only agent-scoped structured dataset endpoints."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session
from app.auth import require_admin
from app.database import get_db
from app.config import settings
from app.models import User
from app.schemas.structured_dataset import (DatasetCreate, DatasetPatch, VersionCreate, QueryPlan,
                                           MAX_ROWS, MAX_COLUMNS, MAX_FILE_BYTES)
from app.services import structured_dataset_service as service
from app.services.structured_dataset_import_service import inspect_file

class BoundedDatasetRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def bounded(request: Request):
            # Bound JSON bytes before FastAPI decodes/validates the body, including
            # chunked requests. Multipart parsing/spooling needs deployment limits.
            media = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            if request.method in {"POST", "PATCH"} and (not media or media == "application/json" or media.endswith("+json")):
                body = bytearray()
                async for chunk in request.stream():
                    if len(body) + len(chunk) > MAX_FILE_BYTES:
                        raise HTTPException(413, "Request payload exceeds 5 MB")
                    body.extend(chunk)
                request._body = bytes(body)
            return await handler(request)

        return bounded


router = APIRouter(prefix="/api/admin/knowledge/datasets", tags=["structured-datasets"], route_class=BoundedDatasetRoute)


@router.get("/capabilities")
def capabilities(widget_id: str | None = Query(None, min_length=1, max_length=200), db: Session = Depends(get_db), user: User = Depends(require_admin)):
    enabled = service.is_structured_enabled(user.organization_id)
    # No dataset-table query on disabled routes, including capabilities.
    if widget_id is not None:
        service.require_widget(db, user.organization_id, widget_id)
    return dict(enabled=enabled, chat_enabled=False,
                supported_formats=["xlsx", "csv"], max_rows=MAX_ROWS, max_columns=MAX_COLUMNS)


@router.post("/inspect")
async def inspect(widget_id: str = Form(..., min_length=1, max_length=200), header_row: int = Form(1, ge=1, le=100),
                  file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(require_admin),
                  sheet_name: str | None = Form(None, min_length=1, max_length=200),
                  discovery_only: bool = Form(False)):
    try:
        service.require_enabled(user.organization_id)
        service.require_widget(db, user.organization_id, widget_id)
        content = await file.read(MAX_FILE_BYTES + 1)
        return inspect_file(content, file.filename or "", header_row, sheet_name, discovery_only)
    finally:
        await file.close()


@router.get("/")
def list_datasets(widget_id: str = Query(..., min_length=1, max_length=200), db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if not service.is_structured_enabled(user.organization_id):
        return {"items": []}
    service.require_widget(db, user.organization_id, widget_id)
    items = db.query(service.Dataset).filter(service.Dataset.organization_id == user.organization_id,
        service.Dataset.widget_id == widget_id, service.Dataset.is_deleted.is_(False)).order_by(service.Dataset.id).limit(service.MAX_TENANT_DATASETS).all()
    return {"items": [service.serialize_dataset(db, d, detail=False) for d in items]}


@router.post("/", status_code=201)
def create(payload: DatasetCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        dataset, draft = service.create_dataset(db, user.organization_id, payload)
        result = service.serialize_dataset(db, dataset, draft=draft)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.get("/{dataset_id}")
def detail(dataset_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return service.serialize_dataset(db, service.get_dataset(db, user.organization_id, dataset_id))


@router.get("/{dataset_id}/rows")
def rows(dataset_id: int, skip: int = Query(0, ge=0, le=MAX_ROWS), limit: int = Query(20, ge=1, le=MAX_ROWS),
         db: Session = Depends(get_db), user: User = Depends(require_admin)):
    dataset = service.get_dataset(db, user.organization_id, dataset_id)
    if dataset.active_version_id is None:
        return {"items": [], "total": 0}
    version = service.get_version(db, dataset, dataset.active_version_id)
    records = service.rows_query(db, version).offset(skip).limit(limit).all()
    return {"items": [dict(row_number=r.row_number, values=r.values) for r in records], "total": version.row_count}


@router.post("/{dataset_id}/versions", status_code=201)
def create_version(dataset_id: int, payload: VersionCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        service.lock_tenant(db, user.organization_id)
        dataset = service.get_dataset(db, user.organization_id, dataset_id, lock=True)
        draft = service.add_version(db, dataset, payload)
        result = service.serialize_dataset(db, dataset, draft=draft)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.post("/{dataset_id}/versions/{version_id}/validate")
def validate(dataset_id: int, version_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    dataset = service.get_dataset(db, user.organization_id, dataset_id)
    # Validation is read-only, including for historical published versions.
    return service.validate_version(db, service.get_version(db, dataset, version_id))


@router.post("/{dataset_id}/versions/{version_id}/publish")
def publish(dataset_id: int, version_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        dataset = service.publish_version(db, user.organization_id, dataset_id, version_id)
        result = service.serialize_dataset(db, dataset)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.patch("/{dataset_id}")
def patch(dataset_id: int, payload: DatasetPatch, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        service.lock_tenant(db, user.organization_id)
        dataset = service.get_dataset(db, user.organization_id, dataset_id, lock=True)
        values = payload.model_dump(exclude_unset=True)
        if any(v is None for v in values.values()):
            raise HTTPException(422, "Explicit null metadata/status is unsupported")
        if payload.status == "active":
            if dataset.active_version_id is None or service.get_version(db, dataset, dataset.active_version_id).status != "published":
                raise HTTPException(409, "Activation requires a published version")
        for key, value in values.items():
            setattr(dataset, key, value)
        db.flush()
        # The frontend replaces selected detail with this response; retain its
        # versions/rows so activation or renaming does not clear the editor.
        result = service.serialize_dataset(db, dataset)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.delete("/{dataset_id}")
def delete(dataset_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        service.lock_tenant(db, user.organization_id)
        dataset = service.get_dataset(db, user.organization_id, dataset_id, lock=True)
        dataset.is_deleted = True
        dataset.status = "inactive"
        db.commit()
        return {"deleted": True}
    except Exception:
        db.rollback()
        raise


@router.post("/{dataset_id}/test-query")
def test_query(dataset_id: int, payload: QueryPlan, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if payload.dataset_id != dataset_id:
        raise HTTPException(422, "dataset_id must match route")
    dataset = service.get_dataset(db, user.organization_id, dataset_id)
    return service.execute_query(db, user.organization_id, dataset.widget_id, payload.model_dump())