from fastapi import Depends
from app.db.session import SessionLocal, get_db
from app.models.shop import Shop
from app.models.order import Order
from app.services.shopify_client import ShopifyClient
from app.sync.customers import sync_customers
from app.sync.fulfillments import sync_fulfillments
from app.sync.inventory_levels import sync_inventory_levels
from app.sync.legal_policies import sync_legal_policies
from app.sync.locations import sync_locations
from app.sync.orders import sync_draft_orders, sync_orders
from app.sync.pages import sync_pages
from app.sync.products import sync_products
from app.sync.shipping_zones import sync_shipping_zones
from app.sync.transactions import sync_transactions
from app.sync.payouts import sync_payouts

async def run_full_sync(shop_id: int, db = Depends(get_db)):
    
    shop = db.query(Shop).get(shop_id)
    if not shop:
        print(f"Shop with ID {shop_id} not found")
        db.close()
        return
    
    client = ShopifyClient(shop.shop_domain, shop.access_token)

    print(f"Starting full sync for shop {shop.shop_domain}")
    
    # --------------------------
    # Sync Locations
    # --------------------------
    await sync_locations(db, shop, client)

    # --------------------------
    # Sync Products
    # --------------------------
    await sync_products(db, shop, client)
    
    # --------------------------
    # Sync Inventory
    # --------------------------
    await sync_inventory_levels(db, shop, client)

    # --------------------------
    # Sync Customers
    # --------------------------
    await sync_customers(db, shop, client)

    # --------------------------
    # Sync Orders
    # --------------------------
    await sync_orders(db, shop, client)

    # --------------------------
    # Sync Transactions for Orders
    # --------------------------
    orders = db.query(Order).filter(Order.shop_id == shop.id).all()
    for order in orders:
        await sync_transactions(db, shop, order, client)
        
        await sync_fulfillments(db, shop, order, client)
        
    # --------------------------
    # Sync Draft Orders
    # --------------------------
    await sync_draft_orders(db, shop, client)
    
    # --------------------------
    # Sync Shipping
    # --------------------------
    await sync_shipping_zones(db, shop, client)
    
    # --------------------------
    # Sync Payouts
    # --------------------------
    await sync_payouts(db, shop, client)
    
        # --------------------------
    # Sync Policies
    # --------------------------
    await sync_legal_policies(db, shop, client)
    
    # --------------------------
    # Sync Pages
    # --------------------------
    await sync_pages(db, shop, client)

    db.close()
    print(f"Completed full sync for shop {shop.shop_domain}")
