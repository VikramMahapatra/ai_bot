
from decimal import Decimal
import re
import httpx
from requests import Session
from app.models.fulfillment import Fulfillment
from app.models.order import Order
from app.models.shipping_line import ShippingLine
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient

async def sync_fulfillments(db: Session, shop: Shop, order: Order, client: ShopifyClient):
    response, _ = await client.get(
        f"/orders/{order.shopify_order_id}/fulfillments.json"
    )

    for f in response.get("fulfillments", []):
        # ---- Find existing fulfillment ----
        fulfillment = db.query(Fulfillment).filter(
            Fulfillment.shopify_fulfillment_id == f["id"]
        ).first()

        if not fulfillment:
            fulfillment = Fulfillment(
                order_id=order.id,
                shopify_fulfillment_id=f["id"]
            )

        # ---- Basic fields ----
        fulfillment.status = f.get("status")
        fulfillment.tracking_company = f.get("tracking_company")
        fulfillment.tracking_number = (f.get("tracking_numbers") or [None])[0]
        fulfillment.shipped_at = f.get("created_at")
        fulfillment.location_id = f.get("location_id")
        fulfillment.notify_customer = f.get("notify_customer", False)

        # ---- Raw JSON ----
        fulfillment.raw_data = f

        db.add(fulfillment)
        db.flush()  # Need ID for shipping lines

        # ---- Sync shipping lines ----
        existing_lines = {sl.title: sl for sl in fulfillment.shipping_lines}  # Avoid duplicates

        for sl in f.get("shipping_lines", []):
            title = sl.get("title")
            if title in existing_lines:
                shipping_line = existing_lines[title]
            else:
                shipping_line = ShippingLine(fulfillment_id=fulfillment.id)
            
            shipping_line.title = title
            shipping_line.price = Decimal(sl.get("price", 0))
            shipping_line.code = sl.get("code")
            shipping_line.carrier_identifier = sl.get("carrier_identifier")

            db.add(shipping_line)

    db.commit()

