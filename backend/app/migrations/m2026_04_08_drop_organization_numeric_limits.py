from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

MIGRATION_ID = "2026_04_08_drop_organization_numeric_limits"


def _table_exists(conn: Connection, table_name: str) -> bool:
    return inspect(conn).has_table(table_name)


def _column_exists(conn: Connection, table_name: str, column_name: str) -> bool:
    if not _table_exists(conn, table_name):
        return False
    columns = inspect(conn).get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade(conn: Connection) -> None:
    columns_to_drop = [
        "monthly_conversation_limit",
        "monthly_crawl_pages_limit",
        "max_crawl_depth",
        "monthly_document_limit",
        "max_document_size_mb",
        "monthly_token_limit",
        "max_query_words",
        "max_agents",
        "max_campaigns",
        "max_calls",
    ]

    for column_name in columns_to_drop:
        if _column_exists(conn, "organization_limits", column_name):
            conn.execute(
                text(f"ALTER TABLE organization_limits DROP COLUMN {column_name}")
            )
