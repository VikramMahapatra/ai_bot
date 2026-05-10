from operator import or_

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    BackgroundTasks,
    Form,
)
from sqlalchemy.orm import Session
from typing import List, Dict
from pydantic import BaseModel
from app.database import get_db, SessionLocal
from app.auth import require_admin
from app.config import settings
from app.models import User, KnowledgeSource, SourceType
from app.schemas import (
    KnowledgeSourceResponse,
    WebCrawlRequest,
    WebCrawlPreviewRequest,
    WebCrawlPreviewResponse,
    DocumentUploadResponse,
    WebCrawlResponse,
)
from app.services import (
    ingest_web_content,
    ingest_document,
    ingest_text_content,
    delete_knowledge_source,
    discover_web_links,
)
from app.services.limits_service import (
    get_effective_limits,
    increment_usage,
)
from app.services.rag import chroma_client
import logging
import uuid
import threading
import time
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/knowledge", tags=["knowledge"])

_CRAWL_JOB_TTL_SECONDS = 6 * 60 * 60
_crawl_jobs_lock = threading.Lock()
_crawl_jobs: Dict[str, Dict[str, object]] = {}


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _cleanup_crawl_jobs(now_ts: float = None) -> None:
    now_ts = now_ts or time.time()
    expired_ids = []
    for job_id, job in _crawl_jobs.items():
        status = job.get("status")
        updated_at_ts = float(job.get("updated_at_ts", 0.0))
        if (
            status in {"completed", "failed"}
            and updated_at_ts
            and (now_ts - updated_at_ts) > _CRAWL_JOB_TTL_SECONDS
        ):
            expired_ids.append(job_id)
    for job_id in expired_ids:
        _crawl_jobs.pop(job_id, None)


def _update_crawl_job(job_id: str, **fields) -> None:
    now_ts = time.time()
    with _crawl_jobs_lock:
        _cleanup_crawl_jobs(now_ts)
        job = _crawl_jobs.get(job_id)
        if not job:
            return
        job.update(fields)
        job["updated_at"] = _utc_now_iso()
        job["updated_at_ts"] = now_ts


def _get_crawl_job(job_id: str) -> Dict[str, object]:
    now_ts = time.time()
    with _crawl_jobs_lock:
        _cleanup_crawl_jobs(now_ts)
        job = _crawl_jobs.get(job_id)
        return dict(job) if job else {}


def _get_latest_active_crawl_job(
    organization_id: int, widget_id: str
) -> Dict[str, object]:
    now_ts = time.time()
    with _crawl_jobs_lock:
        _cleanup_crawl_jobs(now_ts)
        candidates = [
            dict(job)
            for job in _crawl_jobs.values()
            if job.get("organization_id") == organization_id
            and job.get("widget_id") == widget_id
            and job.get("status") in {"queued", "running"}
        ]

    if not candidates:
        return {}

    candidates.sort(
        key=lambda item: float(item.get("updated_at_ts") or 0.0), reverse=True
    )
    return candidates[0]


def _job_public_payload(job: Dict[str, object]) -> Dict[str, object]:
    if not job:
        return {}
    return {
        "job_id": job.get("job_id"),
        "status": job.get("status"),
        "stage": job.get("stage"),
        "progress": job.get("progress", 0),
        "message": job.get("message"),
        "error": job.get("error"),
        "url": job.get("url"),
        "widget_id": job.get("widget_id"),
        "pages_total": job.get("pages_total", 0),
        "pages_completed": job.get("pages_completed", 0),
        "pages_crawled": job.get("pages_crawled", 0),
        "pages_scanned": job.get("pages_scanned", 0),
        "chunks_embedded": job.get("chunks_embedded", 0),
        "unchanged": bool(job.get("unchanged", False)),
        "source": job.get("source"),
        "created_at": job.get("created_at"),
        "started_at": job.get("started_at"),
        "updated_at": job.get("updated_at"),
        "finished_at": job.get("finished_at"),
    }


def _validate_crawl_limits(
    request: WebCrawlRequest, current_user: User, db: Session
) -> None:
    limits = get_effective_limits(db, current_user.organization_id)
    if not limits.get("subscription_active"):
        raise HTTPException(status_code=403, detail="Subscription inactive or expired")


