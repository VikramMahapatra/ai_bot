import uuid
import random
from decimal import Decimal
from faker import Faker
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.fulfillment import Fulfillment
from app.models.shipping_line import ShippingLine

fake = Faker()

def add_dummy_shipping_lines(db: Session, max_lines_per_fulfillment=2):
    """
    Add dummy shipping line data for existing fulfillments.
    """
    fulfillments = db.query(Fulfillment).all()
    print(f"Found {len(fulfillments)} fulfillments...")

    for f in fulfillments:
        # Skip if fulfillment already has shipping lines
        if f.shipping_lines and len(f.shipping_lines) > 0:
            continue

        num_lines = random.randint(1, max_lines_per_fulfillment)
        for _ in range(num_lines):
            sl = ShippingLine(
                fulfillment_id=f.id,
                title=random.choice(["Standard Shipping", "Express Shipping", "Overnight"]),
                price=Decimal(random.randint(5, 25)),
                code=fake.lexify("SHIP???"),
                carrier_identifier=random.choice(["DHL", "FedEx", "UPS", "USPS"]),
            )
            db.add(sl)

        # Commit every 50 fulfillments to avoid large transactions
        if fulfillments.index(f) % 50 == 0:
            db.commit()
            print(f"Processed {fulfillments.index(f)+1} fulfillments...")

    db.commit()
    print("✅ Dummy shipping lines added for all fulfillments.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        add_dummy_shipping_lines(db)
    finally:
        db.close()
