from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import require_admin
from app.models import User, KnowledgeSource, SourceType
from app.schemas import (
    KnowledgeSourceResponse,
    WebCrawlRequest,
    DocumentUploadResponse
)
from app.services import ingest_web_content, ingest_document, delete_knowledge_source
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/knowledge", tags=["knowledge"])


@router.post("/crawl", response_model=KnowledgeSourceResponse)
async def crawl_website(
    request: WebCrawlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Crawl website and ingest content"""
    try:
        source = ingest_web_content(request.url, request.max_pages, request.max_depth, db)
        return source
    except Exception as e:
        logger.error(f"Error crawling website: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Upload and ingest document"""
    try:
        # Determine file type
        filename = file.filename.lower()
        if filename.endswith('.pdf'):
            source_type = SourceType.PDF
        elif filename.endswith(('.docx', '.doc')):
            source_type = SourceType.DOCX
        elif filename.endswith(('.xlsx', '.xls')):
            source_type = SourceType.XLSX
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Read file content
        content = await file.read()
        
        # Ingest document
        source = ingest_document(content, file.filename, source_type, db)
        
        return DocumentUploadResponse(
            id=source.id,
            name=source.name,
            source_type=source.source_type.value,
            status=source.status
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources", response_model=List[KnowledgeSourceResponse])
async def list_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all knowledge sources"""
    sources = db.query(KnowledgeSource).all()
    return sources


@router.delete("/sources/{source_id}")
async def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete knowledge source"""
    try:
        delete_knowledge_source(source_id, db)
        return {"message": "Knowledge source deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting source: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
