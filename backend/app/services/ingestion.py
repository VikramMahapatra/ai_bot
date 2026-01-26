from sqlalchemy.orm import Session
from app.models import KnowledgeSource, SourceType
from app.services.web_crawler import WebCrawler
from app.services.rag import chroma_client
from app.utils.parsers import parse_pdf, parse_docx, parse_xlsx, chunk_text
from app.config import settings
import logging
import os
import json
from datetime import datetime
from typing import List, Dict

logger = logging.getLogger(__name__)


def ingest_web_content(url: str, max_pages: int, max_depth: int, user_id: int, db: Session) -> KnowledgeSource:
    """Crawl website and ingest content into knowledge base"""
    try:
        # Crawl website
        crawler = WebCrawler(url, max_pages, max_depth)
        pages = crawler.crawl()
        
        if not pages:
            raise Exception("No pages were crawled")
        
        # Create knowledge source
        source = KnowledgeSource(
            user_id=user_id,
            source_type=SourceType.WEB,
            name=f"Web: {url}",
            url=url,
            metadata=json.dumps({"pages_crawled": len(pages)}),
            status="active"
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        
        # Process and store each page
        documents = []
        metadatas = []
        ids = []
        
        for idx, page in enumerate(pages):
            # Chunk the content
            chunks = chunk_text(page['content'])
            
            for chunk_idx, chunk in enumerate(chunks):
                doc_id = f"user_{user_id}_source_{source.id}_page_{idx}_chunk_{chunk_idx}"
                documents.append(chunk)
                metadatas.append({
                    "user_id": str(user_id),
                    "source_id": str(source.id),
                    "source_type": "WEB",
                    "url": page['url'],
                    "title": page['title'],
                    "chunk_index": chunk_idx,
                    "created_at": datetime.now().isoformat()
                })
                ids.append(doc_id)
        
        # Add to ChromaDB
        if documents:
            chroma_client.add_documents(documents, metadatas, ids)
        
        logger.info(f"Ingested {len(documents)} chunks from {len(pages)} pages for user {user_id}")
        return source
        
    except Exception as e:
        logger.error(f"Error ingesting web content: {str(e)}")
        raise


def ingest_document(file_content: bytes, filename: str, source_type: SourceType, user_id: int, db: Session) -> KnowledgeSource:
    """Parse and ingest document into knowledge base"""
    try:
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
            source_type=source_type,
            name=filename,
            file_path=file_path,
            metadata=json.dumps({"original_filename": filename}),
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
            doc_id = f"user_{user_id}_source_{source.id}_chunk_{idx}"
            documents.append(chunk)
            metadatas.append({
                "user_id": str(user_id),
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
        
        logger.info(f"Ingested {len(chunks)} chunks from document {filename} for user {user_id}")
        return source
        
    except Exception as e:
        logger.error(f"Error ingesting document: {str(e)}")
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
