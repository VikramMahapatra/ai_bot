from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from sqlalchemy.orm import Session
from typing import List, Dict
from pydantic import BaseModel
from app.database import get_db
from app.auth import require_admin
from app.models import User, KnowledgeSource, SourceType
from app.schemas import (
    KnowledgeSourceResponse,
    WebCrawlRequest,
    DocumentUploadResponse,
    WebCrawlResponse
)
from app.services import ingest_web_content, ingest_document, ingest_text_content, delete_knowledge_source
from app.services.limits_service import get_effective_limits, get_or_create_subscription_usage, increment_usage
from app.services.rag import chroma_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/knowledge", tags=["knowledge"])


class TextIngestRequest(BaseModel):
    widget_id: str
    title: str
    content: str


@router.post("/crawl", response_model=WebCrawlResponse)
async def crawl_website(
    request: WebCrawlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Crawl website and ingest content for the current user"""
    try:
        limits = get_effective_limits(db, current_user.organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        usage = get_or_create_subscription_usage(db, current_user.organization_id)
        if not usage:
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        if request.max_depth > limits["max_crawl_depth"]:
            raise HTTPException(
                status_code=400,
                detail=f"Max crawl depth exceeded. Limit is {limits['max_crawl_depth']}",
            )

        remaining_pages = limits["monthly_crawl_pages_limit"] - usage.crawl_pages_count
        if request.max_pages > remaining_pages:
            raise HTTPException(
                status_code=403,
                detail=f"Monthly crawl page limit exceeded. Remaining pages: {remaining_pages}",
            )

        source, pages_crawled, pages_scanned = ingest_web_content(
            request.url,
            request.max_pages,
            request.max_depth,
            current_user.id,
            request.widget_id,
            db,
        )

        increment_usage(db, current_user.organization_id, crawl_pages_count=pages_crawled)
        unchanged = pages_crawled == 0
        message = "No changes detected. Page already embedded." if unchanged else f"Crawled {pages_crawled} updated pages."
        return WebCrawlResponse(
            source=source,
            pages_crawled=pages_crawled,
            pages_scanned=pages_scanned,
            unchanged=unchanged,
            message=message
        )
    except Exception as e:
        logger.error(f"Error crawling website: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    widget_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Upload and ingest document for the current user"""
    try:
        limits = get_effective_limits(db, current_user.organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        usage = get_or_create_subscription_usage(db, current_user.organization_id)
        if not usage:
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

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

        max_bytes = limits["max_document_size_mb"] * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"Document size exceeds {limits['max_document_size_mb']} MB limit",
            )

        if usage.documents_count >= limits["monthly_document_limit"]:
            raise HTTPException(
                status_code=403,
                detail="Monthly document limit exceeded",
            )
        
        # Ingest document
        source = ingest_document(content, file.filename, source_type, current_user.id, widget_id, db)

        increment_usage(db, current_user.organization_id, documents_count=1)
        
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
    current_user: User = Depends(require_admin)
):
    """Ingest raw text content (used for knowledge gap suggestions)."""
    try:
        limits = get_effective_limits(db, current_user.organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        usage = get_or_create_subscription_usage(db, current_user.organization_id)
        if not usage:
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        max_bytes = limits["max_document_size_mb"] * 1024 * 1024
        content_bytes = len((request.content or "").encode("utf-8"))
        if content_bytes > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"Content size exceeds {limits['max_document_size_mb']} MB limit",
            )

        if usage.documents_count >= limits["monthly_document_limit"]:
            raise HTTPException(
                status_code=403,
                detail="Monthly document limit exceeded",
            )

        source = ingest_text_content(request.content, request.title, current_user.id, request.widget_id, db)
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


@router.get("/sources", response_model=List[KnowledgeSourceResponse])
async def list_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    widget_id: str = None,
):
    """List all knowledge sources for the current organization"""
    query = db.query(KnowledgeSource).join(User, KnowledgeSource.user_id == User.id).filter(
        User.organization_id == current_user.organization_id
    )
    if widget_id:
        query = query.filter(KnowledgeSource.widget_id == widget_id)
    sources = query.all()
    return sources


@router.delete("/sources/{source_id}")
async def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete knowledge source"""
    try:
        # Verify the source belongs to the current user
        source = db.query(KnowledgeSource).join(User, KnowledgeSource.user_id == User.id).filter(
            KnowledgeSource.id == source_id,
            User.organization_id == current_user.organization_id
        ).first()
        
        if not source:
            raise HTTPException(status_code=404, detail="Knowledge source not found or unauthorized")
        
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
) -> Dict:
    """Get vectorized data (embeddings metadata) for the current organization"""
    try:
        if not widget_id:
            raise HTTPException(status_code=400, detail="widget_id is required")
        
        logger.info(f"Fetching vectorized data for org {current_user.organization_id}, widget {widget_id}")
        
        # Get all vectorized documents for this user from ChromaDB
        try:
            results = chroma_client.get_documents(
                organization_id=current_user.organization_id,
                widget_id=widget_id,
            )
        except Exception as chroma_error:
            logger.error(f"ChromaDB query error: {str(chroma_error)}", exc_info=True)
            # Return empty results instead of failing
            results = {"ids": [], "metadatas": [], "documents": []}
        
        # Format the response
        documents_info = []
        if results and results.get('ids'):
            for i, doc_id in enumerate(results['ids']):
                try:
                    metadata = results['metadatas'][i] if results.get('metadatas') and i < len(results['metadatas']) else {}
                    preview = ""
                    if results.get('documents') and i < len(results['documents']):
                        doc_content = results['documents'][i]
                        preview = doc_content[:200] + "..." if len(doc_content) > 200 else doc_content
                    
                    documents_info.append({
                        "id": doc_id,
                        "source_id": metadata.get("source_id"),
                        "source_type": metadata.get("source_type"),
                        "filename": metadata.get("filename"),
                        "url": metadata.get("url"),
                        "title": metadata.get("title"),
                        "chunk_index": metadata.get("chunk_index"),
                        "created_at": metadata.get("created_at"),
                        "preview": preview
                    })
                except Exception as item_error:
                    logger.error(f"Error processing document {i}: {str(item_error)}")
                    continue
        
        return {
            "organization_id": current_user.organization_id,
            "user_id": current_user.id,
            "total_chunks": len(documents_info),
            "documents": documents_info
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting vectorized data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
