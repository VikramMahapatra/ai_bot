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
async def sync_products(db: Session, shop: Shop, client: ShopifyClient):
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
            # ---- Find existing product ----
            product = db.query(Product).filter(
                Product.shopify_product_id == p["id"],
                Product.shop_id == shop.id
            ).first()

            if not product:
                product = Product(
                    shop_id=shop.id,
                    shopify_product_id=p["id"]
                )

            # ---- Basic info ----
            product.title = p.get("title")
            product.vendor = p.get("vendor")
            product.product_type = p.get("product_type")
            product.handle = p.get("handle")
            product.tags = ",".join(p.get("tags", "").split(",") if p.get("tags") else [])
            product.description = p.get("body_html")
            product.active = not p.get("published_at") is None  # True if published

            # ---- Pricing / Variants ----
            product.variants = p.get("variants")  # full variant JSON
            if p.get("variants"):
                # Example: store default price (first variant)
                product.price = float(p["variants"][0].get("price", 0))
                product.cost = float(p["variants"][0].get("cost", 0)) if "cost" in p["variants"][0] else None

            # ---- Images / Raw JSON ----
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




