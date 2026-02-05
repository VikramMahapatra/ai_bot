import re
import httpx
from requests import Session
from app.helpers.sync_state_helper import get_last_sync, update_last_sync
from app.models.customer import Customer
from app.models.draft_order import DraftOrder
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient
from app.models.order import Order
from app.models.order_tax import OrderTaxLine
from app.sync.refunds import sync_refunds


async def sync_orders(db: Session, shop: Shop, client : ShopifyClient):
    url = "/orders.json"
    
    last_sync = get_last_sync(db, shop.id, "orders")
    params = {"limit": 250}
    if last_sync:
        params["updated_at_min"] = last_sync.isoformat()
        
    synced_count = 0

    while True:
        response, headers = await client.get(url, params=params)

        for o in response.get("orders", []):
            order = db.query(Order).filter(
                Order.shopify_order_id == o["id"]
            ).first()

            if not order:
                order = Order(
                    shop_id=shop.id,
                    shopify_order_id=o["id"]
                )

            order.order_number = o.get("name")
            order.order_date = o.get("created_at")
            order.financial_status = o.get("financial_status")
            order.fulfillment_status = o.get("fulfillment_status")
            order.subtotal_price = o.get("subtotal_price")
            order.total_tax = o.get("total_tax")
            order.total_discount = o.get("total_discounts")
            order.total_price = o.get("total_price")
            order.currency = o.get("currency")
            order.raw_data = o

            db.add(order)
            db.flush()

            hydrate_customer_from_order(db, order, o)    
            
            # --------------------------
            # Tax lines
            # --------------------------
            db.query(OrderTaxLine).filter(
                OrderTaxLine.order_id == order.id
            ).delete()

            for tax in o.get("tax_lines", []):
                db.add(OrderTaxLine(
                    order_id=order.id,
                    title=tax.get("title"),
                    rate=tax.get("rate"),
                    amount=tax.get("price")
                ))

            # --------------------------
            # Refunds  ✅ CALL HERE
            # --------------------------
            sync_refunds(db, order, o)


            synced_count += 1

        db.commit()
       
        # Pagination
        link_header = headers.get("Link")
        match = re.search(r'page_info=([^&>]+)', link_header or "")
        if match:
            params["page_info"] = match.group(1)
        else:
            break

    update_last_sync(db, shop.id, "orders")
    print(f"✅ Synced {synced_count} orders")



async def sync_draft_orders(db: Session, shop: Shop, client : ShopifyClient):

    last_sync = get_last_sync(db, shop.id, "orders")
    params = {"limit": 250}
    if last_sync:
        params["updated_at_min"] = last_sync.isoformat()
        
    url = "/draft_orders.json"
    synced = 0

    while True:
        response, headers = await client.get(url, params=params)

        for d in response.get("draft_orders", []):
            draft = db.query(DraftOrder).filter(
                DraftOrder.shopify_draft_order_id == d["id"]
            ).first()

            if not draft:
                draft = DraftOrder(
                    shop_id=shop.id,
                    shopify_draft_order_id=d["id"]
                )

            draft.customer_id = d.get("customer", {}).get("id")
            draft.total_price = d.get("total_price")
            draft.status = d.get("status")
            draft.line_items = d.get("line_items")
            draft.raw_data = d

            db.add(draft)
            synced += 1

        db.commit()

        link = headers.get("Link")
        match = re.search(r'page_info=([^&>]+)', link or "")
        if not match:
            break
        params = {"page_info": match.group(1)}

    print(f"✅ Synced {synced} draft orders")


def hydrate_customer_from_order(db: Session, order: Order, o: dict):
    customer = o.get("customer") or {}
    shipping = o.get("shipping_address") or {}
    billing = o.get("billing_address") or {}

    order.customer_email = (
        customer.get("email")
        or o.get("email")
        or shipping.get("email")
        or billing.get("email")
    )

    first = shipping.get("first_name") or billing.get("first_name")
    last = shipping.get("last_name") or billing.get("last_name")

    order.customer_name = (
        f"{first} {last}".strip()
        if first or last
        else "Guest Customer"
    )

    shopify_customer_id = customer.get("id")
    if not shopify_customer_id:
        return

    customer_row = db.query(Customer).filter(
        Customer.shop_id == order.shop_id,
        Customer.shopify_customer_id == shopify_customer_id
    ).first()

    if customer_row:
        order.customer_id = customer_row.id
        
        # Backfill email
        if not customer_row.email:
            customer_row.email = (
                o.get("email")
                or o.get("customer", {}).get("email")
            )

        addr = o.get("shipping_address") or {}
        if not customer_row.first_name:
            customer_row.first_name = addr.get("first_name")
        if not customer_row.last_name:
            customer_row.last_name = addr.get("last_name")

        customer_row.display_name = (
            f"{customer_row.first_name or ''} {customer_row.last_name or ''}".strip()
            or customer_row.email
            or "Guest Customer"
        )

