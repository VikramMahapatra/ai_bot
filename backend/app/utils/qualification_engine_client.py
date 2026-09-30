from typing import Any
from app.config import settings
import httpx


class QualificationEngineClient:

    def __init__(self):
        self.base_url = settings.QUALIFICATION_ENGINE_URL.rstrip("/")
        self.admin_api_key = settings.QUALIFICATION_ENGINE_ADMIN_API_KEY

    async def create_tenant(
        self,
        *,
        name: str,
        slug: str,
    ) -> dict[str, Any]:

        url = f"{self.base_url}/api/v1/tenants"

        headers = {
            "X-Admin-Key": self.admin_api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "name": name,
            "slug": slug,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
            )

        # Very useful while integrating
        if response.is_error:
            raise RuntimeError(
                f"Qualification Engine returned "
                f"{response.status_code}: {response.text}"
            )

        return response.json()

    async def test_admin_connection(self) -> bool:
        """
        Verify that the Qualification Engine is reachable.

        Depending on your engine implementation, you can replace this
        with a dedicated admin health endpoint.
        """

        url = f"{self.base_url}/api/v1/health"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)

        response.raise_for_status()

        return True

    async def test_tenant_connection(
        self,
        *,
        api_key: str,
    ) -> bool:

        url = f"{self.base_url}/api/v1/tenants/me"

        headers = {
            "X-API-Key": api_key,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers=headers,
            )

        response.raise_for_status()

        return True

    async def create_template(
        self,
        *,
        api_key: str,
        payload: dict,
    ) -> dict:

        url = f"{self.base_url}/api/v1/templates"

        headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
            )

        if response.is_error:
            raise RuntimeError(
                f"Qualification Engine returned "
                f"{response.status_code}: {response.text}"
            )

        return response.json()

    async def delete_template(
        self,
        *,
        api_key: str,
        template_id: str,
    ) -> None:
        url = f"{self.base_url}/api/v1/templates/{template_id}"

        headers = {
            "X-API-Key": api_key,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                url,
                headers=headers,
            )

        if response.is_error:
            raise RuntimeError(
                f"Qualification Engine returned "
                f"{response.status_code}: {response.text}"
            )

    async def evaluate(
        self,
        *,
        api_key: str,
        project_id: str,
        conversation_transcript_id: str,
        transcript: dict[str, Any],
        template_id: str,
    ) -> dict[str, Any]:

        url = f"{self.base_url}/api/v1/evaluations"

        headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "project_id": project_id,
            "conversation_transcript_id": conversation_transcript_id,
            "transcript": transcript,
            "template_id": template_id,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
            )

        if response.is_error:
            raise RuntimeError(
                f"Qualification Engine evaluation failed "
                f"{response.status_code}: {response.text}"
            )

        return response.json()
