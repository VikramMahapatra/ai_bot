import csv
from io import StringIO
import os
from sqlalchemy.orm import Session
from app.helpers.file_helper import get_timestamped_filename
from app.models.customer import Customer
from app.models.fulfillment import Fulfillment
from app.models.inventory_level import InventoryLevel
from app.models.legal_policy import LegalPolicy
from app.models.location import Location
from app.models.order import Order
from app.models.product import Product
from app.models.refund import Refund
from app.models.shipping_zone import ShippingZone
from app.models.transaction import OrderTransaction

EXPORT_DIR = "exports"


def ensure_dir():
    os.makedirs(EXPORT_DIR, exist_ok=True)



# ---------------------------------------
# Build AI context (important)
# ---------------------------------------

def build_customer_ai_context(customer, orders, fulfillments, refunds):

    context = []

    context.append(f"Customer {customer.name} ({customer.email})")

    if orders:
        context.append("\nOrders:")

        for o in orders:
            context.append(
                f"Order #{o.order_number} - "
                f"{o.financial_status} - "
                f"{o.fulfillment_status} - "
                f"${o.total_price}"
            )

        # last order
        last_order = sorted(orders, key=lambda x: x.order_date)[-1]

        context.append("\nLast Order:")
        context.append(f"Order #{last_order.order_number}")

        f = next((x for x in fulfillments if x.order_id == last_order.id), None)

        if f:
            context.append(f"Tracking: {f.tracking_number}")
            context.append(f"Carrier: {f.tracking_company}")
        else:
            context.append("Tracking: Not available")

    if refunds:
        context.append("\nRefunds:")
        for r in refunds:
            context.append(f"Refund ${r.amount} - {r.status}")

    return "\n".join(context)

# ---------------------------------------
# MAIN EXPORT FUNCTION
# ---------------------------------------

def create_advanced_chatbot_csv(db):

    output = StringIO()
    writer = csv.writer(output)

    # header
    writer.writerow([
        "customer_id",
        "customer_name",
        "email",
        "ai_context"
    ])

    customers = db.query(Customer).all()
    orders = db.query(Order).all()
    fulfillments = db.query(Fulfillment).all()
    refunds = db.query(Refund).all()

    for c in customers:

        customer_orders = [o for o in orders if o.customer_id == c.id]
        customer_refunds = [r for r in refunds if r.customer_id == c.id]

        ai_context = build_customer_ai_context(
            c,
            customer_orders,
            fulfillments,
            customer_refunds
        )

        writer.writerow([
            str(c.id),
            c.name,
            c.email,
            ai_context
        ])

    output.seek(0)

    return output

def export_orders_csv(db: Session):

    ensure_dir()

    file_path = get_timestamped_filename("orders")

    # -----------------------------------
    # Fetch orders with customers
    # -----------------------------------
    orders = (
        db.query(Order, Customer)
        .outerjoin(Customer, Customer.id == Order.customer_id)
        .order_by(Order.customer_id, Order.order_date.desc())
        .all()
    )

    # -----------------------------------
    # Determine last order per customer
    # -----------------------------------
    last_order_map = {}

    for order, _ in orders:
        if order.customer_id and order.customer_id not in last_order_map:
            last_order_map[order.customer_id] = order.id

    # -----------------------------------
    # Write CSV
    # -----------------------------------
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        writer.writerow([
            "shop_id",
            "customer_id",
            "customer_name",
            "customer_email",
            "order_id",
            "order_number",
            "order_date",
            "financial_status",
            "fulfillment_status",
            "total_price",
            "currency",
            "last_order_flag"
        ])

        for order, customer in orders:

            customer_name = None

            if customer:
                # fallback name logic
                if getattr(customer, "first_name", None) or getattr(customer, "last_name", None):
                    customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
                else:
                    customer_name = getattr(customer, "name", None)

            last_flag = 1 if last_order_map.get(order.customer_id) == order.id else 0

            writer.writerow([
                order.shop_id,
                order.customer_id,
                customer_name,
                getattr(customer, "email", None),
                order.id,
                order.order_number,
                order.order_date,
                order.financial_status,
                order.fulfillment_status,
                order.total_price,
                order.currency,
                last_flag
            ])

    return file_path

def export_fulfillments_csv(db: Session):

    file_path = get_timestamped_filename("fulfillments")

    fulfillments = (
        db.query(Fulfillment, Order, Customer)
        .join(Order, Order.id == Fulfillment.order_id)
        .outerjoin(Customer, Customer.id == Order.customer_id)
        .all()
    )

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "order_id",
            "order_number",
            "customer_email",
            "fulfillment_id",
            "tracking_number",
            "tracking_company",
            "status",
            "shipped_at"
        ])

        for fulfillment, order, customer in fulfillments:

            writer.writerow([
                order.id,
                order.order_number,
                getattr(customer, "email", None),
                fulfillment.shopify_fulfillment_id,
                fulfillment.tracking_number,
                fulfillment.tracking_company,
                fulfillment.status,
                fulfillment.shipped_at
            ])

    return file_path

