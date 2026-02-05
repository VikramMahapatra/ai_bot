import re
import httpx
from requests import Session
from app.models.fulfillment import Fulfillment
from app.models.order import Order
from app.models.refund import Refund
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient

def sync_refunds(db: Session, order: Order, shopify_order: dict):
    for r in shopify_order.get("refunds", []):
        refund = db.query(Refund).filter(
            Refund.shopify_refund_id == r["id"]
        ).first()

        if not refund:
            refund = Refund(
                order_id=order.id,
                shopify_refund_id=r["id"]
            )

        refund.total_amount = sum(
            float(t["amount"]) for t in r.get("transactions", [])
        )
        refund.created_at = r.get("created_at")
        refund.raw_data = r

        db.add(refund)
