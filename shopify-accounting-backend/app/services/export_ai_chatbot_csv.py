import csv
from datetime import timezone
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
from app.models.order_line_item import OrderLineItem
from app.models.product import Product
from app.models.refund import Refund
from app.models.refund_line_item import RefundLineItem
from app.models.shipping_zone import ShippingZone
from app.models.transaction import OrderTransaction
import json 
from datetime import datetime


# ======================================
# SAFE DATETIME
# ======================================

def safe_datetime(dt):

    if not dt:
        return None

    if isinstance(dt, datetime):
        return dt.isoformat()

    return str(dt)


# ======================================
# MAIN EXPORT
# ======================================

def export_ai_unified_dataset(db: Session):
    import csv

    file_path = get_timestamped_filename("ai_commerce_dataset")
    rows = []

    # Fetch all orders
    orders = db.query(Order).all()

    for order in orders:
        # Skip if no valid customer
        if not order.customer_id:
            continue

        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if not customer or customer.display_name == "Guest Customer":
            continue

        # Fetch related data
        line_items = db.query(OrderLineItem).filter(OrderLineItem.order_id == order.id).all()
        fulfillments = db.query(Fulfillment).filter(Fulfillment.order_id == order.id).all()
        refunds = db.query(Refund).filter(Refund.order_id == order.id).all()
        transactions = db.query(OrderTransaction).filter(OrderTransaction.order_id == order.id).all()

        # -----------------------------
        # Flatten all related data into one row per line item
        # -----------------------------
        for li in line_items:
            row = {
                "shop_id": str(order.shop_id),
                "order_id": str(order.id),
                "order_number": order.order_number,
                "order_date": order.order_date,
                "customer_id": str(customer.id),
                "customer_name": customer.display_name,
                "customer_email": customer.email,
                "financial_status": order.financial_status,
                "fulfillment_status": order.fulfillment_status,
                "product_id": str(li.product_id) if li.product_id else None,
                "product_title": li.title,
                "variant_id": li.variant_id,
                "sku": li.sku,
                "quantity": li.quantity,
                "line_price": float(li.price or 0),
                "order_total_price": float(order.total_price or 0),
            }

            # Add fulfillments info (flatten multiple fulfillments if exist)
            if fulfillments:
                f = fulfillments[0]  # pick the first fulfillment if multiple
                row.update({
                    "fulfillment_id": f.shopify_fulfillment_id,
                    "tracking_company": f.tracking_company,
                    "tracking_number": f.tracking_number,
                })

                # Shipping lines (pick first shipping line if multiple)
                if f.shipping_lines:
                    sl = f.shipping_lines[0]
                    row.update({
                        "shipping_title": sl.title,
                        "shipping_price": float(sl.price or 0),
                        "shipping_code": sl.code,
                        "shipping_carrier": sl.carrier_identifier,
                    })

            # Add refund info (sum or first refund line)
            if refunds:
                r = refunds[0]
                rl = db.query(RefundLineItem).filter(RefundLineItem.refund_id == r.id).first()
                if rl:
                    row.update({
                        "refund_id": r.shopify_refund_id,
                        "refund_amount": float(r.total_amount or 0),
                        "refund_currency": r.currency,
                        "refund_product_id": rl.product_id,
                        "refund_product_title": rl.title,
                        "refund_variant_id": rl.variant_id,
                        "refund_sku": rl.sku,
                        "refund_quantity": rl.quantity,
                    })

            # Add transaction info (pick first transaction if multiple)
            if transactions:
                txn = transactions[0]
                row.update({
                    "transaction_id": txn.shopify_transaction_id,
                    "gateway": txn.gateway,
                    "transaction_status": txn.status,
                    "transaction_amount": float(txn.amount or 0),
                })

            rows.append(row)

    # -----------------------------
    # Write CSV
    # -----------------------------
    if rows:
        all_keys = sorted({k for r in rows for k in r.keys()})
        with open(file_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=all_keys)
            writer.writeheader()
            writer.writerows(rows)

    return file_path


