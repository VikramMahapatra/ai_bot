import requests
import csv
import time
from datetime import datetime
from pathlib import Path

# DATA_URL = "https://cosmicagps.com/tracking/api/location/acecfdb5d01220ff343a646f4314b751/353691844468701/json"
DATA_URL = "https://cosmicagps.com/tracking/api/location/acecfdb5d01220ff343a646f4314b751/353742376437570/json"
CSV_FILE = "geo_live_data_bhusan.csv"
FETCH_INTERVAL_SECONDS = 3   # change to 5 / 10 / 20 as needed


def flatten_dict(d, parent_key="", sep="."):
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            # store list as string to keep CSV simple
            items.append((new_key, str(v)))
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


def fetch_live_data():
    resp = requests.get(DATA_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_rows(api_response):
    """
    Handles:
    - single object
    - list
    - wrapped response
    """

    if isinstance(api_response, list):
        records = api_response

    elif isinstance(api_response, dict):
        # try common container keys
        for k in ["data", "result", "records", "vehicle", "vehicles"]:
            if k in api_response and isinstance(api_response[k], list):
                records = api_response[k]
                break
        else:
            # treat whole dict as one record
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

    print("Starting live GPS polling...")

    while True:
        try:
            print("Fetching live geo data...")

            api_response = fetch_live_data()

            rows = extract_rows(api_response)

            if rows:
                append_to_csv(rows, CSV_FILE)
                print(f"{len(rows)} rows appended at {datetime.now()}")
            else:
                print("No usable records found")

        except requests.exceptions.HTTPError as e:
            print("HTTP error:", e)

        except Exception as e:
            print("Error:", e)

        time.sleep(FETCH_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
