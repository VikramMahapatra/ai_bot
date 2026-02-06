import re
import httpx
from requests import Session
from app.helpers.sync_state_helper import get_last_sync, update_last_sync
from app.models.customer import Customer
from app.models.product import Product
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient



async def sync_customers(db: Session, shop: Shop, client : ShopifyClient):

    last_sync = get_last_sync(db, shop.id, "customers")
    params = {"limit": 250}
    if last_sync:
        params["updated_at_min"] = last_sync.isoformat()

    url = "/customers.json"
    synced = 0

    while True:
        response, headers = await client.get(url, params=params)

        for c in response.get("customers", []):
            customer = db.query(Customer).filter(
                Customer.shopify_customer_id == c["id"],
                Customer.shop_id == shop.id
            ).first()

            if not customer:
                customer = Customer(
                    shop_id=shop.id,
                    shopify_customer_id=c["id"]
                )

            customer.email = c.get("email")
            customer.first_name = c.get("first_name")
            customer.last_name = c.get("last_name")
            customer.phone = c.get("phone")
            customer.default_address = c.get("default_address")
            customer.raw_data = c

            db.add(customer)
            synced += 1

        db.commit()

        link = headers.get("Link")
        match = re.search(r'page_info=([^&>]+)', link or "")
        if not match:
            break
        params = {"page_info": match.group(1)}

    update_last_sync(db, shop.id, "customers")
    print(f"✅ Synced {synced} customers")
