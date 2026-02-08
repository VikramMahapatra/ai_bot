import re
import httpx
from requests import Session
from app.models.legal_policy import LegalPolicy
from app.models.shop import Shop
from app.services.shopify_client import ShopifyClient

async def sync_legal_policies(db: Session, shop: Shop, client: ShopifyClient):
    response, _ = await client.get("/shop.json")
    policies = response.get("shop", {})

    POLICY_KEYS = [
        "privacy_policy",
        "terms_of_service",
        "refund_policy",
        "shipping_policy",
        "contact_information",
    ]

    for policy_key in POLICY_KEYS:
        p = policies.get(policy_key)
        if not p:
            continue

        policy = db.query(LegalPolicy).filter(
            LegalPolicy.shop_id == shop.id,
            LegalPolicy.policy_type == policy_key
        ).first()

        if not policy:
            policy = LegalPolicy(
                shop_id=shop.id,
                policy_type=policy_key
            )

        policy.title = p.get("title")
        policy.body = p.get("body")
        policy.updated_at = p.get("updated_at")
        policy.raw_data = p

        db.add(policy)

    db.commit()

