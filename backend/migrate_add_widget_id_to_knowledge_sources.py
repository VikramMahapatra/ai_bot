"""Add widget_id column to knowledge_sources if missing."""
import sqlite3
import os
from app.config import settings


def column_exists(cursor, table_name, column_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return any(row[1] == column_name for row in cursor.fetchall())


def _resolve_db_path() -> str:
    database_url = settings.DATABASE_URL
    if not database_url.startswith("sqlite:///"):
        raise ValueError("This migration script only supports sqlite databases")
    db_path = database_url.replace("sqlite:///", "")
    # Remove leading ./ if present
    if db_path.startswith("./"):
        db_path = db_path[2:]
    if not os.path.isabs(db_path):
        # Get the backend directory (where this script is)
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(backend_dir, db_path)
    return db_path


def main():
    db_path = _resolve_db_path()
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found at {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    if column_exists(cursor, "knowledge_sources", "widget_id"):
        print("widget_id column already exists on knowledge_sources")
        conn.close()
        return

    cursor.execute("ALTER TABLE knowledge_sources ADD COLUMN widget_id TEXT")
    conn.commit()
    conn.close()
    print("Added widget_id column to knowledge_sources")


if __name__ == "__main__":
    main()