def export_customers_csv(db: Session):

    file_path = get_timestamped_filename("customers_ai_enterprise")

    now = datetime.now(timezone.utc)

    data = (
        db.query(
            Customer,
            func.count(Order.id).label("order_count"),
            func.sum(Order.total_price).label("lifetime_value"),
            func.max(Order.order_date).label("last_order_date"),
            func.min(Order.order_date).label("first_order_date"),
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
            "segment",
            "customer_status",
            "lifetime_orders",
            "lifetime_value",
            "avg_order_value",
            "first_order_date",
            "last_order_date",
            "days_since_last_order",
            "refund_ratio",
            "churn_risk_score",
            "preferred_vendor",
            "last_product",
            "ai_summary",
            "sample_questions"
        ])

        for customer, order_count, lifetime_value, last_order, first_order in data:

            name = (
                customer.display_name
                or f"{customer.first_name or ''} {customer.last_name or ''}".strip()
            )

            order_count = order_count or 0
            lifetime_value = float(lifetime_value or 0)
            avg_order_value = lifetime_value / order_count if order_count else 0

            # --------------------------------------
            # Days since last order (churn signal)
            # --------------------------------------

            days_since_last = None
            if last_order:

                # make timezone-aware if needed
                if last_order.tzinfo is None:
                    last_order = last_order.replace(tzinfo=timezone.utc)

                days_since_last = (now - last_order).days
            else:
                days_since_last = None

            # --------------------------------------
            # Refund ratio
            # --------------------------------------

            total_refunds = (
                db.query(func.sum(Refund.total_amount))
                .join(Order, Order.id == Refund.order_id)
                .filter(Order.customer_id == customer.id)
                .scalar()
            ) or 0

            refund_ratio = (
                float(total_refunds) / lifetime_value
                if lifetime_value else 0
            )

            # --------------------------------------
            # Fulfillment / product intelligence
            # --------------------------------------

            last_item = (
                db.query(OrderLineItem)
                .join(Order, Order.id == OrderLineItem.order_id)
                .filter(Order.customer_id == customer.id)
                .order_by(Order.order_date.desc())
                .first()
            )

            last_product = last_item.title if last_item else None

            preferred_vendor = (
                db.query(Product.vendor)
                .join(OrderLineItem, OrderLineItem.product_id == Product.id)
                .join(Order, Order.id == OrderLineItem.order_id)
                .filter(Order.customer_id == customer.id)
                .group_by(Product.vendor)
                .order_by(func.count().desc())
                .limit(1)
                .scalar()
            )

            # --------------------------------------
            # AI SEGMENTATION
            # --------------------------------------

            if order_count >= 10:
                segment = "VIP"
            elif order_count >= 2:
                segment = "returning"
            else:
                segment = "new"

            status = "active" if order_count > 0 else "no_orders"

            # --------------------------------------
            # Churn prediction (simple heuristic)
            # --------------------------------------

            churn_risk = "low"

            if days_since_last:

                if days_since_last > 180:
                    churn_risk = "high"
                elif days_since_last > 60:
                    churn_risk = "medium"

            # --------------------------------------
            # AI semantic summary
            # --------------------------------------

            ai_summary = (
                f"{segment} customer with {order_count} orders. "
                f"Lifetime spend {lifetime_value}. "
                f"Average order value {avg_order_value}. "
                f"Preferred vendor {preferred_vendor}. "
                f"Last product purchased {last_product}. "
                f"Churn risk {churn_risk}. "
                f"Refund ratio {round(refund_ratio,2)}."
            )

            sample_questions = (
                "show my orders | where is my shipment | refund status | "
                "recommend similar products | reorder last product"
            )

            writer.writerow([
                customer.shop_id,
                customer.id,
                name,
                customer.email,
                segment,
                status,
                order_count,
                lifetime_value,
                avg_order_value,
                first_order,
                last_order,
                days_since_last,
                refund_ratio,
                churn_risk,
                preferred_vendor,
                last_product,
                ai_summary,
                sample_questions
            ])

    return file_path



