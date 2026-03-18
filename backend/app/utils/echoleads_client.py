from datetime import date

import requests
from fastapi import HTTPException
from app.config import settings

class EcholeadsClient:

    def __init__(self):
        self.base_url = settings.ECHOL_API_BASE_URL
        self.headers = {
            "Authorization": f"{settings.ECHOL_API_KEY}",
            "Content-Type": "application/json"
        }

    def _post(self, endpoint: str, payload: dict):
        try:
            response = requests.post(
                f"{self.base_url}{endpoint}",
                json=payload,
                headers=self.headers,
                timeout=15
            )
            
            # Print full response
            # print("====== ECHOLEADS API RESPONSE ======")
            # print("URL:", f"{self.base_url}{endpoint}")
            # print("Status Code:", response.status_code)
            # print("Response Text:", response.text)
            # print("====================================")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print("====== ECHOLEADS ERROR ======")
            if e.response is not None:
                print("Status:", e.response.status_code)
                print("Body:", e.response.text)
            print("==============================")

            raise HTTPException(status_code=500, detail=f"Echoleads API error: {str(e)}")
        
    def _put(self, endpoint: str, payload: dict):
        try:
            response = requests.put(
                f"{self.base_url}{endpoint}",
                json=payload,
                headers=self.headers,
                timeout=15
            )
            
            # Print full response
            # print("====== ECHOLEADS API RESPONSE ======")
            # print("URL:", f"{self.base_url}{endpoint}")
            # print("Status Code:", response.status_code)
            # print("Response Text:", response.text)
            # print("====================================")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print("====== ECHOLEADS ERROR ======")
            if e.response is not None:
                print("Status:", e.response.status_code)
                print("Body:", e.response.text)
            print("==============================")
            raise HTTPException(status_code=500, detail=f"Echoleads API error: {str(e)}")
        
    def _delete(self, endpoint: str):
        try:
            response = requests.delete(
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                timeout=15
            )

            # print("====== ECHOLEADS API RESPONSE ======")
            # print("URL:", f"{self.base_url}{endpoint}")
            # print("Status Code:", response.status_code)
            # print("Response Text:", response.text)
            # print("====================================")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print("====== ECHOLEADS ERROR ======")
            if e.response is not None:
                print("Status:", e.response.status_code)
                print("Body:", e.response.text)
            print("==============================")
            raise HTTPException(status_code=500, detail=f"Echoleads API error: {str(e)}")
        
    def _get(self, endpoint: str, params=None):
        try:
            response = requests.get(
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                params=params,
                timeout=15
            )

            # print("====== ECHOLEADS API RESPONSE ======")
            # print("URL:", f"{self.base_url}{endpoint}")
            # print("Status Code:", response.status_code)
            # print("Response Text:", response.text)
            # print("====================================")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise HTTPException(status_code=500, detail=f"Echoleads API error: {str(e)}")

    # Specific API methods
    def create_call(self, payload: dict):
        return self._post("/call/create", payload)
    
    def create_agent(self, payload: dict):
        return self._post("/agent-tables", payload)
    
    def update_agent(self, agent_id: str, payload: dict):
        return self._put(f"/agent-tables/{agent_id}", payload)
    
    def fetch_voices(self):
        return self._get("/admin/voice")
    
    def fetch_campaign_calls(self, campaign_id):
        params = {
            "campaign_id": campaign_id
        }

        return self._get("/call-logs", params=params)
    
    def fetch_calls(self, agent_id, from_date, to_date):
        if hasattr(from_date, "isoformat"):
            from_date = from_date.isoformat()

        if hasattr(to_date, "isoformat"):
            to_date = to_date.isoformat()

        params = {
            "agent_id": agent_id,
            "from_date": from_date,
            "to_date": to_date
        }

        return self._get("/call-logs", params=params)
    
    def get_campaign_by_id(self, campaign_id: int):
        return self._get(f"/campaigns/{campaign_id}")
    
    def create_campaign(self, payload: dict):
        return self._post("/campaigns", payload)
    
    def update_campaign(self, campaign_id: int, payload: dict):
        return self._put(f"/campaigns/{campaign_id}", payload)
    
    def create_contact(self, payload: dict):
        return self._post("/contact", payload)
    
    def delete_agent(self, agent_id: str):
        return self._delete(f"/agent-tables/{agent_id}")