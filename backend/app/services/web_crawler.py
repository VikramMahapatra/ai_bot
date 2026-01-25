import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Set
import logging
import time

logger = logging.getLogger(__name__)


class WebCrawler:
    def __init__(self, start_url: str, max_pages: int = 10, max_depth: int = 3):
        self.start_url = start_url
        self.max_pages = max_pages
        self.max_depth = max_depth
        self.visited_urls: Set[str] = set()
        self.crawled_pages: List[Dict[str, str]] = []
        self.base_domain = urlparse(start_url).netloc
    
    def is_valid_url(self, url: str) -> bool:
        """Check if URL is valid and belongs to the same domain"""
        parsed = urlparse(url)
        return (
            parsed.scheme in ['http', 'https'] and
            parsed.netloc == self.base_domain and
            url not in self.visited_urls
        )
    
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
    
    def crawl_page(self, url: str, depth: int) -> List[str]:
        """Crawl a single page and return links"""
        if depth > self.max_depth or len(self.crawled_pages) >= self.max_pages:
            return []
        
        if url in self.visited_urls:
            return []
        
        try:
            logger.info(f"Crawling: {url} (depth: {depth})")
            response = requests.get(url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; Chatbot/1.0)'
            })
            response.raise_for_status()
            
            self.visited_urls.add(url)
            
            soup = BeautifulSoup(response.text, 'html.parser')
            title = self.get_title(soup)
            text = self.extract_text(response.text)
            
            self.crawled_pages.append({
                'url': url,
                'title': title,
                'content': text,
                'depth': depth
            })
            
            # Extract links for further crawling
            links = []
            for link in soup.find_all('a', href=True):
                absolute_url = urljoin(url, link['href'])
                # Remove fragments
                absolute_url = absolute_url.split('#')[0]
                if self.is_valid_url(absolute_url):
                    links.append(absolute_url)
            
            return links
            
        except Exception as e:
            logger.error(f"Error crawling {url}: {str(e)}")
            return []
    
    def crawl(self) -> List[Dict[str, str]]:
        """Start crawling from the start URL"""
        urls_to_crawl = [(self.start_url, 0)]
        
        while urls_to_crawl and len(self.crawled_pages) < self.max_pages:
            url, depth = urls_to_crawl.pop(0)
            
            if url in self.visited_urls:
                continue
            
            new_links = self.crawl_page(url, depth)
            
            # Add new links to crawl queue
            for link in new_links:
                if link not in self.visited_urls:
                    urls_to_crawl.append((link, depth + 1))
            
            # Be respectful with delay
            time.sleep(0.5)
        
        logger.info(f"Crawled {len(self.crawled_pages)} pages")
        return self.crawled_pages
