import re
import httpx
from requests import Session
from app.models.location import Location
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient

async def sync_locations(db: Session, shop: Shop, client: ShopifyClient):
    response, _ = await client.get("/locations.json")

    for loc in response.get("locations", []):
        location = db.query(Location).filter(
            Location.shopify_location_id == loc["id"]
        ).first()

        if not location:
            location = Location(
                shop_id=shop.id,
                shopify_location_id=loc["id"]
            )

        location.name = loc.get("name")
        location.active = loc.get("active")
        location.address1 = loc.get("address1")
        location.city = loc.get("city")
        location.country = loc.get("country")
        location.raw_data = loc

        db.add(location)

    db.commit()