def _run_crawl_job(
    job_id: str, request_payload: Dict[str, object], user_id: int, organization_id: int
) -> None:
    db = SessionLocal()
    try:
        _update_crawl_job(
            job_id,
            status="running",
            stage="starting",
            progress=5,
            started_at=_utc_now_iso(),
            message="Starting crawl and embedding",
        )

        def _progress(payload: Dict[str, object]) -> None:
            _update_crawl_job(
                job_id,
                status="running",
                stage=payload.get("stage", "running"),
                progress=int(payload.get("progress", 5)),
                message=payload.get("message", "Processing"),
                pages_total=int(payload.get("pages_total", 0)),
                pages_completed=int(payload.get("pages_completed", 0)),
                pages_crawled=int(payload.get("pages_crawled", 0)),
                pages_scanned=int(payload.get("pages_scanned", 0)),
                chunks_embedded=int(payload.get("chunks_embedded", 0)),
            )

        source, pages_crawled, pages_scanned = ingest_web_content(
            request_payload["url"],
            int(request_payload.get("max_pages", 10)),
            int(request_payload.get("max_depth", 3)),
            user_id,
            request_payload["widget_id"],
            db,
            selected_urls=request_payload.get("selected_urls"),
            progress_callback=_progress,
        )

        increment_usage(db, organization_id, crawl_pages_count=pages_crawled)
        unchanged = pages_crawled == 0
        message = (
            "No changes detected. Page already embedded."
            if unchanged
            else f"Crawled {pages_crawled} updated pages."
        )

        _update_crawl_job(
            job_id,
            status="completed",
            stage="completed",
            progress=100,
            message=message,
            pages_crawled=pages_crawled,
            pages_scanned=pages_scanned,
            unchanged=unchanged,
            source={
                "id": source.id,
                "name": source.name,
                "source_type": source.source_type.value,
                "status": source.status,
                "widget_id": source.widget_id,
            },
            finished_at=_utc_now_iso(),
        )
    except Exception as e:
        db.rollback()
        _update_crawl_job(
            job_id,
            status="failed",
            stage="failed",
            message="Crawl/embedding job failed",
            error=str(e),
            finished_at=_utc_now_iso(),
        )
        logger.error(f"Error in crawl job {job_id}: {str(e)}", exc_info=True)
    finally:
        db.close()


class TextIngestRequest(BaseModel):
    widget_id: str
    title: str
    content: str


