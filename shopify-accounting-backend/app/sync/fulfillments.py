
import re
import httpx
from requests import Session
from app.models.fulfillment import Fulfillment
from app.models.order import Order
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient

async def sync_fulfillments(db: Session, shop: Shop, order: Order , client = ShopifyClient):

    response, _ = await client.get(
        f"/orders/{order.shopify_order_id}/fulfillments.json"
    )

    for f in response.get("fulfillments", []):
        fulfillment = db.query(Fulfillment).filter(
            Fulfillment.shopify_fulfillment_id == f["id"]
        ).first()

        if not fulfillment:
            fulfillment = Fulfillment(
                order_id=order.id,
                shopify_fulfillment_id=f["id"]
            )

        fulfillment.status = f.get("status")
        fulfillment.tracking_company = f.get("tracking_company")
        fulfillment.tracking_number = (
            f.get("tracking_numbers") or [None]
        )[0]
        fulfillment.shipped_at = f.get("created_at")
        fulfillment.raw_data = f

        db.add(fulfillment)

    db.commit()
