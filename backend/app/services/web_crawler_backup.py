import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Set
import logging
import time
import base64
from openai import OpenAI
from app.config import settings
from PIL import Image
from io import BytesIO
import io

logger = logging.getLogger(__name__)


class WebCrawler:
    def __init__(self, start_url: str, max_pages: int = 10, max_depth: int = 3, extract_image_info: bool = True):
        self.start_url = start_url
        self.max_pages = max_pages
        self.max_depth = max_depth
        self.enable_image_extraction = extract_image_info
        self.visited_urls: Set[str] = set()
        self.crawled_pages: List[Dict[str, str]] = []
        self.base_domain = urlparse(start_url).netloc
        self.client = OpenAI(api_key=settings.OPENAPI_KEY2) if extract_image_info else None
    
    def is_valid_url(self, url: str) -> bool:
        """Check if URL is valid and belongs to the same domain"""
        parsed = urlparse(url)
        return (
            parsed.scheme in ['http', 'https'] and
            parsed.netloc == self.base_domain and
            url not in self.visited_urls
        )
    
    def extract_image_info(self, img_url: str, alt_text: str = "") -> str:
        """Use GPT-4o-mini vision to extract information from image"""
        try:
            # Download image
            response = requests.get(img_url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; Chatbot/1.0)'
            })
            response.raise_for_status()
            
            content_type = response.headers.get('content-type', '').lower()
            file_ext = img_url.lower().split('.')[-1].split('?')[0]
            
            # Handle SVG files - convert to PNG
            if 'svg' in content_type or file_ext == 'svg':
                try:
                    import cairosvg
                    png_data = BytesIO()
                    cairosvg.svg2png(bytestring=response.content, write_to=png_data)
                    png_data.seek(0)
                    image_bytes = png_data.getvalue()
                except:
                    # Fallback: try to render with PIL
                    try:
                        image = Image.open(BytesIO(response.content))
                        png_buffer = BytesIO()
                        image.save(png_buffer, format='PNG')
                        image_bytes = png_buffer.getvalue()
                    except:
                        logger.warning(f"Could not convert SVG: {img_url}")
                        return ""
            
            # Handle GIF files - convert to PNG
            elif file_ext == 'gif' or 'gif' in content_type:
                try:
                    image = Image.open(BytesIO(response.content))
                    # Convert GIF to PNG
                    png_buffer = BytesIO()
                    image.convert('RGB').save(png_buffer, format='PNG')
                    image_bytes = png_buffer.getvalue()
                except Exception as e:
                    logger.warning(f"Could not convert GIF: {img_url} - {str(e)}")
                    return ""
            
            # Handle ICO files - convert to PNG
            elif file_ext == 'ico' or 'icon' in content_type:
                try:
                    image = Image.open(BytesIO(response.content))
                    png_buffer = BytesIO()
                    image.convert('RGB').save(png_buffer, format='PNG')
                    image_bytes = png_buffer.getvalue()
                except Exception as e:
                    logger.warning(f"Could not convert ICO: {img_url} - {str(e)}")
                    return ""
            
            # Handle standard formats (PNG, JPEG, WebP)
            else:
                image_bytes = response.content
            
            # Convert to base64
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            
            # Call GPT-4o-mini vision
            vision_response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Describe this image in detail. Extract any visible text, product information, or important details. Alt text context: {alt_text}"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=300
            )
            
            description = vision_response.choices[0].message.content
            return description.strip()
            
        except Exception as e:
            logger.warning(f"Error extracting info from image {img_url}: {str(e)}")
            return ""
    
    def extract_text(self, html: str, url: str) -> str:
        """Extract text content from HTML and images"""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text
        text = soup.get_text()
        
        # Extract information from images if enabled
        if self.enable_image_extraction and self.client:
            image_descriptions = []
            images = soup.find_all('img', src=True)
            
            # Limit to first 5 images per page to avoid excessive API calls
            for img in images[:5]:
                img_url = urljoin(url, img['src'])
                if img_url.startswith('http'):
                    alt_text = img.get('alt', '')
                    img_info = self.extract_image_info(img_url, alt_text)
                    if img_info:
                        image_descriptions.append(f"[Image: {alt_text or 'No alt text'}]\n{img_info}")
            
            if image_descriptions:
                text += "\n\n=== Image Information ===\n\n" + "\n\n".join(image_descriptions)
        
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
            text = self.extract_text(response.text, url)
            
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
            
            # Be respectful with delay (increased for API calls)
            time.sleep(1.0)
        
        logger.info(f"Crawled {len(self.crawled_pages)} pages")
        return self.crawled_pages
