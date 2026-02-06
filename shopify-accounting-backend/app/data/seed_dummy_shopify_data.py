import uuid
import random
from datetime import datetime, timedelta
from decimal import Decimal
from app.models.shop import Shop
from app.models.location import Location
from app.models.shipping_zone import ShippingZone
from app.models.legal_policy import LegalPolicy
from app.models.page import Page
from app.models.customer import Customer
from app.models.fulfillment import Fulfillment
from app.models.order import Order
from app.models.order_line_item import OrderLineItem
from app.models.product import Product
from app.models.refund import Refund
from app.models.refund_line_item import RefundLineItem
from app.models.transaction import OrderTransaction
from faker import Faker

from app.db.session import SessionLocal
from app.models import *
fake = Faker()

SHOP_ID = uuid.UUID("3107dcbe-487b-4d2a-ac6c-893a3b081045")

# ==================================
# HELPERS
# ==================================

def random_date():
    return datetime.utcnow() - timedelta(days=random.randint(1, 365))


def get_existing_sets(db):

    return {
        "customers": set(x[0] for x in db.query(Customer.shopify_customer_id).all()),
        "orders": set(x[0] for x in db.query(Order.shopify_order_id).all()),
        "fulfillments": set(x[0] for x in db.query(Fulfillment.shopify_fulfillment_id).all()),
        "transactions": set(x[0] for x in db.query(OrderTransaction.shopify_transaction_id).all()),
        "refunds": set(x[0] for x in db.query(Refund.shopify_refund_id).all()),
    }


def generate_unique(existing_set, start=100000, end=999999999):

    while True:
        val = random.randint(start, end)
        if val not in existing_set:
            existing_set.add(val)
            return val


def get_or_create_products(db, count=50):

    products = db.query(Product).filter(Product.shop_id == SHOP_ID).all()

    if len(products) >= count:
        return products

    for _ in range(count - len(products)):

        p = Product(
            shop_id=SHOP_ID,
            shopify_product_id=random.randint(100000, 999999),
            title=fake.word(),
            vendor=random.choice(["Nike", "Apple", "Samsung", "Sony"]),
            product_type=random.choice(["Shoes", "Electronics", "Clothing"]),
            price=Decimal(random.randint(10, 500)),
            active=True,
        )

        db.add(p)

    db.commit()

    return db.query(Product).filter(Product.shop_id == SHOP_ID).all()


# ==================================
# MAIN SEED FUNCTION
# ==================================

def run():

    db = SessionLocal()

    try:

        existing_ids = get_existing_sets(db)

        existing_customers = db.query(Customer).filter(
            Customer.shop_id == SHOP_ID
        ).count()

        existing_orders = db.query(Order).filter(
            Order.shop_id == SHOP_ID
        ).count()

        customers_to_create = max(0, 1000 - existing_customers)
        orders_to_create = max(0, 5000 - existing_orders)

        print("Customers to create:", customers_to_create)
        print("Orders to create:", orders_to_create)

        products = get_or_create_products(db)

        # ==================================
        # CREATE CUSTOMERS
        # ==================================

        new_customers = []

        for _ in range(customers_to_create):

            c = Customer(
                shop_id=SHOP_ID,
                shopify_customer_id=generate_unique(existing_ids["customers"]),
                display_name=fake.name(),
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                email=fake.email(),
                verified_email=True,
            )

            new_customers.append(c)

        db.add_all(new_customers)
        db.commit()

        customers = db.query(Customer).filter(
            Customer.shop_id == SHOP_ID
        ).all()

        # ==================================
        # CREATE ORDERS
        # ==================================

        for i in range(orders_to_create):

            customer = random.choice(customers)

            order = Order(
                shop_id=SHOP_ID,
                shopify_order_id=generate_unique(existing_ids["orders"]),
                order_number=str(random.randint(1000, 9999)),
                order_date=random_date(),
                customer_id=customer.id,
                customer_email=customer.email,
                customer_name=customer.display_name,
                financial_status=random.choice(["paid", "pending", "refunded"]),
                fulfillment_status=random.choice(["fulfilled", "partial", None]),
                subtotal_price=Decimal(random.randint(50, 500)),
                total_tax=Decimal(random.randint(1, 50)),
                total_discount=Decimal(random.randint(0, 20)),
                total_price=Decimal(random.randint(50, 600)),
                currency="USD",
            )

            db.add(order)
            db.flush()

            # LINE ITEMS

            for _ in range(random.randint(1, 4)):

                product = random.choice(products)

                li = OrderLineItem(
                    order_id=order.id,
                    product_id=product.id,
                    shopify_line_item_id=random.randint(10000000, 99999999),
                    variant_id=random.randint(1000, 9999),
                    title=product.title,
                    quantity=random.randint(1, 3),
                    price=product.price,
                    sku=fake.lexify("SKU????"),
                )

                db.add(li)

            # FULFILLMENT

            if random.random() > 0.3:

                f = Fulfillment(
                    order_id=order.id,
                    shopify_fulfillment_id=generate_unique(existing_ids["fulfillments"]),
                    status="success",
                    tracking_company=random.choice(["DHL", "FedEx"]),
                    tracking_number=fake.uuid4(),
                    shipped_at=random_date(),
                )

                db.add(f)

            # TRANSACTION

            txn = OrderTransaction(
                order_id=order.id,
                shopify_transaction_id=generate_unique(existing_ids["transactions"]),
                gateway=random.choice(["stripe", "paypal"]),
                kind="sale",
                status="success",
                amount=order.total_price,
                processed_at=random_date(),
            )

            db.add(txn)

            # REFUND

            if random.random() > 0.7:

                refund = Refund(
                    order_id=order.id,
                    shopify_refund_id=generate_unique(existing_ids["refunds"]),
                    total_amount=Decimal(random.randint(10, 50)),
                    currency="USD",
                    refund_reason="customer_return",
                    created_at=random_date(),
                )

                db.add(refund)
                db.flush()

                rli = RefundLineItem(
                    refund_id=refund.id,
                    order_id=order.id,
                    shopify_line_item_id=random.randint(10000000, 99999999),
                    title="Refunded Item",
                    quantity=1,
                    price=Decimal(10),
                    total=Decimal(10),
                    reason="damaged",
                )

                db.add(rli)

            if i % 100 == 0:
                db.commit()
                print(f"Inserted {i} orders...")

        db.commit()

        print("DONE ✅")

    finally:
        db.close()


if __name__ == "__main__":
    run()
