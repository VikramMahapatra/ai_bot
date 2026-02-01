import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "chatbot.db")


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def add_column_if_missing(cursor, table: str, column_def: str):
    column_name = column_def.split()[0]
    if not column_exists(cursor, table, column_name):
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")


def backfill_widget_org(cursor):
    cursor.execute(
        """
        UPDATE widget_configs
        SET organization_id = (
            SELECT u.organization_id FROM users u WHERE u.id = widget_configs.user_id
        )
        WHERE organization_id IS NULL
        """
    )


def build_widget_map(cursor):
    cursor.execute(
        """
        SELECT wc.widget_id, wc.user_id, u.organization_id
        FROM widget_configs wc
        JOIN users u ON u.id = wc.user_id
        WHERE wc.widget_id IS NOT NULL
        """
    )
    return {row[0]: {"user_id": row[1], "organization_id": row[2]} for row in cursor.fetchall()}


def backfill_conversations(cursor, widget_map):
    for widget_id, meta in widget_map.items():
        cursor.execute(
            """
            UPDATE conversations
            SET organization_id = COALESCE(organization_id, ?),
                user_id = COALESCE(user_id, ?)
            WHERE widget_id = ? AND (organization_id IS NULL OR user_id IS NULL)
            """,
            (meta["organization_id"], meta["user_id"], widget_id),
        )


def backfill_leads(cursor, widget_map):
    for widget_id, meta in widget_map.items():
        cursor.execute(
            """
            UPDATE leads
            SET organization_id = COALESCE(organization_id, ?),
                user_id = COALESCE(user_id, ?)
            WHERE widget_id = ? AND (organization_id IS NULL OR user_id IS NULL)
            """,
            (meta["organization_id"], meta["user_id"], widget_id),
        )


def migrate():
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"Database not found at {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        add_column_if_missing(cur, "widget_configs", "organization_id INTEGER")
        add_column_if_missing(cur, "conversations", "user_id INTEGER")
        add_column_if_missing(cur, "conversations", "organization_id INTEGER")
        add_column_if_missing(cur, "leads", "user_id INTEGER")
        add_column_if_missing(cur, "leads", "organization_id INTEGER")

        backfill_widget_org(cur)
        widget_map = build_widget_map(cur)
        backfill_conversations(cur, widget_map)
        backfill_leads(cur, widget_map)

        conn.commit()
        print("Migration completed: org columns added and backfilled.")
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
