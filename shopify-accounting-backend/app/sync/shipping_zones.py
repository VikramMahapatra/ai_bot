import re
import httpx
from requests import Session
from app.helpers.sync_state_helper import get_last_sync, update_last_sync
from app.models.shipping_zone import ShippingZone
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient

async def sync_shipping_zones(db: Session, shop: Shop, client : ShopifyClient):

    response, _ = await client.get("/shipping_zones.json")
    
    synced_count = 0

    for zone in response.get("shipping_zones", []):
        shipping_zone = db.query(ShippingZone).filter(
            ShippingZone.shopify_zone_id == zone["id"]
        ).first()

        if not shipping_zone:
            shipping_zone = ShippingZone(
                shop_id=shop.id,
                shopify_zone_id=zone["id"]
            )

        shipping_zone.name = zone.get("name")
        shipping_zone.raw_data = zone

        db.add(shipping_zone)
        synced_count += 1

    db.commit()
    
    print(f"✅ Synced {synced_count} shipping zones")
