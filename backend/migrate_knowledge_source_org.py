import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "chatbot.db")


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def migrate():
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"Database not found at {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        # Add organization_id column if missing
        if not column_exists(cur, "knowledge_sources", "organization_id"):
            cur.execute("ALTER TABLE knowledge_sources ADD COLUMN organization_id INTEGER")
            print("Added organization_id column to knowledge_sources.")
        
        # Backfill organization_id from user
        cur.execute(
            """
            UPDATE knowledge_sources
            SET organization_id = (
                SELECT u.organization_id FROM users u WHERE u.id = knowledge_sources.user_id
            )
            WHERE organization_id IS NULL
            """
        )
        
        rows_updated = cur.rowcount
        print(f"Backfilled organization_id for {rows_updated} knowledge sources.")
        
        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
