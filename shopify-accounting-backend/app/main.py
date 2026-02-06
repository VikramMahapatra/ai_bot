from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from app.models import *
from app.api import auth, export, sync
from app.db.base import Base
from app.db.session import engine
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Shopify Accounting Sync Service API")

Base.metadata.create_all(bind=engine)


app.add_middleware(
    CORSMiddleware,
    # or ["*"] to allow all origins (not recommended for productionS)
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(export.router)

# @app.get("/")
# def root_redirect(shop: str = None):
#     # Use DEV_SHOP_TOKEN if local dev
#     shop = shop or "your-dev-store.myshopify.com"
#     return RedirectResponse(f"/auth/install?shop={shop}")