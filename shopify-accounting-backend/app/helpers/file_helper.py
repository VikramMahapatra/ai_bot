from datetime import datetime
import os
import glob

EXPORT_DIR = "exports/chatbot"

def get_timestamped_filename(prefix: str, ext: str = "csv"):

    os.makedirs(EXPORT_DIR, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    filename = f"{prefix}_{timestamp}.{ext}"

    return os.path.join(EXPORT_DIR, filename)


def clear_export_folder():

    if not os.path.exists(EXPORT_DIR):
        os.makedirs(EXPORT_DIR)
        return

    files = glob.glob(os.path.join(EXPORT_DIR, "*"))

    for file in files:
        try:
            if os.path.isfile(file):
                os.remove(file)
        except Exception as e:
            print(f"Failed to delete {file}: {e}")

