from datetime import datetime
import os

EXPORT_DIR = "exports"

def get_timestamped_filename(prefix: str, ext: str = "csv"):

    os.makedirs(EXPORT_DIR, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    filename = f"{prefix}_{timestamp}.{ext}"

    return os.path.join(EXPORT_DIR, filename)
