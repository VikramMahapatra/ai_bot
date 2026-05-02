import csv
import io
from typing import List, Dict


def export_leads_to_csv(leads: List[Dict] , headers) -> str:
    if not leads:
        return ""

    output = io.StringIO()
    
    fieldnames = [h[0] for h in headers]

    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for lead in leads:
        row = {}

        for label, key in headers:
            row[label] = lead.get(key, "")

        writer.writerow(row)

    return output.getvalue()
