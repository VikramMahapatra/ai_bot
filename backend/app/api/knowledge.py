from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict
from app.database import get_db
from app.auth import require_admin
from app.models import User, KnowledgeSource, SourceType
from app.schemas import (
    KnowledgeSourceResponse,
    WebCrawlRequest,
    DocumentUploadResponse
)
from app.services import ingest_web_content, ingest_document, delete_knowledge_source
from app.services.rag import chroma_client
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
    """Crawl website and ingest content for the current user"""
    try:
        source = ingest_web_content(request.url, request.max_pages, request.max_depth, current_user.id, db)
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
    """Upload and ingest document for the current user"""
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
        source = ingest_document(content, file.filename, source_type, current_user.id, db)
        
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
    """List all knowledge sources for the current user"""
    sources = db.query(KnowledgeSource).filter(KnowledgeSource.user_id == current_user.id).all()
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
        source = db.query(KnowledgeSource).filter(
            KnowledgeSource.id == source_id,
            KnowledgeSource.user_id == current_user.id
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
    current_user: User = Depends(require_admin)
) -> Dict:
    """Get vectorized data (embeddings metadata) for the current user"""
    try:
        # Get all vectorized documents for this user from ChromaDB
        results = chroma_client.get_user_documents(current_user.id)
        
        # Format the response
        documents_info = []
        if results and results.get('ids'):
            for i, doc_id in enumerate(results['ids']):
                metadata = results['metadatas'][i] if results.get('metadatas') else {}
                documents_info.append({
                    "id": doc_id,
                    "source_id": metadata.get("source_id"),
                    "source_type": metadata.get("source_type"),
                    "filename": metadata.get("filename"),
                    "url": metadata.get("url"),
                    "title": metadata.get("title"),
                    "chunk_index": metadata.get("chunk_index"),
                    "created_at": metadata.get("created_at"),
                    "preview": results['documents'][i][:200] + "..." if results.get('documents') and len(results['documents'][i]) > 200 else results['documents'][i] if results.get('documents') else ""
                })
        
        return {
            "user_id": current_user.id,
            "total_chunks": len(documents_info),
            "documents": documents_info
        }
    except Exception as e:
        logger.error(f"Error getting vectorized data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
