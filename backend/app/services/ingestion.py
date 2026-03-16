from sqlalchemy.orm import Session
from app.models import KnowledgeSource, SourceType, User
from app.services.web_crawler import WebCrawler
from app.services.rag import chroma_client
from app.utils.parsers import parse_pdf, parse_docx, parse_xlsx, chunk_text
from app.config import settings
import logging
import os
import json
import time
import threading
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Callable
from urllib.parse import urlparse
import hashlib

logger = logging.getLogger(__name__)

_PREVIEW_CACHE_TTL_SECONDS = 30 * 60
_preview_cache_lock = threading.Lock()
_preview_page_cache: Dict[str, Dict] = {}


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


def _preview_cache_key(organization_id: int, url: str) -> str:
    return f"{organization_id}:{_normalize_url(url)}"


def _cleanup_preview_cache(now_ts: Optional[float] = None) -> None:
    now_ts = now_ts or time.time()
    expired_keys = [
        key
        for key, value in _preview_page_cache.items()
        if now_ts - float(value.get("created_at", 0.0)) > _PREVIEW_CACHE_TTL_SECONDS
    ]
    for key in expired_keys:
        _preview_page_cache.pop(key, None)


def _cache_preview_pages(organization_id: int, url: str, crawled_pages: List[Dict[str, str]]) -> None:
    if not crawled_pages:
        return

    page_map: Dict[str, Dict] = {}
    for page in crawled_pages:
        page_url = page.get("url")
        page_content = page.get("content")
        if not page_url or not page_content:
            continue
        normalized_page_url = _normalize_url(page_url)
        page_map[normalized_page_url] = {
            "url": normalized_page_url,
            "title": page.get("title") or "No Title",
            "content": page_content,
            "depth": page.get("depth", 0),
            "content_hash": page.get("content_hash"),
            "etag": page.get("etag"),
            "last_modified": page.get("last_modified"),
        }

    if not page_map:
        return

    now_ts = time.time()
    with _preview_cache_lock:
        _cleanup_preview_cache(now_ts)
        _preview_page_cache[_preview_cache_key(organization_id, url)] = {
            "created_at": now_ts,
            "pages": page_map,
        }


def _get_cached_preview_pages(
    organization_id: int,
    url: str,
    selected_urls: List[str],
) -> Tuple[List[Dict], List[str]]:
    if not selected_urls:
        return [], []

    selected_normalized: List[str] = []
    selected_seen = set()
    for selected_url in selected_urls:
        try:
            normalized = _normalize_url(selected_url)
        except Exception:
            continue
        if normalized in selected_seen:
            continue
        selected_seen.add(normalized)
        selected_normalized.append(normalized)

    if not selected_normalized:
        return [], []

    key = _preview_cache_key(organization_id, url)
    now_ts = time.time()

    with _preview_cache_lock:
        _cleanup_preview_cache(now_ts)
        cached = _preview_page_cache.get(key)
        if not cached:
            return [], selected_normalized

        cached_pages: Dict[str, Dict] = cached.get("pages", {})
        matched: List[Dict] = []
        missing: List[str] = []

        for normalized_url in selected_normalized:
            cached_page = cached_pages.get(normalized_url)
            if cached_page:
                matched.append(dict(cached_page))
            else:
                missing.append(normalized_url)

    return matched, missing


def discover_web_links(url: str, max_pages: int, max_depth: int, organization_id: Optional[int] = None) -> Tuple[List[Dict[str, object]], int]:
    """Crawl website and return discovered links with depth, without embedding."""
    if max_pages < 1:
        raise Exception("max_pages must be 1 or greater")
    if max_depth < 1:
        raise Exception("max_depth must be 1 or greater")

    if max_pages >= 100:
        max_workers = 12
        crawl_delay = 0.05
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
        page_cache={},
        max_workers=max_workers,
        crawl_delay=crawl_delay,
    )
    crawler.crawl()

    if organization_id is not None:
        _cache_preview_pages(organization_id, url, crawler.crawled_pages)

    return crawler.get_discovered_urls(), crawler.pages_scanned


