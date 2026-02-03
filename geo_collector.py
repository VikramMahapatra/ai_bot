import requests
import csv
import time
from datetime import datetime
from pathlib import Path

TOKEN_URL = "http://13.232.13.233/webservice?token=generateAccessToken"
DATA_URL = "http://13.232.13.233/webservice?token=getTokenBaseLiveData&ProjectId=16"

USERNAME = "Zentrixel"
PASSWORD = "12345"

CSV_FILE = "geo_live_data.csv"

FETCH_INTERVAL_SECONDS = 10   # change to 5 / 10 / 20 as needed


def get_token():
    payload = {
        "username": "Zentrixel",
        "password": "12345"
    }

    resp = requests.post(
        "http://13.232.13.233/webservice?token=generateAccessToken",
        json=payload,
        timeout=20
    )

    resp.raise_for_status()

    data = resp.json()

    token = data.get("data", {}).get("token")

    if not token:
        raise Exception(f"Token not found in response: {data}")

    return token


def flatten_dict(d, parent_key="", sep="."):
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def append_to_csv(rows, file_path):
    if not rows:
        return

    file_exists = Path(file_path).exists()

    headers = rows[0].keys()

    with open(file_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)

        if not file_exists:
            writer.writeheader()

        for r in rows:
            writer.writerow(r)


def fetch_live_data(token):
    headers = {
        "auth-code": token
    }

    payload = {
        "company_names": "Zentrixel",
        "format": "json"
    }

    resp = requests.post(DATA_URL, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()

    return resp.json()


def extract_rows(api_response):
    """
    This tries to safely handle different response shapes.

    If API returns:
    - list of vehicles  -> works
    - or wrapped object -> tries common keys
    """

    # adjust this after first run if needed
    if isinstance(api_response, list):
        records = api_response
    elif isinstance(api_response, dict):

        # try common keys
        for k in ["data", "result", "records", "vehicles"]:
            if k in api_response and isinstance(api_response[k], list):
                records = api_response[k]
                break
        else:
            # single object
            records = [api_response]
    else:
        records = []

    rows = []

    now = datetime.utcnow().isoformat()

    for r in records:
        if isinstance(r, dict):
            flat = flatten_dict(r)
            flat["ingested_at_utc"] = now
            rows.append(flat)

    return rows


def main():
    print("Fetching auth token...")

    token = get_token()

    print("Token received.")

    while True:
        try:
            print("Fetching live geo data...")

            api_response = fetch_live_data(token)

            rows = extract_rows(api_response)

            if rows:
                append_to_csv(rows, CSV_FILE)
                print(f"{len(rows)} rows appended at {datetime.now()}")
            else:
                print("No usable records found in response")

        except requests.exceptions.HTTPError as e:
            print("HTTP error:", e)

            # token may have expired
            print("Trying to re-generate token...")
            token = get_token()

        except Exception as e:
            print("Error:", e)

        time.sleep(FETCH_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
