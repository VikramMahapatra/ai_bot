from datetime import datetime
import re
import httpx
from requests import Session
from app.helpers.sync_state_helper import get_last_sync, update_last_sync
from app.models.customer import Customer
from app.models.inventory_level import InventoryLevel
from app.models.product import Product
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient

async def sync_inventory_levels(db: Session, shop: Shop, client : ShopifyClient):
    
    response, _ = await client.get("/locations.json")
    locations = response.get("locations", [])

    if not locations:
        print(f"No locations found for shop {shop.shop_domain}")
        return
    
    last_sync = get_last_sync(db, shop.id, "inventory_levels")
    
    for loc in locations:
    
        location_id = loc["id"]
        params = {
            "location_ids": location_id,
            "limit": 250
        }
        if last_sync:
            params["updated_at_min"] = last_sync.isoformat()
            
        url = "/inventory_levels.json"
        synced = 0

        while True:
            response, headers = await client.get(url, params=params)

            for inv in response.get("inventory_levels", []):
                row = db.query(InventoryLevel).filter(
                    InventoryLevel.inventory_item_id == inv["inventory_item_id"],
                    InventoryLevel.location_id == inv["location_id"]
                ).first()

                if not row:
                    row = InventoryLevel(
                        shop_id=shop.id,
                        inventory_item_id=inv["inventory_item_id"],
                        location_id=inv["location_id"]
                    )

                row.available = inv.get("available")
                row.updated_at = datetime.utcnow()
                row.raw_data = inv

                db.add(row)
                synced += 1

            db.commit()

            link = headers.get("Link")
            match = re.search(r'page_info=([^&>]+)', link or "")
            if not match:
                break

            params = {"page_info": match.group(1)}

    update_last_sync(db, shop.id, "inventory_levels")
    print(f"✅ Synced {synced} inventory levels")
