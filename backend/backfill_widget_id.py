"""Backfill widget_id for existing knowledge sources."""
import sqlite3

def main():
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    
    # Get all knowledge sources without widget_id
    cursor.execute("""
        SELECT id, organization_id, name 
        FROM knowledge_sources 
        WHERE widget_id IS NULL
    """)
    sources = cursor.fetchall()
    
    if not sources:
        print("No knowledge sources need widget_id backfill")
        conn.close()
        return
    
    print(f"Found {len(sources)} knowledge sources without widget_id\n")
    
    # For each knowledge source, assign it to the first widget in its organization
    for source_id, org_id, name in sources:
        # Find first widget for this organization
        cursor.execute("""
            SELECT id FROM widget_configs 
            WHERE organization_id = ? 
            ORDER BY created_at 
            LIMIT 1
        """, (org_id,))
        widget = cursor.fetchone()
        
        if widget:
            widget_id = widget[0]
            cursor.execute("""
                UPDATE knowledge_sources 
                SET widget_id = ? 
                WHERE id = ?
            """, (widget_id, source_id))
            print(f"✅ Assigned widget_id={widget_id} to source '{name}' (id={source_id}, org_id={org_id})")
        else:
            print(f"⚠️  No widget found for organization {org_id} - skipping source '{name}' (id={source_id})")
    
    conn.commit()
    
    # Verify
    cursor.execute("SELECT COUNT(*) FROM knowledge_sources WHERE widget_id IS NULL")
    remaining = cursor.fetchone()[0]
    
    print(f"\n{'='*60}")
    print(f"Backfill complete!")
    print(f"Knowledge sources still without widget_id: {remaining}")
    
    conn.close()

if __name__ == "__main__":
    main()
