"""Add local template engine metadata and optional rules; never infer a sync."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_10_14_add_qualification_engine_metadata"

# Explicit, bounded repair: no ORM create_all, old migrations, or data updates.
ADDITIONS = {
    "qualification_templates": {
        "engine_template_id": "VARCHAR(100) NULL",
        "version": "INTEGER NOT NULL DEFAULT 1",
        "sync_status": "VARCHAR(32) NOT NULL DEFAULT 'pending'",
        "sync_error": "TEXT NULL",
        "last_synced_at": "TIMESTAMP WITH TIME ZONE NULL",
    },
    "qualification_template_criteria": {"rule": "JSON NULL"},
    "qualification_template_positive_signals": {"rule": "JSON NULL"},
    "qualification_template_disqualifiers": {"rule": "JSON NULL"},
}


def upgrade(conn: Connection) -> None:
    if conn.dialect.name not in {"postgresql", "sqlite"}:
        raise RuntimeError("Qualification metadata migration requires PostgreSQL or SQLite")
    inspector = inspect(conn)
    # Refuse an incomplete prerequisite schema before issuing any DDL.
    missing_tables = [table for table in ADDITIONS if not inspector.has_table(table)]
    if missing_tables:
        raise RuntimeError(f"Missing qualification prerequisite tables: {missing_tables}")
    existing = {
        table: {column["name"] for column in inspector.get_columns(table)}
        for table in ADDITIONS
    }
    for table, columns in ADDITIONS.items():
        for name, definition in columns.items():
            if name not in existing[table]:
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {definition}'))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_qualification_templates_engine_template_id "
        "ON qualification_templates (engine_template_id)"
    ))