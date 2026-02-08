from sqlalchemy.orm import Session
from app.models import KnowledgeSource, SourceType, User
from app.services.web_crawler import WebCrawler
from app.services.rag import chroma_client
from app.utils.parsers import parse_pdf, parse_docx, parse_xlsx, chunk_text
from app.config import settings
import logging
import os
import json
from datetime import datetime
from typing import List, Dict, Tuple
from urllib.parse import urlparse
import hashlib

logger = logging.getLogger(__name__)


def _get_org_id(user_id: int, db: Session) -> int:
    """Resolve the user's organization id or raise if not found."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise Exception(f"User {user_id} not found")
    return user.organization_id


def _stable_url_hash(url: str) -> str:
    return hashlib.sha256(url.encode('utf-8')).hexdigest()[:16]


def _normalize_url(url: str) -> str:
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    if (scheme == "http" and netloc.endswith(":80")) or (scheme == "https" and netloc.endswith(":443")):
        netloc = netloc.split(":")[0]
    path = parsed.path or ""
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    normalized = f"{scheme}://{netloc}{path}"
    if parsed.query:
        normalized = f"{normalized}?{parsed.query}"
    return normalized


def ingest_web_content(url: str, max_pages: int, max_depth: int, user_id: int, widget_id: str, db: Session) -> Tuple[KnowledgeSource, int, int]:
    """Crawl website and ingest content into knowledge base. Returns (source, pages_crawled)."""
    try:
        organization_id = _get_org_id(user_id, db)

        existing_source = db.query(KnowledgeSource).filter(
            KnowledgeSource.organization_id == organization_id,
            KnowledgeSource.widget_id == widget_id,
            KnowledgeSource.source_type == SourceType.WEB,
            KnowledgeSource.url == url,
            KnowledgeSource.status == "active"
        ).first()

        page_cache: Dict[str, Dict] = {}
        if existing_source and existing_source.source_metadata:
            try:
                metadata_obj = json.loads(existing_source.source_metadata)
                raw_cache = metadata_obj.get("page_cache", {}) or {}
                page_cache = {_normalize_url(k): v for k, v in raw_cache.items()}
            except Exception:
                page_cache = {}

        # Crawl website (incremental)
        if max_pages >= 100:
            max_workers = 10
            crawl_delay = 0.1
        elif max_pages >= 50:
            max_workers = 8
            crawl_delay = 0.15
        elif max_pages >= 20:
            max_workers = 6
            crawl_delay = 0.2
        else:
            max_workers = 4
            crawl_delay = 0.3

        crawler = WebCrawler(
            url,
            max_pages,
            max_depth,
            page_cache=page_cache,
            max_workers=max_workers,
            crawl_delay=crawl_delay,
        )
        pages = crawler.crawl()
        
        # If no pages changed, still update metadata and return
        if pages is None:
            pages = []
        
        if existing_source:
            source = existing_source
        else:
            source = KnowledgeSource(
                user_id=user_id,
                organization_id=organization_id,
                widget_id=widget_id,
                source_type=SourceType.WEB,
                name=f"Web: {url}",
                url=url,
                source_metadata=None,
                status="active"
            )
            db.add(source)
            db.commit()
            db.refresh(source)
        
        # Process and store each changed page
        documents = []
        metadatas = []
        ids = []
        
        for idx, page in enumerate(pages):
            # Chunk the content
            chunks = chunk_text(page['content'])

            # Remove old chunks for this URL (if any)
            if page.get('url'):
                chroma_client.delete_by_source_id_and_url(source.id, page['url'])
            
            for chunk_idx, chunk in enumerate(chunks):
                url_hash = _stable_url_hash(page['url'])
                doc_id = f"org_{organization_id}_source_{source.id}_url_{url_hash}_chunk_{chunk_idx}"
                documents.append(chunk)
                metadatas.append({
                    "organization_id": str(organization_id),
                    "user_id": str(user_id),
                    "widget_id": str(widget_id),
                    "source_id": str(source.id),
                    "source_type": "WEB",
                    "url": page['url'],
                    "title": page['title'],
                    "chunk_index": chunk_idx,
                    "content_hash": page.get("content_hash"),
                    "created_at": datetime.now().isoformat()
                })
                ids.append(doc_id)
        
        # Add to ChromaDB
        if documents:
            chroma_client.add_documents(documents, metadatas, ids)
        
        source.source_metadata = json.dumps({
            "pages_crawled": len(pages),
            "pages_scanned": crawler.pages_scanned,
            "page_cache": crawler.updated_cache
        })
        db.commit()
        db.refresh(source)

        logger.info(f"Ingested {len(documents)} chunks from {len(pages)} pages for user {user_id} (org {organization_id})")
        return source, len(pages), crawler.pages_scanned
        
    except Exception as e:
        logger.error(f"Error ingesting web content: {str(e)}")
        raise


def ingest_document(file_content: bytes, filename: str, source_type: SourceType, user_id: int, widget_id: str, db: Session) -> KnowledgeSource:
    """Parse and ingest document into knowledge base"""
    try:
        organization_id = _get_org_id(user_id, db)

        # Parse document based on type
        if source_type == SourceType.PDF:
            text = parse_pdf(file_content)
        elif source_type == SourceType.DOCX:
            text = parse_docx(file_content)
        elif source_type == SourceType.XLSX:
            text = parse_xlsx(file_content)
        else:
            raise Exception(f"Unsupported file type: {source_type}")
        
        if not text:
            raise Exception("No text content extracted from document")
        
        # Save file to uploads directory
        upload_dir = os.path.join(os.getcwd(), settings.UPLOAD_DIR)
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, filename)
        
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Create knowledge source
        source = KnowledgeSource(
            user_id=user_id,
            organization_id=organization_id,
            widget_id=widget_id,
            source_type=source_type,
            name=filename,
            file_path=file_path,
            source_metadata=json.dumps({"original_filename": filename}),
            status="active"
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        
        # Chunk the text
        chunks = chunk_text(text)
        
        # Prepare for ChromaDB
        documents = []
        metadatas = []
        ids = []
        
        for idx, chunk in enumerate(chunks):
            doc_id = f"org_{organization_id}_user_{user_id}_source_{source.id}_chunk_{idx}"
            documents.append(chunk)
            metadatas.append({
                "organization_id": str(organization_id),
                "user_id": str(user_id),
                "widget_id": str(widget_id),
                "source_id": str(source.id),
                "source_type": source_type.value,
                "filename": filename,
                "chunk_index": idx,
                "created_at": datetime.now().isoformat()
            })
            ids.append(doc_id)
        
        # Add to ChromaDB
        if documents:
            chroma_client.add_documents(documents, metadatas, ids)
        
        logger.info(f"Ingested {len(chunks)} chunks from document {filename} for user {user_id} (org {organization_id})")
        return source
        
    except Exception as e:
        logger.error(f"Error ingesting document: {str(e)}")
        raise


def ingest_text_content(text: str, title: str, user_id: int, widget_id: str, db: Session) -> KnowledgeSource:
    """Ingest raw text content into knowledge base."""
    try:
        organization_id = _get_org_id(user_id, db)
        if not text or not text.strip():
            raise Exception("Text content is empty")

        source = KnowledgeSource(
            user_id=user_id,
            organization_id=organization_id,
            widget_id=widget_id,
            source_type=SourceType.TEXT,
            name=title,
            source_metadata=json.dumps({"source": "gap_suggestion"}),
            status="active"
        )
        db.add(source)
        db.commit()
        db.refresh(source)

        chunks = chunk_text(text)
        documents = []
        metadatas = []
        ids = []

        for idx, chunk in enumerate(chunks):
            doc_id = f"org_{organization_id}_user_{user_id}_source_{source.id}_chunk_{idx}"
            documents.append(chunk)
            metadatas.append({
                "organization_id": str(organization_id),
                "user_id": str(user_id),
                "widget_id": str(widget_id),
                "source_id": str(source.id),
                "source_type": SourceType.TEXT.value,
                "title": title,
                "chunk_index": idx,
                "created_at": datetime.now().isoformat()
            })
            ids.append(doc_id)

        if documents:
            chroma_client.add_documents(documents, metadatas, ids)

        logger.info(f"Ingested {len(chunks)} chunks from text source {title} for user {user_id} (org {organization_id})")
        return source
    except Exception as e:
        logger.error(f"Error ingesting text content: {str(e)}")
        raise


def delete_knowledge_source(source_id: int, db: Session):
    """Delete knowledge source and its embeddings"""
    try:
        source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
        if not source:
            raise Exception(f"Knowledge source {source_id} not found")
        
        # Delete from ChromaDB
        chroma_client.delete_by_source_id(source_id)
        
        # Delete file if it exists
        if source.file_path and os.path.exists(source.file_path):
            os.remove(source.file_path)
        
        # Delete from database
        db.delete(source)
        db.commit()
        
        logger.info(f"Deleted knowledge source {source_id}")
        
    except Exception as e:
        logger.error(f"Error deleting knowledge source: {str(e)}")
        raise
