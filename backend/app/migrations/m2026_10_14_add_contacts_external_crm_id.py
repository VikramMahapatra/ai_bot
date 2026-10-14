"""Repair the nullable Contact CRM identifier without populating external IDs."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_10_14_add_contacts_external_crm_id"


def upgrade(conn: Connection) -> None:
    if conn.dialect.name not in {"postgresql", "sqlite"}:
        raise RuntimeError("Contact CRM identifier migration requires PostgreSQL or SQLite")
    inspector = inspect(conn)
    if not inspector.has_table("contacts"):
        raise RuntimeError("Missing contacts prerequisite table")
    # Matches campaign.Contact.external_crm_id: String(100), nullable=True.
    # PostgreSQL's IF NOT EXISTS also protects concurrent startup repairs.
    if conn.dialect.name == "postgresql":
        conn.execute(text(
            "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS external_crm_id VARCHAR(100) NULL"
        ))
    elif "external_crm_id" not in {
        column["name"] for column in inspector.get_columns("contacts")
    }:
        conn.execute(text(
            "ALTER TABLE contacts ADD COLUMN external_crm_id VARCHAR(100) NULL"
        ))