from datetime import date

import requests
from fastapi import HTTPException
from app.config import settings
from app.models.user import Organization
from app.context.org_context import current_org_id


class EcholeadsClient:

    def __init__(self, organization_id: int):
        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization is required")

        self.organization_id = organization_id
        self.base_url = settings.ECHOL_API_BASE_URL
        self.headers = {
            "Authorization": f"{self._get_api_key()}",
            "Content-Type": "application/json",
        }

    def _get_api_key(self):
        org_id = self.organization_id

        from app.database import SessionLocal

        db = SessionLocal()

        try:
            org = db.query(Organization).get(org_id)

            if not org or not org.echoleads_api_key:
                raise HTTPException(status_code=400, detail="Missing API key")

            return org.echoleads_api_key

        finally:
            db.close()

        return org.echoleads_api_key

    def _post(self, endpoint: str, payload: dict = None):
        try:
            response = requests.post(
                f"{self.base_url}{endpoint}",
                json=payload or {},
                headers=self.headers,
                timeout=15,
            )

            # Print full response
            # print("====== ECHOLEADS API RESPONSE ======")
            # print("URL:", f"{self.base_url}{endpoint}")
            # print("Status Code:", response.status_code)
            # print("Response Text:", response.text)
            # print("====================================")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:  # only catch actual HTTP errors
            error_text = e.response.text
            print("HTTP ERROR:", e.response.status_code, error_text)
            raise HTTPException(status_code=e.response.status_code, detail=error_text)
        except requests.exceptions.RequestException as e:  # network errors
            print("NETWORK ERROR:", str(e))
            raise HTTPException(status_code=400, detail=f"Network Error: {str(e)}")

    def _put(self, endpoint: str, payload: dict):
        try:
            response = requests.put(
                f"{self.base_url}{endpoint}",
                json=payload,
                headers=self.headers,
                timeout=15,
            )

            # Print full response
            # print("====== ECHOLEADS API RESPONSE ======")
            # print("URL:", f"{self.base_url}{endpoint}")
            # print("Status Code:", response.status_code)
            # print("Response Text:", response.text)
            # print("====================================")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:  # only catch actual HTTP errors
            error_text = e.response.text
            print("HTTP ERROR:", e.response.status_code, error_text)
            raise HTTPException(status_code=e.response.status_code, detail=error_text)
        except requests.exceptions.RequestException as e:  # network errors
            print("NETWORK ERROR:", str(e))
            raise HTTPException(status_code=400, detail=f"Network Error: {str(e)}")

    def _delete(self, endpoint: str):
        try:
            response = requests.delete(
                f"{self.base_url}{endpoint}", headers=self.headers, timeout=15
            )

            # ✅ Handle 404 gracefully
            if response.status_code == 404:
                return {"success": False, "not_found": True, "message": response.text}

            # ✅ Other errors (400, 500 etc.)
            if not response.ok:
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code,
                }

            return response.json()

        except requests.exceptions.RequestException as e:
            print("====== ECHOLEADS ERROR ======")
            if e.response is not None:
                print("Status:", e.response.status_code)
                print("Body:", e.response.text)
            print("==============================")

            raise HTTPException(
                status_code=500, detail=f"Echoleads API error: {str(e)}"
            )

    def _get(self, endpoint: str, params=None):
        try:
            response = requests.get(
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                params=params,
                timeout=15,
            )

            # print("====== ECHOLEADS API RESPONSE ======")
            # print("Request Headers:", dict(response.request.headers))
            # print("URL:", f"{self.base_url}{endpoint}")
            # print("Status Code:", response.status_code)
            # print("Response Text:", response.text)
            # print("====================================")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=500, detail=f"Echoleads API error: {str(e)}"
            )

    # Specific API methods
    def create_call(self, payload: dict):
        return self._post("/call/create", payload)

    def fetch_agents(self, limit: int, search: str):
        params = {"page": 1, "limit": limit, "search": search}
        return self._get("/agent-tables", params=params)

    def create_agent(self, payload: dict):
        return self._post("/agent-tables", payload)

    def update_agent(self, agent_id: str, payload: dict):
        return self._put(f"/agent-tables/{agent_id}", payload)

    def publish_agent(self, payload: dict):
        return self._post(f"/agent-tables/publish", payload)

    def fetch_voices(self):
        return self._get("/admin/voice")

    def fetch_campaign_calls(self, campaign_id):
        params = {"campaign_id": campaign_id}

        return self._get("/call-logs", params=params)

    def fetch_calls(self, agent_id, from_date, to_date):
        if hasattr(from_date, "isoformat"):
            from_date = from_date.isoformat()

        if hasattr(to_date, "isoformat"):
            to_date = to_date.isoformat()

        params = {"agent_id": agent_id, "from_date": from_date, "to_date": to_date}

        return self._get("/call-logs", params=params)

    def fetch_test_calls(self, agent_id, from_date, to_date):
        if hasattr(from_date, "isoformat"):
            from_date = from_date.isoformat()

        if hasattr(to_date, "isoformat"):
            to_date = to_date.isoformat()

        params = {
            "agent_id": agent_id,
            "from_date": from_date,
            "to_date": to_date,
            "is_test_call": True,
            "status": "ended",
        }

        return self._get("/call-logs", params=params)

    def get_campaign_by_name(self, campaign_name: str):
        return self._get(f"/campaigns?search={campaign_name}")

    def get_campaign_by_id(self, campaign_id: int):
        return self._get(f"/campaigns/{campaign_id}")

    def create_campaign(self, payload: dict):
        return self._post("/campaigns", payload)

    def update_campaign(self, campaign_id: int, payload: dict):
        return self._put(f"/campaigns/{campaign_id}", payload)

    def start_campaign(self, campaign_id: int):
        return self._post(f"/campaigns/{campaign_id}/start")

    def create_contact(self, payload: dict):
        return self._post("/contact", payload)

    def create_contacts_bulk(self, contacts: list):
        payload = {"contacts": contacts}
        return self._post("/contacts/bulk", payload)

    def delete_agent(self, agent_id: str):
        return self._delete(f"/agent-tables/{agent_id}")

    def fetch_bookings(self):
        return self._get("/calendar-booking")

    def reschedule_contact_call(
        self, campaign_id, contact_id, scheduled_at=None, timezone_str=None
    ):
        payload = {
            "campaign_id": campaign_id,
            "contact_id": contact_id,
        }
        if scheduled_at:
            schedule_date = scheduled_at.strftime("%Y-%m-%d")
            schedule_time = scheduled_at.strftime("%H:%M")

            payload.update(
                {
                    "send_option": "schedule",
                    "schedule_date": schedule_date,
                    "schedule_time": schedule_time,
                    "timezone": timezone_str,
                }
            )
        else:
            payload["send_option"] = "now"

        return self._post("/reschedule-contact", payload)

    def deactivate_agent(self, agent_id: int):
        return self._put(
            f"/agent-tables/{agent_id}/toggle-ind-status",
            {"status": "inactive"},
        )

    def activate_agent(
        self,
        agent_id: int,
        phone: str,
    ):
        payload = {
            "status": "active",
            "phone": phone,
        }

        return self._put(
            f"/agent-tables/{agent_id}/toggle-ind-status",
            payload,
        )
