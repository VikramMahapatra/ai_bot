import re
import httpx
from requests import Session
from app.helpers.sync_state_helper import get_last_sync, update_last_sync
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient
from app.models.payout import Payout

async def sync_payouts(db: Session, shop: Shop, client : ShopifyClient):
    url = "/shopify_payments/payouts.json"
    
    last_sync = get_last_sync(db, shop.id, "payouts")
    params = {"limit": 250}
    if last_sync:
        params["updated_at_min"] = last_sync.isoformat()

    synced_count = 0

    while True:
        try:
            response, headers = await client.get(url, params=params)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                print(f"Payouts endpoint not found for shop {shop.shop_domain}. Skipping payouts.")
                return
            elif e.response.status_code == 403:
                print(f"403 Forbidden — check token scopes for Shopify Payments on {shop.shop_domain}")
                return
            else:
                raise

        for p in response.get("payouts", []):
            payout = db.query(Payout).filter(Payout.shopify_payout_id == p["id"]).first()
            if not payout:
                payout = Payout(shop_id=shop.id, shopify_payout_id=p["id"])

            payout.status = p.get("status")
            payout.currency = p.get("currency")
            payout.amount = p.get("amount")
            payout.fee = p.get("summary", {}).get("fees")
            payout.net_amount = p.get("summary", {}).get("net")
            payout.payout_date = p.get("date")
            payout.raw_data = p

            db.add(payout)
            synced_count += 1

        db.commit()
        #Check for pagination
        link = headers.get("Link")
        match = re.search(r'page_info=([^&>]+)', link or "")
        if not match:
            break

        params = {"page_info": match.group(1)}
        
    update_last_sync(db, shop.id, "payouts")
    print(f"Synced {synced_count} payouts for shop {shop.shop_domain}")
    