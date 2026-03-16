import requests
from fastapi import HTTPException
from app.config import settings

class EcholeadsClient:

    def __init__(self):
        self.base_url = settings.ECHOL_API_BASE_URL
        print(settings.ECHOL_API_KEY)        
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
            print("====== ECHOLEADS API RESPONSE ======")
            print("URL:", f"{self.base_url}{endpoint}")
            print("Status Code:", response.status_code)
            print("Response Text:", response.text)
            print("====================================")

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
            print("====== ECHOLEADS API RESPONSE ======")
            print("URL:", f"{self.base_url}{endpoint}")
            print("Status Code:", response.status_code)
            print("Response Text:", response.text)
            print("====================================")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print("====== ECHOLEADS ERROR ======")
            if e.response is not None:
                print("Status:", e.response.status_code)
                print("Body:", e.response.text)
            print("==============================")
            raise HTTPException(status_code=500, detail=f"Echoleads API error: {str(e)}")
        
    def _get(self, endpoint: str):
        try:
            response = requests.get(
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                timeout=15
            )

            print("====== ECHOLEADS API RESPONSE ======")
            print("URL:", f"{self.base_url}{endpoint}")
            print("Status Code:", response.status_code)
            print("Response Text:", response.text)
            print("====================================")

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
    
    def fetch_echolead_calls(self):
        return self._get("/call-logs")
    
    def create_campaign(self, payload: dict):
        return self._post("/campaigns", payload)
    
    def create_contact(self, payload: dict):
        return self._post("/contact", payload)