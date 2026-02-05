import re
import httpx
from requests import Session
from app.helpers.sync_state_helper import get_last_sync, update_last_sync
from app.models.product import Product
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient
from app.models.order import Order
from app.models.order_tax import OrderTaxLine

# -------------------------------
# Products Sync
# -------------------------------
async def sync_products(db: Session, shop: Shop, client : ShopifyClient):

    last_sync = get_last_sync(db, shop.id, "products")  # datetime | None
    params = {"limit": 250}
    if last_sync:
        params["updated_at_min"] = last_sync.isoformat()

    url = "/products.json"
    synced = 0

    while True:
        response, headers = await client.get(url, params=params)
        products = response.get("products", [])

        for p in products:
            product = db.query(Product).filter(
                Product.shopify_product_id == p["id"],
                Product.shop_id == shop.id
            ).first()

            if not product:
                product = Product(
                    shop_id=shop.id,
                    shopify_product_id=p["id"]
                )

            product.title = p.get("title")
            product.description = p.get("body_html")
            product.vendor = p.get("vendor")
            product.product_type = p.get("product_type")
            product.variants = p.get("variants")
            product.images = p.get("images")
            product.raw_data = p

            db.add(product)
            synced += 1

        db.commit()

        # ---- Pagination ----
        link = headers.get("Link")
        match = re.search(r'page_info=([^&>]+)', link or "")
        if not match:
            break

        params = {"page_info": match.group(1)}  # ⚠️ ONLY page_info

    update_last_sync(db, shop.id, "products")
    print(f"✅ Synced {synced} products")



