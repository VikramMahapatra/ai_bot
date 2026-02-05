# app/api/auth.py
import secrets
from fastapi import APIRouter
from fastapi.responses import RedirectResponse
import httpx
from app.db.config import SHOPIFY_API_KEY, SHOPIFY_API_SECRET, USE_OAUTH
from app.models.shop import Shop
from app.db.session import SessionLocal
from urllib.parse import urlencode, quote
import os

router = APIRouter(
    tags=["Auth"],
)


SCOPES = "read_orders,read_customers,read_products,read_shopify_payments_payouts"
REDIRECT_URI = "https://thomasina-mesogleal-alarmingly.ngrok-free.dev/auth/callback"

@router.get("/auth/install")
def install(shop: str):
    state = secrets.token_urlsafe(16)
    redirect_uri = quote(REDIRECT_URI, safe="")
    auth_url = (
        f"https://{shop}/admin/oauth/authorize"
        f"?client_id={SHOPIFY_API_KEY}"
        f"&scope={SCOPES}"
        f"&redirect_uri={REDIRECT_URI}"
    )
    return RedirectResponse(auth_url)


@router.get("/auth/callback")
async def callback(code: str, shop: str):
    token_url = f"https://{shop}/admin/oauth/access_token"

    async with httpx.AsyncClient() as client:
        r = await client.post(token_url, json={
            "client_id": SHOPIFY_API_KEY,
            "client_secret": SHOPIFY_API_SECRET,
            "code": code
        })

    data = r.json()
    access_token = data["access_token"]
    if not access_token.startswith("shpat_"):
        raise Exception("Expected OFFLINE admin token")
    print("OAuth response:", data)

    db = SessionLocal()

    shop_obj = db.query(Shop).filter(Shop.shop_domain == shop).first()
    if not shop_obj:
        shop_obj = Shop(
            shop_domain=shop,
            access_token=access_token
        )
        db.add(shop_obj)
    else:
        shop_obj.access_token = access_token

    db.commit()
    db.refresh(shop_obj)

    return {
        "message": "App installed",
        "shop_id": shop_obj.id
    }
