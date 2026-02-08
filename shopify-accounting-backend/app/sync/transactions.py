import re
import httpx
from requests import Session
from app.helpers.sync_state_helper import get_last_sync, update_last_sync
from app.models.order import Order
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient
from app.models.transaction import OrderTransaction

async def sync_transactions(db: Session, shop: Shop, order: Order, client : ShopifyClient):
    url = f"/orders/{order.shopify_order_id}/transactions.json"
    
    last_sync = get_last_sync(db, shop.id, "transactions")  # datetime | None
    params = {"limit": 250}
    if last_sync:
        params["updated_at_min"] = last_sync.isoformat()
        
    synced_count = 0

    while True:
        try:
            response, headers = await client.get(url, params=params)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                print(f"403 Forbidden — cannot fetch transactions for order {order.shopify_order_id}")
                return
            else:
                raise

        for t in response.get("transactions", []):
            exists = db.query(OrderTransaction).filter(OrderTransaction.shopify_transaction_id == t["id"]).first()
            if exists:
                continue

            db.add(OrderTransaction(
                order_id=order.id,
                shopify_transaction_id=t["id"],
                gateway=t.get("gateway"),
                kind=t.get("kind"),
                status=t.get("status"),
                amount=t.get("amount"),
                processed_at=t.get("processed_at"),
                raw_data=t
            ))
            synced_count += 1

        db.commit()
        
        #Check for pagination
        # ---- Pagination ----
        link = headers.get("Link")
        match = re.search(r'page_info=([^&>]+)', link or "")
        if not match:
            break

        params = {"page_info": match.group(1)}  # ⚠️ ONLY page_info
        
    update_last_sync(db, shop.id, "transactions")
    print(f"Added {synced_count} transactions for order {order.shopify_order_id}")