@router.post("/crawl/async")
async def start_crawl_website_job(
    request: WebCrawlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Start crawl/embed as a background job and return a job id for polling."""
    try:
        _validate_crawl_limits(request, current_user, db)

        job_id = str(uuid.uuid4())
        created_at = _utc_now_iso()
        with _crawl_jobs_lock:
            _crawl_jobs[job_id] = {
                "job_id": job_id,
                "organization_id": current_user.organization_id,
                "user_id": current_user.id,
                "status": "queued",
                "stage": "queued",
                "progress": 0,
                "message": "Job queued",
                "error": None,
                "url": request.url,
                "widget_id": request.widget_id,
                "pages_total": (
                    len(request.selected_urls or [])
                    if request.selected_urls
                    else request.max_pages
                ),
                "pages_completed": 0,
                "pages_crawled": 0,
                "pages_scanned": 0,
                "chunks_embedded": 0,
                "created_at": created_at,
                "started_at": None,
                "updated_at": created_at,
                "updated_at_ts": time.time(),
                "finished_at": None,
                "source": None,
                "unchanged": False,
            }

        request_payload = request.dict()
        background_tasks.add_task(
            _run_crawl_job,
            job_id,
            request_payload,
            current_user.id,
            current_user.organization_id,
        )

        return _job_public_payload(_get_crawl_job(job_id))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting crawl background job: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/crawl/async/latest")
async def get_latest_active_crawl_website_job(
    widget_id: str, current_user: User = Depends(require_admin)
):
    """Get the latest active (queued/running) crawl/embed job for a widget."""
    widget = (widget_id or "").strip()
    if not widget:
        raise HTTPException(status_code=400, detail="widget_id is required")

    job = _get_latest_active_crawl_job(current_user.organization_id, widget)
    if not job:
        raise HTTPException(status_code=404, detail="No active crawl job found")

    return _job_public_payload(job)


@router.get("/crawl/async/{job_id}")
async def get_crawl_website_job(
    job_id: str, current_user: User = Depends(require_admin)
):
    """Get status and progress of a background crawl/embed job."""
    job = _get_crawl_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Crawl job not found")

    if job.get("organization_id") != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Crawl job not found")

    return _job_public_payload(job)


@router.post("/crawl", response_model=WebCrawlResponse)
async def crawl_website(
    request: WebCrawlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Crawl website and ingest content for the current user"""
    try:
        _validate_crawl_limits(request, current_user, db)

        source, pages_crawled, pages_scanned = ingest_web_content(
            request.url,
            request.max_pages,
            request.max_depth,
            current_user.id,
            request.widget_id,
            db,
            selected_urls=request.selected_urls,
        )

        increment_usage(
            db, current_user.organization_id, crawl_pages_count=pages_crawled
        )
        unchanged = pages_crawled == 0
        message = (
            "No changes detected. Page already embedded."
            if unchanged
            else f"Crawled {pages_crawled} updated pages."
        )
        return WebCrawlResponse(
            source=source,
            pages_crawled=pages_crawled,
            pages_scanned=pages_scanned,
            unchanged=unchanged,
            message=message,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error crawling website: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/crawl/preview", response_model=WebCrawlPreviewResponse)
async def preview_crawl_links(
    request: WebCrawlPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Discover crawlable links before embedding, so user can choose pages."""
    try:
        limits = get_effective_limits(db, current_user.organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(
                status_code=403, detail="Subscription inactive or expired"
            )

        discovered_urls, pages_scanned = discover_web_links(
            request.url,
            request.max_pages,
            request.max_depth,
            organization_id=current_user.organization_id,
        )
        limited_urls = discovered_urls[: max(1, int(request.max_pages))]
        return WebCrawlPreviewResponse(
            discovered_urls=limited_urls,
            pages_scanned=pages_scanned,
            message=(
                f"Discovered {len(discovered_urls)} links; showing first {len(limited_urls)} "
                "based on max pages. Select which pages to embed."
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing crawl links: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    widget_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Upload and ingest document for the current user"""
    try:
        limits = get_effective_limits(db, current_user.organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(
                status_code=403, detail="Subscription inactive or expired"
            )

        # Validate file size before reading
        if file.size and file.size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB. Current file size: {file.size / (1024*1024):.2f}MB",
            )

        # Determine file type
        filename = file.filename.lower()
        if filename.endswith(".pdf"):
            source_type = SourceType.PDF
        elif filename.endswith((".docx", ".doc")):
            source_type = SourceType.DOCX
        elif filename.endswith((".xlsx", ".xls")):
            source_type = SourceType.XLSX
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        # Read file content
        content = await file.read()

        # Double-check file size after reading
        if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB. Current file size: {len(content) / (1024*1024):.2f}MB",
            )

        # Ingest document
        source = ingest_document(
            content, file.filename, source_type, current_user.id, widget_id, db
        )

        # Usage tracking should not fail the upload response if a transient DB
        # connection drop happens after ingestion already succeeded.
        try:
            increment_usage(db, current_user.organization_id, documents_count=1)
        except Exception as usage_err:
            db.rollback()
            logger.warning(
                "Upload succeeded but usage increment failed for org %s: %s",
                current_user.organization_id,
                str(usage_err),
            )

        return DocumentUploadResponse(
            id=source.id,
            name=source.name,
            source_type=source.source_type.value,
            status=source.status,
            widget_id=source.widget_id or widget_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest-text", response_model=DocumentUploadResponse)
async def ingest_text(
    request: TextIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Ingest raw text content (used for knowledge gap suggestions)."""
    try:
        limits = get_effective_limits(db, current_user.organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(
                status_code=403, detail="Subscription inactive or expired"
            )

        source = ingest_text_content(
            request.content, request.title, current_user.id, request.widget_id, db
        )
        increment_usage(db, current_user.organization_id, documents_count=1)

        return DocumentUploadResponse(
            id=source.id,
            name=source.name,
            source_type=source.source_type.value,
            status=source.status,
            widget_id=source.widget_id or request.widget_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ingesting text content: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources")  # , response_model=List[KnowledgeSourceResponse])
async def list_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    widget_id: str = None,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
):
    """List all knowledge sources for the current organization"""
    query = (
        db.query(KnowledgeSource)
        .join(User, KnowledgeSource.user_id == User.id)
        .filter(User.organization_id == current_user.organization_id)
    )
    if widget_id:
        query = query.filter(KnowledgeSource.widget_id == widget_id)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                KnowledgeSource.name.ilike(search_term),
            )
        )

    total = query.count()

    sources = query.order_by(KnowledgeSource.id.desc()).offset(skip).limit(limit).all()
    return {
        "items": sources,
        "pagination": {"total": total, "skip": skip, "limit": limit},
    }


@router.delete("/sources/{source_id}")
async def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete knowledge source"""
    try:
        # Verify the source belongs to the current user
        source = (
            db.query(KnowledgeSource)
            .join(User, KnowledgeSource.user_id == User.id)
            .filter(
                KnowledgeSource.id == source_id,
                User.organization_id == current_user.organization_id,
            )
            .first()
        )

        if not source:
            raise HTTPException(
                status_code=404, detail="Knowledge source not found or unauthorized"
            )

        delete_knowledge_source(source_id, db)
        return {"message": "Knowledge source deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting source: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vectorized-data")
async def get_vectorized_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    widget_id: str = None,
    include_documents: bool = False,
    limit: int = 200,
) -> Dict:
    """Get vectorized data (embeddings metadata) for the current organization"""
    try:
        if not widget_id:
            raise HTTPException(status_code=400, detail="widget_id is required")

        limit = max(1, min(limit, 1000))

        logger.info(
            f"Fetching vectorized data for org {current_user.organization_id}, widget {widget_id}"
        )

        # Get all vectorized documents for this user from ChromaDB
        try:
            results = chroma_client.get_documents(
                organization_id=current_user.organization_id,
                widget_id=widget_id,
                include_documents=include_documents,
                limit=None if not include_documents else limit,
            )
        except Exception as chroma_error:
            logger.error(f"ChromaDB query error: {str(chroma_error)}", exc_info=True)
            # Return empty results instead of failing
            results = {"ids": [], "metadatas": [], "documents": []}

        ids = results.get("ids", []) if results else []
        metadatas = results.get("metadatas", []) if results else []

        source_summary_map: Dict[str, Dict] = {}
        for i, _doc_id in enumerate(ids):
            metadata = metadatas[i] if metadatas and i < len(metadatas) else {}
            source_id = str(metadata.get("source_id") or "unknown")
            entry = source_summary_map.get(source_id)
            if not entry:
                entry = {
                    "source_id": source_id,
                    "source_type": metadata.get("source_type") or "UNKNOWN",
                    "name": metadata.get("filename")
                    or metadata.get("title")
                    or metadata.get("url")
                    or "Unknown",
                    "url": metadata.get("url"),
                    "chunks": 0,
                }
                source_summary_map[source_id] = entry
            entry["chunks"] += 1

        source_summary = sorted(
            source_summary_map.values(), key=lambda item: item["chunks"], reverse=True
        )

        # Optional detailed row payload (disabled by default).
        documents_info = []
        if include_documents and ids:
            documents = results.get("documents", []) if results else []
            for i, doc_id in enumerate(ids):
                try:
                    metadata = metadatas[i] if metadatas and i < len(metadatas) else {}
                    preview = ""
                    if documents and i < len(documents):
                        doc_content = documents[i]
                        preview = (
                            doc_content[:200] + "..."
                            if len(doc_content) > 200
                            else doc_content
                        )

                    documents_info.append(
                        {
                            "id": doc_id,
                            "source_id": metadata.get("source_id"),
                            "source_type": metadata.get("source_type"),
                            "filename": metadata.get("filename"),
                            "url": metadata.get("url"),
                            "title": metadata.get("title"),
                            "chunk_index": metadata.get("chunk_index"),
                            "created_at": metadata.get("created_at"),
                            "preview": preview,
                        }
                    )
                except Exception as item_error:
                    logger.error(f"Error processing document {i}: {str(item_error)}")
                    continue

        return {
            "organization_id": current_user.organization_id,
            "user_id": current_user.id,
            "widget_id": widget_id,
            "total_chunks": len(ids),
            "total_sources": len(source_summary),
            "include_documents": include_documents,
            "source_summary": source_summary,
            "documents": documents_info,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting vectorized data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
