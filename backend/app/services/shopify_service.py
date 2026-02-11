from typing import Optional
from requests import Session
from app.utils.shopify_client import ShopifyClient
from app.models.user import Organization

async def get_shop(db: Session,  shop_domain: str) -> Optional[Organization]:
    # Assuming single shop, can extend to multi-shop later
    shop = db.query(Organization).filter(
        Organization.org_domain == shop_domain
    ).first()
    
    if not shop:
        # Either return False or raise an HTTPException/log error
        print(f"Shop not found for domain: {shop_domain}")
        return False
    
    return shop

async def verify_shopify_customer(db: Session, shop_domain: str, customer_id: int) -> bool:
    shop = await get_shop(db, shop_domain)
    if not shop:
        return None

    client = ShopifyClient(shop.org_domain, shop.access_token)
    response, _ = await client.get(f"/customers/{customer_id}.json")
    
    # Instead of response.status_code, check the dict
    return "customer" in response  # True if customer exists


# Get recent orders
async def get_recent_orders(db: Session, shop_domain: str, customer_id: int, limit: int = 5):
    shop = await get_shop(db, shop_domain)
    if not shop:
        return []

    client = ShopifyClient(shop.org_domain, shop.access_token)
    response, _ = await client.get(f"/orders.json?customer_id={customer_id}&status=any&limit={limit}")

    orders = response.get("orders", [])
    return [
        {
            "order_number": o["order_number"],
            "status": o["financial_status"],
            "total": o["total_price"],
            "created_at": o["created_at"]
        }
        for o in orders
    ]

async def get_order_by_number(db: Session, shop_domain: str, order_number: str):
    shop = await get_shop(db, shop_domain)
    if not shop:
        return None

    client = ShopifyClient(shop.org_domain, shop.access_token)
    response, _ = await client.get(f"/orders.json?name=#{order_number}")
    orders = response.get("orders", [])
    return orders[0] if orders else None

async def get_order_status(db: Session, shop_domain: str, customer_id: int, order_number: str):
    shop = await get_shop(db, shop_domain)
    if not shop:
        return None

    client = ShopifyClient(shop.org_domain, shop.access_token)
    order = await get_order_by_number(db, shop_domain, order_number)
    if order:
        order_id = order["id"]
        response, _ = await client.get(f"/orders/{order_id}.json")
        order = response.get("order")
        
    if order and str(order["customer"]["id"]) == str(customer_id):
        return {
            "status": order["financial_status"],
            "fulfillment_status": order.get("fulfillment_status"),
            "total": order["total_price"]
        }
    return None

async def get_customer_info(db: Session, shop_domain: str, customer_id: str):
    shop = await get_shop(db, shop_domain)
    if not shop:
        return None

    client = ShopifyClient(shop.org_domain, shop.access_token)
    response, _ = await client.get(f"/customers/{customer_id}.json")

    return response.get("customer")

async def get_refunds(db: Session, shop_domain: str, customer_id: str):
    shop = await get_shop(db, shop_domain)
    if not shop:
        return []

    client = ShopifyClient(shop.org_domain, shop.access_token)

    response, _ = await client.get(
        f"/orders.json?customer_id={customer_id}&status=any"
    )

    orders = response.get("orders", [])

    refunded_orders = [
        {
            "order_number": o["order_number"],
            "total_refunded": sum(
                float(refund["transactions"][0]["amount"])
                for refund in o.get("refunds", [])
                if refund.get("transactions")
            )
        }
        for o in orders
        if o.get("refunds")  # only refunded orders
    ]

    return refunded_orders


async def get_shipping_status(db: Session, shop_domain: str, customer_id: str, order_number: str):
    shop = await get_shop(db, shop_domain)
    if not shop:
        return None

    client = ShopifyClient(shop.org_domain, shop.access_token)
    
    fulfillments = None
    order = await get_order_by_number(db, shop_domain, order_number)
    if order:
        order_id = order["id"]
    
        response, _ = await client.get(f"/orders/{order_id}/fulfillments.json")

        fulfillments = response.get("fulfillments", [])
    if fulfillments:
        latest = fulfillments[-1]
        return {
            "tracking_number": latest.get("tracking_number"),
            "tracking_url": latest.get("tracking_url"),
            "status": latest.get("status")
        }
    return None

async def get_recommended_products(db: Session, shop_domain: str, customer_id: str):
    shop = await get_shop(db, shop_domain)
    if not shop:
        return []

    client = ShopifyClient(shop.org_domain, shop.access_token)
    response, _ = await client.get(f"/products.json?limit=5")

    products = response.get("products", [])
    return [{"title": p["title"], "price": p["variants"][0]["price"]} for p in products]

