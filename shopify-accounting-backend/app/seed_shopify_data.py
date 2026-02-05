import asyncio

import httpx
from app.db.config import SHOPIFY_ADMIN_TOKEN
from app.services.shopify_client import ShopifyClient

SHOP_DOMAIN = "zentrixel-it-services.myshopify.com"  # replace with your store

async def create_products(client):
    products = []
    for i in range(1, 6):
        title = f"Test Product {i}"
        existing_products = await client.get("/products.json", params={"title": title})
        if existing_products.get("products"):
            print(f"Product '{title}' already exists, skipping creation.")
            products.append(existing_products["products"][0])
            continue

        payload = {
            "product": {
                "title": title,
                "body_html": "<strong>Awesome product</strong>",
                "vendor": "My Vendor",
                "product_type": "Gadget"
            }
        }

        try:
            response = await client.post("/products.json", payload)
            product_data = response.get("product")
            if product_data:
                products.append(product_data)
                print(f"Created product: {product_data.get('title')}")
        except httpx.HTTPStatusError as e:
            print(f"Failed to create product {title}: {e.response.json()}")

    return products

async def create_customers(client):
    customers = []
    for i in range(1, 6):
        email = f"test{i}@example.com"
        existing = await client.get("/customers.json", params={"email": email})
        if existing.get("customers"):
            print(f"Customer {email} already exists, skipping creation.")
            customers.append(existing["customers"][0])
            continue

        payload = {
            "customer": {
                "first_name": f"Test{i}",
                "last_name": f"User{i}",
                "email": email,
                "verified_email": True,
                "send_email_invite": False
            }
        }

        try:
            response = await client.post("/customers.json", payload)
            customer_data = response.get("customer")
            if customer_data:
                customers.append(customer_data)
                print(f"Created customer: {customer_data.get('email')}")
        except httpx.HTTPStatusError as e:
            print(f"Failed to create customer {email}: {e.response.json()}")

    return customers


async def create_draft_orders(client, products, customers):
    if not products or not customers:
        print("No products or customers available. Skipping draft orders.")
        return

    for i in range(len(products)):
        product = products[i % len(products)]
        customer = customers[i % len(customers)]

        payload = {
            "draft_order": {
                "line_items": [
                    {
                        "variant_id": product["variants"][0]["id"],
                        "quantity": 1
                    }
                ],
                "customer": {"id": customer.get("id")}
            }
        }

        try:
            response = await client.post("/draft_orders.json", payload)
            draft_order = response.get("draft_order")

            cust_email = customer.get("email", "Unknown")  # safe access
            if draft_order:
                print(f"Created draft order: {draft_order.get('id')} for customer {cust_email}")
        except httpx.HTTPStatusError as e:
            print(f"Failed to create draft order for customer {customer.get('email', 'Unknown')}: {e.response.json()}")


async def main():
    client = ShopifyClient(SHOP_DOMAIN, SHOPIFY_ADMIN_TOKEN)
    
    products = await create_products(client)
    customers = await create_customers(client)
    await create_draft_orders(client, products, customers)
    print("✅ Shopify dev store seeded successfully!")

if __name__ == "__main__":
    asyncio.run(main())
