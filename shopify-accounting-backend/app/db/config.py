import os

ENV = os.getenv("ENV", "production")
USE_OAUTH  = ENV == "production"
SHOPIFY_API_KEY = os.getenv("SHOPIFY_API_KEY")
SHOPIFY_API_SECRET = os.getenv("SHOPIFY_API_SECRET")
