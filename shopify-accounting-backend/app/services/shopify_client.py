# app/services/shopify_client.py
import httpx

class ShopifyClient:
    def __init__(self, shop: str, token: str):
        self.shop = shop
        self.base_url = f"https://{shop}/admin/api/2024-01"
        self.headers = {
            "X-Shopify-Access-Token": token
        }
        self.client = httpx.AsyncClient(timeout=30)


    async def get(self, path: str, params=None):
        url = (
            f"https://{self.shop}/admin{path}"
            if path.startswith("/oauth/")
            else f"{self.base_url}{path}"
        )
        
        r = await self.client.get(
                url,
                headers=self.headers,
                params=params
        )
        r.raise_for_status()
        return r.json(), r.headers

    async def post(self, path: str, payload: dict):
        """
        Send a POST request to Shopify API.
        """
        r = await self.client.get(
                f"{self.base_url}{path}",
                headers=self.headers,
                json=payload
        )
        r.raise_for_status()
        return r.json()
        
    async def close(self):
        await self.client.aclose()