def export_orders_csv(db: Session):

    file_path = get_timestamped_filename("orders")

    rows = (
        db.query(
            Order,
            Customer,
            OrderLineItem,
            Fulfillment,
            Refund,
            RefundLineItem
        )
        .outerjoin(Customer, Customer.id == Order.customer_id)
        .outerjoin(OrderLineItem, OrderLineItem.order_id == Order.id)
        .outerjoin(Fulfillment, Fulfillment.order_id == Order.id)
        .outerjoin(
            RefundLineItem,
            (RefundLineItem.order_id == Order.id) &
            (RefundLineItem.shopify_line_item_id == OrderLineItem.shopify_line_item_id)
        )
        .outerjoin(Refund, Refund.id == RefundLineItem.refund_id)
        .order_by(Order.customer_id, Order.order_date.desc())
        .all()
    )

    # -----------------------------------
    # Determine last order per customer
    # -----------------------------------

    last_order_map = {}

    for order, *_ in rows:
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
            "product_id",
            "product_title",
            "variant_id",
            "sku",
            "quantity",
            "price",
            "total_line_price",
            "fulfillment_status",
            "tracking_company",
            "tracking_number",
            "shipped_at",
            "refund_amount",
            "refund_currency",
            "last_order_flag"
        ])

        for order, customer, line, fulfillment, refund, refund_line in rows:

            customer_name = None

            if customer:
                if getattr(customer, "first_name", None) or getattr(customer, "last_name", None):
                    customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
                else:
                    customer_name = getattr(customer, "name", None)

            last_flag = 1 if last_order_map.get(order.customer_id) == order.id else 0

            qty = getattr(line, "quantity", 0)
            price = getattr(line, "price", 0)
            total_line_price = (price or 0) * (qty or 0)

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

                getattr(line, "product_id", None),
                getattr(line, "title", None),
                getattr(line, "variant_id", None),
                getattr(line, "sku", None),
                qty,
                price,
                total_line_price,

                getattr(fulfillment, "status", None),
                getattr(fulfillment, "tracking_company", None),
                getattr(fulfillment, "tracking_number", None),
                getattr(fulfillment, "shipped_at", None),

                getattr(refund, "total_amount", None),
                getattr(refund, "currency", None),

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

        # Header
        writer.writerow([
            "shop_id",
            "order_id",
            "order_number",
            "order_date",
            "financial_status",
            "fulfillment_status",
            "customer_id",
            "customer_name",
            "customer_email",
            "fulfillment_id",
            "status",
            "tracking_company",
            "tracking_number",
            "shipped_at",
            "location_id",
            "notify_customer",
            "line_item_product_id",
            "line_item_title",
            "line_item_variant_id",
            "line_item_sku",
            "line_item_quantity",
            "line_item_price",
            "line_item_total",
            "total_refund_amount",
            "refund_currency"
        ])

        for fulfillment, order, customer in fulfillments:
            # customer name fallback
            customer_name = None
            if customer:
                if getattr(customer, "first_name", None) or getattr(customer, "last_name", None):
                    customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
                else:
                    customer_name = getattr(customer, "display_name", None)

            # total refunds for this order
            refunds = db.query(Refund).filter(Refund.order_id == order.id).all()
            total_refund_amount = sum(float(r.total_amount) for r in refunds)
            refund_currency = refunds[0].currency if refunds else None

            # iterate over order line items
            for line_item in getattr(order, "line_items", []):
                writer.writerow([
                    order.shop_id,
                    order.id,
                    order.order_number,
                    order.order_date,
                    order.financial_status,
                    order.fulfillment_status,
                    getattr(customer, "id", None),
                    customer_name,
                    getattr(customer, "email", None),
                    fulfillment.shopify_fulfillment_id,
                    fulfillment.status,
                    fulfillment.tracking_company,
                    fulfillment.tracking_number,
                    fulfillment.shipped_at,
                    fulfillment.location_id,
                    fulfillment.notify_customer,
                    line_item.product_id,
                    line_item.title,
                    line_item.variant_id,
                    line_item.sku,
                    line_item.quantity,
                    line_item.price,
                    (line_item.price * line_item.quantity) if line_item.price else None,
                    total_refund_amount,
                    refund_currency
                ])

    return file_path


