from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

MIGRATION_ID = "2026_04_09_add_organization_joining_dates"


def _table_exists(conn: Connection, table_name: str) -> bool:
    return inspect(conn).has_table(table_name)


def _column_exists(conn: Connection, table_name: str, column_name: str) -> bool:
    if not _table_exists(conn, table_name):
        return False
    columns = inspect(conn).get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade(conn: Connection) -> None:
    columns_to_add = {
        "joining_date": "DATE",
        "effective_joining_date": "DATE",
    }

    for column_name, column_type in columns_to_add.items():
        if not _column_exists(conn, "organizations", column_name):
            conn.execute(
                text(f"ALTER TABLE organizations ADD COLUMN {column_name} {column_type}")
            )