async def get_abandoned_checkouts(db: Session, shop_domain: str, customer_id: str):
    shop = await get_shop(db, shop_domain)
    if not shop:
        return []

    client = ShopifyClient(shop.org_domain, shop.access_token)
    response, _ = await client.get(f"/checkouts.json?customer_id={customer_id}")
    checkouts = response.get("checkouts", [])
    return [
        {
            "checkout_token": c["token"],
            "total_price": c["total_price"],
            "line_items": [{"title": li["title"], "quantity": li["quantity"]} for li in c["line_items"]],
        }
        for c in checkouts
    ]


# ------------------------------
# Intent Handler
# ------------------------------

async def handle_shopify_intent(db: Session, shop_domain: str, customer_id: str, user_message: str):
    """
    Map a user message to a Shopify backend method.
    This can be replaced with NLP / keyword matching for better intent detection.
    """

    msg_lower = user_message.lower()

    if "recent order" in msg_lower or "last order" in msg_lower:
        orders = await get_recent_orders(db, shop_domain, customer_id)
        if orders:
            return f"Here are your last {len(orders)} orders:\n" + "\n".join(
                [f"#{o['order_number']} - {o['status']} - ${o['total']}" for o in orders]
            )
        return "You have no recent orders."

    elif "order status" in msg_lower or "track order" in msg_lower:
        # naive extraction of order number
        import re
        match = re.search(r"#?(\d+)", user_message)
        order_number = match.group(1) if match else None
        if not order_number:
            return "Please provide your order number."

        status = await get_order_status( db=db, shop_domain=shop_domain, customer_id=customer_id, order_number=order_number)
        if status:
            return f"Order #{order_number} is {status['status']} (Fulfillment: {status['fulfillment_status']})"
        return f"Order #{order_number} not found."

    elif "refund" in msg_lower:
        refunds = await get_refunds(db=db, shop_domain=shop_domain, customer_id=customer_id)
        if refunds:
            return "You have the following refunded orders:\n" + "\n".join(
                [f"#{r['order_number']} - ${r['total_refunded']}" for r in refunds]
            )
        return "No refunds found."

    elif "account" in msg_lower or "info" in msg_lower:
        customer = await get_customer_info(
            db=db,
            shop_domain=shop_domain,
            customer_id=customer_id
        )

        print("Customer info:", customer)

        if not customer:
            return "Could not fetch account info."

        # Non-PII safe fields
        orders_count = customer.get("orders_count", "N/A")
        state = customer.get("state", "N/A")
        verified_email = customer.get("verified_email", "N/A")

        # Handle restricted fields safely
        first_name = customer.get("first_name")
        last_name = customer.get("last_name")
        email = customer.get("email")

        name_text = (
            f"{first_name} {last_name}"
            if first_name or last_name
            else "Name is restricted due to Shopify privacy settings"
        )

        email_text = (
            email
            if email
            else "Email is restricted due to Shopify privacy settings"
        )

        return (
            f"Account info:\n"
            f"Name: {name_text}\n"
            f"Email: {email_text}\n"
            f"Orders placed: {orders_count}\n"
            f"Account state: {state}\n"
            f"Email verified: {verified_email}"
        )

    elif "cart" in msg_lower:
        cart = await get_abandoned_checkouts(db=db, shop_domain=shop_domain, customer_id=customer_id)
        if cart:
            total_items = sum(sum(item["quantity"] for item in c["line_items"]) for c in cart)
            return f"You have {total_items} item(s) in your cart."
        return "Your cart is empty."
    
    elif "product" in msg_lower or "recommended" in msg_lower:
        products = await get_recommended_products(db=db, shop_domain=shop_domain, customer_id=customer_id)
        if products:
            total_items = len(products)
            return f"You have {total_items} recommended product(s)."
        return "No recommended products found."


    elif "shipping" in msg_lower or "track shipment" in msg_lower:
        # naive extraction
        import re
        match = re.search(r"#?(\d+)", user_message)
        order_number = match.group(1) if match else None
        if not order_number:
            return "Please provide your order number to track shipping."
        shipping = await get_shipping_status(db=db, shop_domain=shop_domain, customer_id=customer_id, order_number=order_number)
        if shipping:
            return f"Your shipment tracking number is {shipping['tracking_number']}. Status: {shipping['status']}"
        return f"No shipment info found for order #{order_number}."

    else:
        # fallback
        return "I can help you with orders, refunds, shipping, cart, and account info. Please ask accordingly."