def export_refunds_csv(db: Session):

    file_path = get_timestamped_filename("refunds")

    rows = (
        db.query(
            Refund,
            RefundLineItem,
            Order,
            Customer
        )
        .join(RefundLineItem, RefundLineItem.refund_id == Refund.id)
        .join(Order, Order.id == Refund.order_id)
        .outerjoin(Customer, Customer.id == Order.customer_id)
        .all()
    )

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "order_id",
            "order_number",
            "refund_id",
            "customer_id",
            "customer_name",
            "customer_email",
            "refund_amount",
            "currency",
            "refund_date",
            "product_id",
            "title",
            "variant_id",
            "sku",
            "quantity",
            "price",
            "total",
            "reason"
        ])

        for refund, line, order, customer in rows:

            writer.writerow([
                order.id,
                order.order_number,
                refund.shopify_refund_id,
                getattr(customer, "id", None),
                getattr(customer, "display_name", None),
                getattr(customer, "email", None),
                refund.total_amount,
                refund.currency,
                refund.created_at,
                line.product_id,
                line.title,
                line.variant_id,
                line.sku,
                line.quantity,
                line.price,
                line.total,
                line.reason
            ])

    return file_path



def export_products_inventory_csv(db: Session):
    """
    Export a combined CSV for Products + Inventory + Sales/Refunds.
    Includes per-location inventory and total ordered/refunded quantities.
    """

    file_path = get_timestamped_filename("products_inventory")

    products = db.query(Product).all()

    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        # -------------------------------
        # HEADER
        # -------------------------------
        writer.writerow([
            "shop_id",
            "product_id",
            "shopify_product_id",
            "product_title",
            "vendor",
            "product_type",

            "variant_id",
            "sku",

            "price",
            "total_ordered_qty",
            "total_refunded_qty",
            "total_net_sold_qty",
            "gross_sales",

            "inventory_item_id",
            "location_id",
            "shopify_location_id",
            "location_name",
            "location_address",
            "location_city",
            "location_country",
            "available_quantity",
            "stock_status",
            "inventory_updated_at"
        ])

        for product in products:
            variants = product.variants or []

            for v in variants:
                variant_id = v.get("id")
                inventory_item_id = v.get("inventory_item_id")
                sku = v.get("sku")
                price = float(v.get("price") or 0)

                if not inventory_item_id:
                    continue

                # -------------------------------
                # Total sales data (all locations)
                # -------------------------------
                total_ordered_qty = (
                    db.query(func.coalesce(func.sum(OrderLineItem.quantity), 0))
                    .filter(OrderLineItem.variant_id == variant_id)
                    .scalar()
                )

                total_refunded_qty = (
                    db.query(func.coalesce(func.sum(RefundLineItem.quantity), 0))
                    .filter(RefundLineItem.variant_id == variant_id)
                    .scalar()
                )

                total_net_sold = (total_ordered_qty or 0) - (total_refunded_qty or 0)
                gross_sales = price * (total_ordered_qty or 0)

                # -------------------------------
                # Inventory per location
                # -------------------------------
                inventory_levels = (
                    db.query(InventoryLevel)
                    .filter(
                        InventoryLevel.inventory_item_id == inventory_item_id,
                        InventoryLevel.shop_id == product.shop_id
                    )
                    .all()
                )

                # If no inventory records, still output the variant with zeros
                if not inventory_levels:
                    writer.writerow([
                        product.shop_id,
                        product.id,
                        product.shopify_product_id,
                        product.title,
                        product.vendor,
                        product.product_type,

                        variant_id,
                        sku,

                        price,
                        total_ordered_qty,
                        total_refunded_qty,
                        total_net_sold,
                        gross_sales,

                        inventory_item_id,
                        None,
                        None,
                        None,
                        None,
                        None,
                        None,
                        0,
                        "OUT_OF_STOCK",
                        None
                    ])
                    continue

                for inv in inventory_levels:
                    available_qty = inv.available or 0

                    # -------------------------------
                    # Stock Status
                    # -------------------------------
                    if available_qty <= 0:
                        stock_status = "OUT_OF_STOCK"
                    elif available_qty < 5:
                        stock_status = "LOW_STOCK"
                    else:
                        stock_status = "IN_STOCK"

                    # Get location details
                    location = db.query(Location).filter(
                        Location.shopify_location_id == inv.location_id
                    ).first()

                    location_name = location.name if location else None
                    location_address = location.address1 if location else None
                    location_city = location.city if location else None
                    location_country = location.country if location else None
                    shopify_location_id = location.shopify_location_id if location else None

                    writer.writerow([
                        product.shop_id,
                        product.id,
                        product.shopify_product_id,
                        product.title,
                        product.vendor,
                        product.product_type,

                        variant_id,
                        sku,

                        price,
                        total_ordered_qty,
                        total_refunded_qty,
                        total_net_sold,
                        gross_sales,

                        inventory_item_id,
                        inv.location_id,
                        shopify_location_id,
                        location_name,
                        location_address,
                        location_city,
                        location_country,
                        available_qty,
                        stock_status,
                        inv.updated_at
                    ])

    return file_path



