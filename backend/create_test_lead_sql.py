import sqlite3

conn = sqlite3.connect('chatbot.db')
c = conn.cursor()

# Get the widget we just created
c.execute("SELECT widget_id FROM widget_configs WHERE name = 'TechCore Test Widget'")
widget_row = c.fetchone()

if widget_row:
    widget_id = widget_row[0]
    
    # Insert a test lead using this widget
    c.execute("""
        INSERT INTO leads 
        (session_id, widget_id, name, email, phone, company)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        "test-session-123",
        widget_id,
        "John Doe",
        "john@example.com",
        "1234567890",
        "Test Company"
    ))
    
    conn.commit()
    
    # Now retrieve the lead to verify org/user were set
    c.execute("SELECT id, widget_id, user_id, organization_id, name FROM leads WHERE session_id = 'test-session-123'")
    lead = c.fetchone()
    
    if lead:
        print(f"✓ Test lead created via direct SQL (org/user should still be NULL):")
        print(f"  ID: {lead[0]}")
        print(f"  Widget ID: {lead[1]}")
        print(f"  User ID: {lead[2]}")
        print(f"  Organization ID: {lead[3]}")
        print(f"  Name: {lead[4]}")
        print("\nNote: These should be NULL because we inserted directly via SQL.")
        print("When using the API endpoint, the backend should resolve org/user from widget_id.")
    else:
        print("✗ Lead not found after insertion")
else:
    print("✗ Widget config not found")

conn.close()
