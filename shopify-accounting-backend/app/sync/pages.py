import re
import httpx
from requests import Session
from app.helpers.sync_state_helper import get_last_sync, update_last_sync
from app.models.page import Page
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient

async def sync_pages(db: Session, shop: Shop, client : ShopifyClient):
   
    last_sync = get_last_sync(db, shop.id, "pages")
    params = {"limit": 250}
    
    synced_count = 0
    while True:
        try:
            response, headers = await client.get("/pages.json", params=params)
        
            pages = response.get("pages", [])

            if not pages:
                print(
                    f"Pages sync skipped — storefront is password-protected "
                    f"for {shop.shop_domain}"
                )
                return

            for p in response.get("pages", []):
                if p.get("updated_at") <= last_sync.isoformat():
                    continue
                page = db.query(Page).filter(
                    Page.shopify_page_id == p["id"]
                ).first()

                if not page:
                    page = Page(
                        shop_id=shop.id,
                        shopify_page_id=p["id"]
                    )

                page.title = p.get("title")
                page.handle = p.get("handle")
                page.published_at = p.get("published_at")
                page.raw_data = p

                db.add(page)
                synced_count += 0

            db.commit()

            link = headers.get("Link")
            match = re.search(r'page_info=([^&>]+)', link or "")
            if not match:
                break

            params = {"page_info": match.group(1)}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                print(
                    f"Skipping pages sync — Online Store not accessible for "
                    f"{shop.shop_domain}"
                )
                return
            raise
        
    update_last_sync(db, shop.id, "pages")
    print(f"Synced {synced_count} pages for shop {shop.shop_domain}")