def export_transactions_csv(db: Session):

    file_path = get_timestamped_filename("transactions")

    rows = (
        db.query(
            OrderTransaction,
            Order,
            Customer,
            OrderLineItem
        )
        .join(Order, Order.id == OrderTransaction.order_id)
        .outerjoin(Customer, Customer.id == Order.customer_id)
        .outerjoin(OrderLineItem, OrderLineItem.order_id == Order.id)
        .all()
    )

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            "shop_id",
            "order_id",
            "order_number",
            "order_total_price",

            "customer_id",
            "customer_name",
            "customer_email",

            "transaction_id",
            "gateway",
            "kind",
            "status",

            "product_id",
            "product_title",
            "variant_id",
            "sku",
            "quantity",
            "line_price",

            "amount",
            "currency",

            "financial_status",
            "fulfillment_status",

            "processed_at"
        ])

        for t, order, customer, line in rows:

            currency = None
            if t.raw_data:
                currency = t.raw_data.get("currency")

            writer.writerow([
                order.shop_id,
                order.id,
                order.order_number,
                order.total_price,

                getattr(customer, "id", None),
                getattr(customer, "display_name", None),
                getattr(customer, "email", None),

                t.shopify_transaction_id,
                t.gateway,
                t.kind,
                t.status,

                getattr(line, "product_id", None),
                getattr(line, "title", None),
                getattr(line, "variant_id", None),
                getattr(line, "sku", None),
                getattr(line, "quantity", None),
                getattr(line, "price", None),
                t.amount,
                currency,
                order.financial_status,
                order.fulfillment_status,
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
            ShippingZone.shop_id == Order.shop_id
        )
        .outerjoin(Customer, Customer.id == Order.customer_id)
        .all()
    )

    with open(file_path, "w", newline="", encoding="utf-8") as f:

        writer = csv.writer(f)

        writer.writerow([
            # Shop / Order
            "shop_id",
            "order_id",
            "order_number",

            # Customer
            "customer_id",
            "customer_name",
            "customer_email",

            # Product (line item)
            "product_id",
            "product_title",
            "variant_id",
            "sku",
            "quantity",
            "price",

            # Shipping
            "shipping_zone",
            "tracking_number",
            "carrier",
            "status",
            "shipped_at"
        ])

        for o, f_item, zone, customer in data:

            line_items = o.line_items or []

            # If no products, still export order row
            if not line_items:
                writer.writerow([
                    o.shop_id,
                    o.id,
                    o.order_number,
                    getattr(customer, "id", None),
                    getattr(customer, "display_name", None),
                    getattr(customer, "email", None),
                    None,
                    None,
                    None,
                    None,
                    None,
                    getattr(zone, "name", None),
                    f_item.tracking_number,
                    f_item.tracking_company,
                    f_item.status,
                    f_item.shipped_at
                ])
                continue

            # Export each product
            for item in line_items:

                writer.writerow([
                    o.shop_id,
                    o.id,
                    o.order_number,
                    getattr(customer, "id", None),
                    getattr(customer, "display_name", None),
                    getattr(customer, "email", None),

                    item.product_id,
                    item.title,
                    item.variant_id,
                    item.sku,
                    item.quantity,
                    item.price,

                    getattr(zone, "name", None),
                    f_item.tracking_number,
                    f_item.tracking_company,
                    f_item.status,
                    f_item.shipped_at
                ])

    return file_path


