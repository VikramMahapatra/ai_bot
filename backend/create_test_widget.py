import sqlite3
import uuid

# Connect to the database
conn = sqlite3.connect('chatbot.db')
c = conn.cursor()

# Get an admin user (viki from TechCore org)
c.execute("SELECT id, organization_id FROM users WHERE username = 'viki' AND role = 'ADMIN'")
user_row = c.fetchone()

if user_row:
    user_id, org_id = user_row
    widget_id = str(uuid.uuid4())
    
    # Insert a widget config for this user/org
    c.execute("""
        INSERT INTO widget_configs 
        (user_id, organization_id, widget_id, name, welcome_message, primary_color, secondary_color, position, lead_capture_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, 
        org_id, 
        widget_id,
        "TechCore Test Widget",
        "Hello! How can I help you today?",
        "#007bff",
        "#6c757d",
        "bottom-right",
        1
    ))
    
    conn.commit()
    print(f"✓ Created widget config:")
    print(f"  Widget ID: {widget_id}")
    print(f"  User ID: {user_id}")
    print(f"  Organization ID: {org_id}")
else:
    print("✗ User 'viki' not found")

conn.close()
