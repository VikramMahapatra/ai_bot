import csv
from io import StringIO
import os
from sqlalchemy import func
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
import json 


# ---------------------------------------
# Build AI context (important)
# ---------------------------------------

def export_ai_knowledge_dataset(db: Session):

    file_path = get_timestamped_filename("ai_knowledge")

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "knowledge_type",
            "entity_id",
            "shop_id",
            "context_text",
            "metadata_json"
        ])

        # ======================
        # CUSTOMER KNOWLEDGE
        # ======================

        customers = (
            db.query(
                Customer,
                func.count(Order.id).label("order_count"),
                func.sum(Order.total_price).label("total_spend")
            )
            .outerjoin(Order, Order.customer_id == Customer.id)
            .group_by(Customer.id)
            .all()
        )

        for c, order_count, total_spend in customers:

            name = (
                c.display_name
                or f"{c.first_name or ''} {c.last_name or ''}".strip()
            )

            text = (
                f"Customer {name} with email {c.email}. "
                f"Total orders {order_count or 0}. "
                f"Lifetime spend {float(total_spend or 0)}."
            )

            metadata = {"type": "customer"}

            writer.writerow([
                "customer",
                c.id,
                c.shop_id,
                text,
                json.dumps(metadata)
            ])

        # ======================
        # ORDER + SHIPPING
        # ======================

        data = (
            db.query(Order, Fulfillment)
            .outerjoin(Fulfillment, Fulfillment.order_id == Order.id)
            .all()
        )

        for o, f_item in data:

            text = (
                f"Order {o.order_number} is {o.financial_status}. "
                f"Fulfillment status {o.fulfillment_status}. "
                f"Total price {o.total_price} {o.currency}."
            )

            if f_item:
                text += (
                    f" Tracking number {f_item.tracking_number} "
                    f"via {f_item.tracking_company}."
                )

            writer.writerow([
                "order",
                o.id,
                o.shop_id,
                text,
                json.dumps({"type": "order"})
            ])

        # ======================
        # INVENTORY KNOWLEDGE
        # ======================

        inventory = (
            db.query(Product, InventoryLevel)
            .join(
                InventoryLevel,
                InventoryLevel.shop_id == Product.shop_id
            )
            .all()
        )

        for p, inv in inventory:

            text = (
                f"Product {p.title} has available stock "
                f"{inv.available} units."
            )

            writer.writerow([
                "inventory",
                inv.id,
                p.shop_id,
                text,
                json.dumps({"type": "inventory"})
            ])

        # ======================
        # LEGAL POLICIES
        # ======================

        policies = db.query(LegalPolicy).all()

        for policy in policies:

            text = f"{policy.policy_type}: {policy.title}. {policy.body}"

            writer.writerow([
                "legal_policy",
                policy.id,
                policy.shop_id,
                text,
                json.dumps({"type": "policy"})
            ])

    return file_path


def export_customers_csv(db: Session):

    file_path = get_timestamped_filename("customers_ai")

    data = (
        db.query(
            Customer,
            func.count(Order.id).label("order_count"),
            func.sum(Order.total_price).label("lifetime_value"),
            func.max(Order.order_date).label("last_order_date")
        )
        .outerjoin(Order, Order.customer_id == Customer.id)
        .group_by(Customer.id)
        .all()
    )

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "shop_id",
            "customer_id",
            "customer_name",
            "customer_email",
            "customer_segment",
            "lifetime_orders",
            "lifetime_value",
            "last_order_date",
            "customer_status",
            "ai_summary",
            "sample_questions"
        ])

        for customer, order_count, lifetime_value, last_order in data:

            name = (
                customer.display_name
                or f"{customer.first_name or ''} {customer.last_name or ''}".strip()
            )

            order_count = order_count or 0
            lifetime_value = float(lifetime_value or 0)

            # ---------- AI segmentation logic ----------
            if order_count >= 10:
                segment = "VIP"
            elif order_count >= 2:
                segment = "returning"
            else:
                segment = "new"

            status = "active" if order_count > 0 else "no_orders"

            # ---------- AI semantic summary ----------
            ai_summary = (
                f"{segment} customer with {order_count} orders "
                f"and lifetime value {lifetime_value}"
            )

            # ---------- training prompts ----------
            sample_questions = (
                "show my orders | last order | payment status | where is my order"
            )

            writer.writerow([
                customer.shop_id,
                customer.id,
                name,
                customer.email,
                segment,
                order_count,
                lifetime_value,
                last_order,
                status,
                ai_summary,
                sample_questions
            ])

    return file_path


def export_orders_csv(db: Session):

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
            "customer_id",
            "customer_name",
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
                getattr(customer, "id", None),
                getattr(customer, "display_name", None),
                getattr(customer, "email", None),
                fulfillment.shopify_fulfillment_id,
                fulfillment.tracking_number,
                fulfillment.tracking_company,
                fulfillment.status,
                fulfillment.shipped_at
            ])

    return file_path

def export_refunds_csv(db: Session):

    file_path = get_timestamped_filename("refunds")

    # -----------------------------------
    # Fetch refunds with order + customer
    # -----------------------------------
    refunds = (
        db.query(Refund, Order, Customer)
        .outerjoin(Order, Order.id == Refund.order_id)
        .outerjoin(Customer, Customer.id == Order.customer_id)
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
            "customer_id",
            "customer_name",
            "customer_email",
            "refund_status",
            "refund_amount",
            "refund_reason",
            "refund_date"
        ])

        for refund, order, customer in refunds:

            raw = refund.raw_data or {}

            # Shopify refund status (may not exist)
            refund_status = raw.get("status")

            # extract reason safely
            refund_reason = None
            refund_items = raw.get("refund_line_items")

            if refund_items and isinstance(refund_items, list):
                refund_reason = refund_items[0].get("reason")

            writer.writerow([
                refund.order_id,
                refund.shopify_refund_id,
                getattr(customer, "id", None),
                getattr(customer, "display_name", None),
                getattr(customer, "email", None),
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
            "customer_id",
            "customer_name",
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
                getattr(customer, "id", None),
                getattr(customer, "display_name", None),
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
                p.shopify_updated_at   
            ])

    return file_path

def export_shipping_csv(db: Session):

    file_path = get_timestamped_filename("shipping")

    data = (
        db.query(Order, Fulfillment, ShippingZone, Customer)
        .join(Fulfillment, Fulfillment.order_id == Order.id)
        .outerjoin(
            ShippingZone,
            ShippingZone.shop_id == Order.shop_id   # assuming order has shop_id
        )
        .outerjoin(Customer, Customer.id == Order.customer_id)
        .all()
    )

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "shop_id",
            "order_id",
            "order_number",
            "customer_id",
            "customer_name",
            "customer_email",
            "shipping_zone",
            "tracking_number",
            "carrier",
            "status",
            "shipped_at"
        ])

        for o, f_item, zone, customer in data:

            writer.writerow([
                o.shop_id,
                o.id,
                o.order_number,
                getattr(customer, "id", None),
                getattr(customer, "display_name", None),
                getattr(customer, "email", None),
                getattr(zone, "name", None),
                f_item.tracking_number,
                f_item.tracking_company,
                f_item.status,
                f_item.shipped_at
            ])

    return file_path

