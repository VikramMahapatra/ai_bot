import csv
import io
from typing import List, Dict


def export_leads_to_csv(leads: List[Dict]) -> str:
    """Export leads to CSV format"""
    if not leads:
        return ""
    
    output = io.StringIO()
    fieldnames = ["id", "session_id", "widget_id", "name", "email", "phone", "company", "created_at"]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for lead in leads:
        writer.writerow({
            "id": lead.get("id", ""),
            "session_id": lead.get("session_id", ""),
            "widget_id": lead.get("widget_id", ""),
            "name": lead.get("name", ""),
            "email": lead.get("email", ""),
            "phone": lead.get("phone", ""),
            "company": lead.get("company", ""),
            "created_at": lead.get("created_at", ""),
        })
    
    return output.getvalue()