def export_refunds_csv(db: Session):

    ensure_dir()

    file_path = get_timestamped_filename("refunds")

    # -----------------------------------
    # Fetch refunds with order reference
    # -----------------------------------
    refunds = (
        db.query(Refund, Order)
        .outerjoin(Order, Order.id == Refund.order_id)
        .all()
    )

    # -----------------------------------
    # Write CSV
    # -----------------------------------
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        writer.writerow([
            "order_id",
            "refund_id",
            "refund_status",
            "refund_amount",
            "refund_reason",
            "refund_date"
        ])

        for refund, order in refunds:

            raw = refund.raw_data or {}

            # Shopify refunds don't always include explicit status,
            # but you can infer from transactions if needed
            refund_status = raw.get("status")

            # refund reason may be inside refund_line_items
            refund_reason = None
            if raw.get("refund_line_items"):
                refund_reason = raw["refund_line_items"][0].get("reason")

            writer.writerow([
                refund.order_id,
                refund.shopify_refund_id,
                refund_status,
                refund.total_amount,
                refund_reason,
                refund.created_at
            ])

    return file_path

def export_products_csv(db: Session):

    file_path = get_timestamped_filename("products")

    products = db.query(Product).all()

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        # -----------------------------------
        # CSV Header (AI-friendly structure)
        # -----------------------------------
        writer.writerow([
            "shop_id",
            "product_id",
            "shopify_product_id",
            "title",
            "vendor",
            "product_type",
            "variant_id",
            "inventory_item_id",
            "price",
            "inventory_qty"
        ])

        for product in products:

            variants = product.variants or []

            # Shopify inventory is per VARIANT
            for v in variants:

                inventory_item_id = v.get("inventory_item_id")
                variant_id = v.get("id")
                price = v.get("price")

                # Fetch inventory level via inventory_item_id
                inventory = (
                    db.query(InventoryLevel)
                    .filter(
                        InventoryLevel.inventory_item_id == inventory_item_id,
                        InventoryLevel.shop_id == product.shop_id
                    )
                    .first()
                )

                inventory_qty = inventory.available if inventory else 0

                writer.writerow([
                    product.shop_id,
                    product.id,
                    product.shopify_product_id,
                    product.title,
                    product.vendor,
                    product.product_type,
                    variant_id,
                    inventory_item_id,
                    price,
                    inventory_qty
                ])

    return file_path

def export_inventory_csv(db: Session):

    file_path = get_timestamped_filename("inventory")

    products = db.query(Product).all()

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "product_id",
            "product_title",
            "inventory_item_id",
            "location_id",
            "available_quantity",
            "updated_at"
        ])

        for product in products:

            variants = product.variants or []

            for v in variants:

                inventory_item_id = v.get("inventory_item_id")

                if not inventory_item_id:
                    continue

                inventory_levels = (
                    db.query(InventoryLevel)
                    .filter(InventoryLevel.inventory_item_id == inventory_item_id)
                    .all()
                )

                for inv in inventory_levels:

                    writer.writerow([
                        product.id,
                        product.title,
                        inventory_item_id,
                        inv.location_id,
                        inv.available,
                        inv.updated_at
                    ])

    return file_path

def export_transactions_csv(db: Session):

    file_path = get_timestamped_filename("transactions")

    transactions = (
        db.query(OrderTransaction, Order, Customer)
        .join(Order, Order.id == OrderTransaction.order_id)
        .outerjoin(Customer, Customer.id == Order.customer_id)
        .all()
    )

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "order_id",
            "order_number",
            "customer_email",
            "transaction_id",
            "gateway",
            "kind",
            "status",
            "amount",
            "currency",
            "processed_at"
        ])

        for t, order, customer in transactions:

            currency = None
            if t.raw_data:
                currency = t.raw_data.get("currency")

            writer.writerow([
                order.id,
                order.order_number,
                getattr(customer, "email", None),
                t.shopify_transaction_id,
                t.gateway,
                t.kind,
                t.status,
                t.amount,
                currency,
                t.processed_at
            ])

    return file_path

def export_locations_csv(db: Session):

    file_path = get_timestamped_filename("locations")

    locations = db.query(Location).all()

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "location_id",
            "name",
            "address1",
            "city",
            "country",
            "active"
        ])

        for l in locations:
            writer.writerow([
                l.id,
                l.name,
                l.address1,
                l.city,
                l.country,
                l.active
            ])

    return file_path

def export_legal_policies_csv(db: Session):

    file_path = get_timestamped_filename("legal_policies")

    policies = db.query(LegalPolicy).all()

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "policy_type",
            "title",
            "body",
            "updated_at"
        ])

        for p in policies:
            writer.writerow([
                p.policy_type,
                p.title,
                p.body,
                p.updated_at
            ])

    return file_path

def export_shipping_csv(db: Session):

    file_path = get_timestamped_filename("shipping")

    data = (
        db.query(Order, Fulfillment, ShippingZone)
        .join(Fulfillment, Fulfillment.order_id == Order.id)
        .outerjoin(
            ShippingZone,
            ShippingZone.shop_id == Order.shop_id   # assuming order has shop_id
        )
        .all()
    )

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "shop_id",
            "order_id",
            "order_number",
            "shipping_zone",
            "tracking_number",
            "carrier",
            "status",
            "shipped_at"
        ])

        for o, f_item, zone in data:

            writer.writerow([
                o.shop_id,
                o.id,
                o.order_number,
                getattr(zone, "name", None),
                f_item.tracking_number,
                f_item.tracking_company,
                f_item.status,
                f_item.shipped_at
            ])

    return file_path

