"""
Backfill organization_id and user_id for existing leads
"""

from app.database import SessionLocal
from app.models import Lead, WidgetConfig, User

db = SessionLocal()

try:
    # Get all leads with NULL organization_id
    leads_to_update = db.query(Lead).filter(Lead.organization_id.is_(None)).all()
    print(f"Found {len(leads_to_update)} leads to backfill")
    
    updated_count = 0
    
    for lead in leads_to_update:
        # Try to get org info from widget_id
        if lead.widget_id:
            widget = db.query(WidgetConfig).filter(WidgetConfig.widget_id == lead.widget_id).first()
            if widget:
                lead.organization_id = widget.organization_id
                lead.user_id = widget.user_id
                updated_count += 1
                print(f"  Lead {lead.id}: Set org_id={widget.organization_id}, user_id={widget.user_id}")
                continue
        
        # If no widget, assign to first org (default fallback)
        # Find first organization/user (typically org_id=2 for TechCore)
        first_user = db.query(User).filter(User.role == 'ADMIN').first()
        if first_user:
            lead.organization_id = first_user.organization_id
            lead.user_id = first_user.id
            updated_count += 1
            print(f"  Lead {lead.id}: Set org_id={first_user.organization_id}, user_id={first_user.id} (default)")
    
    db.commit()
    print(f"\nBackfill completed: {updated_count} leads updated")
    
    # Verify
    all_leads = db.query(Lead).all()
    org_counts = {}
    for lead in all_leads:
        if lead.organization_id:
            org_counts[lead.organization_id] = org_counts.get(lead.organization_id, 0) + 1
    
    print(f"\nLead distribution by org:")
    for org_id, count in sorted(org_counts.items()):
        print(f"  Org {org_id}: {count} leads")

except Exception as e:
    print(f"Error during backfill: {str(e)}")
    db.rollback()
finally:
    db.close()