def ingest_web_content(
    url: str,
    max_pages: int,
    max_depth: int,
    user_id: int,
    widget_id: str,
    db: Session,
    selected_urls: Optional[List[str]] = None,
    progress_callback: Optional[Callable[[Dict[str, object]], None]] = None,
) -> Tuple[KnowledgeSource, int, int]:
    """Crawl website and ingest content into knowledge base. Returns (source, pages_crawled)."""
    try:
        organization_id = _get_org_id(user_id, db)

        def _report_progress(stage: str, progress_pct: int, message: str, **kwargs) -> None:
            if not progress_callback:
                return
            payload: Dict[str, object] = {
                "stage": stage,
                "progress": max(0, min(100, int(progress_pct))),
                "message": message,
            }
            payload.update(kwargs)
            progress_callback(payload)

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
            max_workers = 12
            crawl_delay = 0.05
        elif max_pages >= 50:
            max_workers = 8
            crawl_delay = 0.15
        elif max_pages >= 20:
            max_workers = 6
            crawl_delay = 0.2
        else:
            max_workers = 4
            crawl_delay = 0.3

        crawler = None
        pages_scanned = 0
        updated_cache = dict(page_cache)
        base_domain = urlparse(_normalize_url(url)).netloc

        if selected_urls:
            normalized_selected: List[str] = []
            for selected_url in selected_urls:
                try:
                    normalized = _normalize_url(selected_url)
                except Exception:
                    continue
                if urlparse(normalized).netloc != base_domain:
                    continue
                if normalized not in normalized_selected:
                    normalized_selected.append(normalized)

            if not normalized_selected:
                raise Exception("No valid selected URLs found for embedding")

            cached_pages, missing_urls = _get_cached_preview_pages(organization_id, url, normalized_selected)

            # Reuse preview payload so embed step does not re-crawl selected pages.
            pages_map = {_normalize_url(page["url"]): page for page in cached_pages if page.get("url")}
            pages = [pages_map[selected] for selected in normalized_selected if selected in pages_map]

            if missing_urls:
                logger.warning(
                    "Preview cache miss for %s selected URLs. Falling back to crawl for missing pages.",
                    len(missing_urls),
                )
                crawler = WebCrawler(
                    url,
                    max(max_pages, len(missing_urls)),
                    max_depth,
                    page_cache=page_cache,
                    max_workers=max_workers,
                    crawl_delay=crawl_delay,
                )
                missing_pages = crawler.crawl_selected(missing_urls)
                missing_map = {_normalize_url(page["url"]): page for page in missing_pages if page.get("url")}
                for selected in missing_urls:
                    if selected in missing_map and selected not in pages_map:
                        pages.append(missing_map[selected])
                pages_scanned = crawler.pages_scanned
                updated_cache = crawler.updated_cache

            if cached_pages:
                now_ts = time.time()
                for cached_page in cached_pages:
                    page_url = cached_page.get("url")
                    if not page_url:
                        continue
                    updated_cache[_normalize_url(page_url)] = {
                        "content_hash": cached_page.get("content_hash"),
                        "etag": cached_page.get("etag"),
                        "last_modified": cached_page.get("last_modified"),
                        "last_crawled_at": now_ts,
                    }

            logger.info(
                "Selected URL embedding prepared %s pages (%s from preview cache, %s freshly crawled)",
                len(pages),
                len(cached_pages),
                max(0, len(pages) - len(cached_pages)),
            )
            _report_progress(
                "crawl",
                30,
                f"Prepared {len(pages)} selected pages for embedding",
                pages_total=len(pages),
                pages_scanned=pages_scanned,
                pages_crawled=len(pages),
            )
        else:
            crawler = WebCrawler(
                url,
                max(max_pages, len(selected_urls or [])),
                max_depth,
                page_cache=page_cache,
                max_workers=max_workers,
                crawl_delay=crawl_delay,
            )
            pages = crawler.crawl()
            pages_scanned = crawler.pages_scanned
            updated_cache = crawler.updated_cache
            _report_progress(
                "crawl",
                30,
                f"Crawled {len(pages)} pages",
                pages_total=len(pages),
                pages_scanned=pages_scanned,
                pages_crawled=len(pages),
            )
        
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
        
        # Process and store changed pages with bounded batched writes for higher throughput.
        pages_total = len(pages)
        pages_embedded = 0
        chunks_embedded = 0
        batch_chunk_limit = 300

        batch_documents: List[str] = []
        batch_metadatas: List[Dict] = []
        batch_ids: List[str] = []

        def _flush_embedding_batch() -> None:
            nonlocal chunks_embedded, batch_documents, batch_metadatas, batch_ids
            if not batch_documents:
                return
            chroma_client.add_documents(batch_documents, batch_metadatas, batch_ids)
            chunks_embedded += len(batch_documents)
            batch_documents = []
            batch_metadatas = []
            batch_ids = []

        for page in pages:
            # Chunk the content
            chunks = chunk_text(page['content'])

            # Remove old chunks for this URL (if any)
            if page.get('url'):
                chroma_client.delete_by_source_id_and_url(source.id, page['url'])

            for chunk_idx, chunk in enumerate(chunks):
                url_hash = _stable_url_hash(page['url'])
                doc_id = f"org_{organization_id}_source_{source.id}_url_{url_hash}_chunk_{chunk_idx}"
                batch_documents.append(chunk)
                batch_metadatas.append({
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
                batch_ids.append(doc_id)

                if len(batch_documents) >= batch_chunk_limit:
                    _flush_embedding_batch()

            pages_embedded += 1
            if pages_total > 0:
                progress_pct = 30 + int((pages_embedded / pages_total) * 65)
            else:
                progress_pct = 95
            _report_progress(
                "embedding",
                progress_pct,
                f"Embedded {pages_embedded}/{pages_total} pages",
                pages_completed=pages_embedded,
                pages_total=pages_total,
                pages_scanned=pages_scanned,
                pages_crawled=len(pages),
                chunks_embedded=chunks_embedded,
            )

            _flush_embedding_batch()

        _report_progress(
            "finalizing",
            98,
            "Finalizing knowledge source metadata",
            pages_completed=pages_embedded,
            pages_total=pages_total,
            pages_scanned=pages_scanned,
            pages_crawled=len(pages),
            chunks_embedded=chunks_embedded,
        )
        
        source.source_metadata = json.dumps({
            "pages_crawled": len(pages),
            "pages_scanned": pages_scanned,
            "page_cache": updated_cache
        })
        db.commit()
        db.refresh(source)

        logger.info(f"Ingested {chunks_embedded} chunks from {len(pages)} pages for user {user_id} (org {organization_id})")
        return source, len(pages), pages_scanned
        
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
