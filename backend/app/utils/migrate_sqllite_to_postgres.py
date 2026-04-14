# migrate_sqllite_to_postgres.py
import os
import sqlite3
from sqlalchemy import create_engine, text, inspect
from app.config import settings

# --- Configure DB connections ---
SQLITE_DB_PATH = os.path.abspath('./chatbot.db')
POSTGRES_URI = (
    f"postgresql+psycopg2://{settings.DB_USER}:{settings.DB_PASS}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    f"?sslmode={settings.DB_SSLMODE or 'prefer'}"
)

sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
sqlite_conn.row_factory = sqlite3.Row
pg_engine = create_engine(POSTGRES_URI)
pg_db = pg_engine.connect()

# --- Define FK-safe table order ---
TABLE_MIGRATION_ORDER = [
    "plans", "organizations", "super_admins", "users", "contact_lists", "products", "voices",
    "funnel_categories", "organization_limits", "organization_subscriptions", "widget_configs",
    "whatsapp_channels", "twilio_sms_channels", "contacts", "campaigns",  "calling_agents", "call_campaigns", "campaign_schedules",
    "campaign_lead_rules", "campaign_contacts", "leads", "campaign_logs", "campaign_lead_conversions",
    "campaign_key_insights", "campaign_sentiments", "campaign_ai_recommendations", 
    "handoff_agent_assignments", "handoff_sessions", "handoff_messages", "conversation_metrics",
    "message_feedback", "call_logs", "call_transcripts", "appointments", "appointment_intakes",
    "calling_agent_test_calls", "organization_usage", "organization_calling_numbers",
]

# --- Helper to check FK existence ---
def parent_exists(table, key_column, key_value):
    if key_value is None:
        return False
    result = pg_db.execute(
        text(f"SELECT 1 FROM {table} WHERE {key_column} = :val LIMIT 1"),
        {"val": key_value}
    ).fetchone()
    return result is not None


def get_notnull_columns(table_name):
    inspector = inspect(pg_engine)
    cols = inspector.get_columns(table_name)
    return [c['name'] for c in cols if not c['nullable']]

def fill_defaults_for_notnull(row, table_name):
    notnull_cols = get_notnull_columns(table_name)
    for col in notnull_cols:
        if col not in row or row[col] is None:
            # Dynamically generate a simple default based on type or column name
            if 'id' in col.lower():
                row[col] = 0
            elif 'domain' in col.lower():
                row[col] = f"default-{row.get('id', 0)}"
            elif 'name' in col.lower():
                row[col] = "Unknown"
            elif 'active' in col.lower():
                row[col] = True
            else:
                row[col] = ""
    return row



def get_boolean_columns(table_name):
    """
    Returns a list of column names in PostgreSQL table that are BOOLEAN type.
    """
    inspector = inspect(pg_engine)
    columns_info = inspector.get_columns(table_name)
    boolean_cols = [col['name'] for col in columns_info if str(col['type']).lower() == 'boolean']
    return boolean_cols

def cast_booleans_dynamic(row, table_name):
    """
    Convert integer values in SQLite row to actual booleans for PostgreSQL.
    """
    bool_cols = get_boolean_columns(table_name)
    for col in bool_cols:
        if col in row and row[col] is not None:
            row[col] = bool(row[col])
    return row

# --- Convert SQLite row to dict with proper types ---
def row_to_dict(row, table_name=None):
    d = {k: row[k] for k in row.keys()}

    # Handle booleans (Postgres expects True/False)
    BOOLEAN_COLUMNS_BY_TABLE = {
        "plans": [
            "is_active", "lead_generation_enabled", "voice_chat_enabled",
            "multilingual_text_enabled", "whatsapp_enabled", "human_handoff_enabled",
            "email_campaign_enabled", "sms_campaign_enabled",
            "module_knowledge_enabled", "module_leads_enabled", "module_analytics_enabled",
            "module_advanced_analytics_enabled", "module_reports_enabled",
            "module_campaigns_enabled", "module_appointments_enabled",
            "module_products_enabled", "module_users_enabled",
        ],
        "users": ["is_active", "is_superuser"],
        "contacts": ["is_active"],
    }

    if table_name in BOOLEAN_COLUMNS_BY_TABLE:
        for col in BOOLEAN_COLUMNS_BY_TABLE[table_name]:
            if col in d and d[col] is not None:
                d[col] = bool(d[col])

    return d

def cast_and_fill_row(row, table_name):
    row = cast_booleans_dynamic(row, table_name)
    row = fill_defaults_for_notnull(row, table_name)
    return row
from sqlalchemy import inspect, text

inspector = inspect(pg_engine)


# --- Generate INSERT statements with dynamic FK checks ---
def generate_insert_statement(table_name, rows):
    if not rows:
        return None, []

    filtered_rows = []

    # Get foreign keys dynamically
    fks = inspector.get_foreign_keys(table_name)

    for row in rows:
        valid = True

        for fk in fks:
            col = fk["constrained_columns"][0]
            parent_table = fk["referred_table"]
            parent_col = fk["referred_columns"][0]

            # Skip if column not present
            if col not in row:
                continue

            # Skip NULL values (nullable FK)
            if row.get(col) is None:
                continue

            if not parent_exists(parent_table, parent_col, row[col]):
                valid = False
                break

        if valid:
            filtered_rows.append(row)

    if not filtered_rows:
        return None, []

    # Build INSERT SQL
    columns = filtered_rows[0].keys()
    col_list = ", ".join(columns)
    val_list = ", ".join([f":{c}" for c in columns])

    stmt = text(f"""
        INSERT INTO {table_name} ({col_list})
        VALUES ({val_list})
        ON CONFLICT (id) DO NOTHING
    """)

    return stmt, filtered_rows

# --- Migration Loop ---
CHUNK_SIZE = 200  # safe batch inserts for large tables
with pg_db.begin():
    for table_name in TABLE_MIGRATION_ORDER:
        sqlite_rows = [
            cast_and_fill_row(dict(r), table_name)
            for r in sqlite_conn.execute(f"SELECT * FROM {table_name}").fetchall()
        ]

        stmt, rows_to_insert = generate_insert_statement(table_name, sqlite_rows)

        if stmt is None:  # explicitly check None
            print(f"⚠️ Skipped {table_name}: no valid rows after FK check")
            continue

        # Insert in chunks
        for i in range(0, len(rows_to_insert), CHUNK_SIZE):
            chunk = rows_to_insert[i:i+CHUNK_SIZE]
            pg_db.execute(stmt, chunk)

        print(f"✅ Migrated {len(rows_to_insert)} rows into {table_name}")

print("🎉 Migration completed!")