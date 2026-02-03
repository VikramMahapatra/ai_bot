import sqlite3

conn = sqlite3.connect('chatbot.db')
cursor = conn.cursor()

# List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
print('Database tables:')
for t in tables:
    print(f'  - {t[0]}')

# Check knowledge sources
cursor.execute('SELECT COUNT(*) FROM knowledge_sources WHERE widget_id IS NULL')
null_count = cursor.fetchone()[0]
cursor.execute('SELECT COUNT(*) FROM knowledge_sources')
total_count = cursor.fetchone()[0]

print(f'\nKnowledge sources:')
print(f'  Total: {total_count}')
print(f'  Without widget_id: {null_count}')

conn.close()
