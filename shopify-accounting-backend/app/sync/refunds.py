import re
import httpx
from requests import Session
from sqlalchemy import func
from app.models.fulfillment import Fulfillment
from app.models.order import Order
from app.models.order_line_item import OrderLineItem
from app.models.refund import Refund
from app.models.refund_line_item import RefundLineItem
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
            float(t.get("amount", 0))
            for t in r.get("transactions", [])
        )

        refund.currency = shopify_order.get("currency")
        refund.created_at = r.get("created_at")
        refund.processed_at = r.get("processed_at")

        refund.refund_reason = (
            r.get("refund_line_items")[0].get("reason")
            if r.get("refund_line_items")
            else None
        )

        refund.raw_data = r

        db.add(refund)
        db.flush()  # needed to get refund.id

        # --------------------------------
        # Delete existing line items (re-sync safe)
        # --------------------------------
        db.query(RefundLineItem).filter(
            RefundLineItem.refund_id == refund.id
        ).delete()

        # --------------------------------
        # Insert refund line items
        # --------------------------------
        for item in r.get("refund_line_items", []):

            line = item.get("line_item", {})

            price = float(line.get("price", 0))
            qty = int(item.get("quantity", 0))

            db.add(RefundLineItem(
                refund_id=refund.id,
                order_id=order.id,
                shopify_line_item_id=line.get("id"),
                product_id=line.get("product_id"),
                variant_id=line.get("variant_id"),
                title=line.get("title"),
                sku=line.get("sku"),
                quantity=qty,
                price=price,
                total=price * qty,
                reason=item.get("reason")
            ))

