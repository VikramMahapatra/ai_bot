import sqlite3

conn = sqlite3.connect('chatbot.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

print("=== Widget Configs ===")
c.execute("SELECT widget_id, user_id, organization_id FROM widget_configs LIMIT 5")
rows = c.fetchall()
if rows:
    for row in rows:
        print(f"widget_id: {row['widget_id']}, user_id: {row['user_id']}, org_id: {row['organization_id']}")
else:
    print("No widget configs found")

print("\n=== Recent Leads ===")
c.execute("SELECT id, widget_id, user_id, organization_id FROM leads ORDER BY id DESC LIMIT 5")
rows = c.fetchall()
if rows:
    for row in rows:
        print(f"id: {row['id']}, widget_id: {row['widget_id']}, user_id: {row['user_id']}, org_id: {row['organization_id']}")
else:
    print("No leads found")

conn.close()
