import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Set, Optional
import logging
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib

logger = logging.getLogger(__name__)


class WebCrawler:
    def __init__(
        self,
        start_url: str,
        max_pages: int = 10,
        max_depth: int = 3,
        page_cache: Optional[Dict[str, Dict]] = None,
        max_workers: int = 6,
        crawl_delay: float = 0.2,
    ):
        self.start_url = start_url
        self.max_pages = max_pages
        self.max_depth = max_depth
        self.visited_urls: Set[str] = set()
        self.crawled_pages: List[Dict[str, str]] = []
        self.base_domain = urlparse(start_url).netloc
        self.page_cache: Dict[str, Dict] = page_cache or {}
        self.updated_cache: Dict[str, Dict] = dict(self.page_cache)
        self.pages_scanned = 0
        self.max_workers = max(1, min(max_workers, 12))
        self.crawl_delay = max(0.0, crawl_delay)
        self._lock = threading.Lock()
    
    def normalize_url(self, url: str) -> str:
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

    def is_valid_url(self, url: str) -> bool:
        """Check if URL is valid and belongs to the same domain"""
        parsed = urlparse(url)
        if parsed.scheme not in ['http', 'https'] or parsed.netloc != self.base_domain:
            return False
        with self._lock:
            return url not in self.visited_urls
    
    def extract_text(self, html: str) -> str:
        """Extract text content from HTML"""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text
        text = soup.get_text()
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text
    
    def get_title(self, soup: BeautifulSoup) -> str:
        """Extract page title"""
        title_tag = soup.find('title')
        return title_tag.get_text() if title_tag else "No Title"
    
    def _hash_content(self, text: str) -> str:
        normalized = "".join(ch for ch in text.lower() if not ch.isdigit())
        normalized = " ".join(normalized.split())
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    def crawl_page(self, url: str, depth: int) -> List[str]:
        """Crawl a single page and return links"""
        with self._lock:
            if depth > self.max_depth or len(self.crawled_pages) >= self.max_pages:
                return []
            if url in self.visited_urls:
                return []
            self.visited_urls.add(url)
        
        try:
            url = self.normalize_url(url)
            logger.info(f"Crawling: {url} (depth: {depth})")
            headers = {
                'User-Agent': 'Mozilla/5.0 (compatible; Chatbot/1.0)'
            }

            cached = self.page_cache.get(url, {})
            if cached.get('etag'):
                headers['If-None-Match'] = cached['etag']
            if cached.get('last_modified'):
                headers['If-Modified-Since'] = cached['last_modified']

            response = requests.get(url, timeout=10, headers=headers)
            with self._lock:
                self.pages_scanned += 1

            if response.status_code == 304:
                self.visited_urls.add(url)
                return []

            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            title = self.get_title(soup)
            text = self.extract_text(response.text)

            content_hash = self._hash_content(text)
            etag = response.headers.get('ETag')
            last_modified = response.headers.get('Last-Modified')

            prev_hash = cached.get('content_hash')
            is_changed = prev_hash != content_hash

            with self._lock:
                self.updated_cache[url] = {
                    'content_hash': content_hash,
                    'etag': etag,
                    'last_modified': last_modified,
                    'last_crawled_at': time.time()
                }

            if is_changed:
                with self._lock:
                    if len(self.crawled_pages) < self.max_pages:
                        self.crawled_pages.append({
                            'url': url,
                            'title': title,
                            'content': text,
                            'depth': depth,
                            'content_hash': content_hash,
                            'etag': etag,
                            'last_modified': last_modified
                        })
            
            # Extract links for further crawling
            links = []
            for link in soup.find_all('a', href=True):
                absolute_url = urljoin(url, link['href'])
                # Remove fragments
                absolute_url = absolute_url.split('#')[0]
                absolute_url = self.normalize_url(absolute_url)
                if self.is_valid_url(absolute_url):
                    links.append(absolute_url)
            
            return links
            
        except Exception as e:
            logger.error(f"Error crawling {url}: {str(e)}")
            return []
    
    def crawl(self) -> List[Dict[str, str]]:
        """Start crawling from the start URL"""
        urls_to_crawl = [(self.start_url, 0)]

        if self.max_workers <= 1:
            while urls_to_crawl and len(self.crawled_pages) < self.max_pages:
                url, depth = urls_to_crawl.pop(0)
                url = self.normalize_url(url)

                new_links = self.crawl_page(url, depth)

                for link in new_links:
                    urls_to_crawl.append((link, depth + 1))

                if self.crawl_delay:
                    time.sleep(self.crawl_delay)
        else:
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                while urls_to_crawl and len(self.crawled_pages) < self.max_pages:
                    batch = []
                    while urls_to_crawl and len(batch) < self.max_workers:
                        url, depth = urls_to_crawl.pop(0)
                        url = self.normalize_url(url)
                        batch.append((url, depth))

                    futures = {executor.submit(self.crawl_page, url, depth): depth for url, depth in batch}
                    for future in as_completed(futures):
                        depth = futures[future]
                        try:
                            new_links = future.result() or []
                        except Exception:
                            new_links = []

                        for link in new_links:
                            urls_to_crawl.append((link, depth + 1))

                    if self.crawl_delay:
                        time.sleep(self.crawl_delay)
        
        logger.info(f"Crawled {len(self.crawled_pages)} pages")
        return self.crawled_pages
