from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

MIGRATION_ID = "2026_04_10_add_org_credit_payment_metadata"


def _table_exists(conn: Connection, table_name: str) -> bool:
    return inspect(conn).has_table(table_name)


def _column_exists(conn: Connection, table_name: str, column_name: str) -> bool:
    if not _table_exists(conn, table_name):
        return False
    columns = inspect(conn).get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade(conn: Connection) -> None:
    columns_to_add = {
        "payment_mode": "VARCHAR(64)",
        "payment_reference": "VARCHAR(120)",
        "payment_other_details": "TEXT",
    }

    for column_name, column_type in columns_to_add.items():
        if not _column_exists(conn, "org_credit_payments", column_name):
            conn.execute(
                text(f"ALTER TABLE org_credit_payments ADD COLUMN {column_name} {column_type}")
            )
