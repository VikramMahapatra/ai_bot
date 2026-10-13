# app/services/integration_hub_service.py

import logging

import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class IntegrationHubService:

    def __init__(self):
        self.base_url = settings.INTEGRATION_HUB_URL
        self.api_key = settings.INTEGRATION_HUB_API_KEY

    def _headers(self):
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def create_connection(
        self,
        tenant_id: int,
        provider: str,
        name: str,
        config: dict | None = None,
    ):
        payload = {
            "tenant_id": str(tenant_id),
            "provider": provider,
            "name": name,
            "config": config or {},
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/v1/connections",
                json=payload,
                headers=self._headers(),
            )

        response.raise_for_status()

        data = response.json()

        print("Zoho OAuth response:", data)

        return data

    async def get_zoho_authorization_url(
        self,
        connection_id: int,
    ):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.base_url}/v1/oauth/zoho_crm/authorize",
                params={
                    "connection_id": connection_id,
                },
                headers=self._headers(),
            )

        response.raise_for_status()

        return response.json()

    async def get_connection(
        self,
        connection_id: str,
    ):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.base_url}/v1/connections/{connection_id}",
                headers=self._headers(),
            )

        response.raise_for_status()

        return response.json()

    async def disconnect_connection(self, connection_id: str):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.delete(
                f"{self.base_url}/v1/connections/{connection_id}",
                headers=self._headers(),
            )

        response.raise_for_status()

        if response.content:
            return response.json()

        return {"success": True}

    async def test_connection(self, connection_id: str):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/v1/connections/{connection_id}/test",
                headers=self._headers(),
            )

        response.raise_for_status()
        return response.json()

    async def get_schema(
        self,
        connection_id: str,
        stream: str,
    ):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.base_url}/v1/connections/{connection_id}/schema/{stream}",
                headers=self._headers(),
            )

        response.raise_for_status()
        return response.json()

    async def configure_stream(
        self,
        connection_id: str,
        stream: str,
        enabled: bool = True,
        schedule_seconds: int = 300,
    ):
        payload = [
            {
                "stream": stream,
                "enabled": enabled,
                "schedule_seconds": schedule_seconds,
            }
        ]

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.put(
                f"{self.base_url}/v1/connections/{connection_id}/streams",
                json=payload,
                headers=self._headers(),
            )

        response.raise_for_status()
        return response.json()

    async def sync_stream(
        self,
        connection_id: str,
        stream: str,
        full_refresh: bool = False,
    ):
        payload = {
            "stream": stream,
            "full_refresh": full_refresh,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.base_url}/v1/connections/{connection_id}/sync",
                json=payload,
                headers=self._headers(),
            )

        response.raise_for_status()
        return response.json()

    async def register_webhook(
        self,
        connection_id: str,
        streams: list[str],
        callback_url: str | None = None,
    ):
        payload = {
            "streams": streams,
        }

        # Only send callback_url if explicitly provided.
        # Otherwise Integration Hub will generate:
        # {api_base_url}/v1/webhooks/{provider}/{connection_id}
        if callback_url:
            payload["callback_url"] = callback_url

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/v1/connections/{connection_id}/webhooks",
                json=payload,
                headers=self._headers(),
            )

        if response.status_code >= 400:
            try:
                error_body = response.json()
            except Exception:
                error_body = response.text

            logger.error(
                "Integration Hub webhook registration failed: "
                "connection_id=%s status=%s response=%s",
                connection_id,
                response.status_code,
                error_body,
            )

            raise RuntimeError(
                f"Webhook registration failed "
                f"({response.status_code}): {error_body}"
            )

        return response.json()

    async def get_staged_contacts(
        self,
        connection_id: str,
        limit: int = 100,
        offset: int = 0,
    ):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.base_url}/v1/connections/{connection_id}/records/contacts",
                params={
                    "limit": limit,
                    "offset": offset,
                },
                headers=self._headers(),
            )

        response.raise_for_status()
        return response.json()


integration_hub_service = IntegrationHubService()
