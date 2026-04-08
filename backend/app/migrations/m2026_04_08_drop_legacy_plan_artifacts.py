from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

MIGRATION_ID = "2026_04_08_drop_legacy_plan_artifacts"


def _table_exists(conn: Connection, table_name: str) -> bool:
    return inspect(conn).has_table(table_name)


def _column_exists(conn: Connection, table_name: str, column_name: str) -> bool:
    if not _table_exists(conn, table_name):
        return False
    columns = inspect(conn).get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade(conn: Connection) -> None:
    # 1) Remove legacy organization override linkage to plan.
    if _column_exists(conn, "organization_limits", "plan_id"):
        conn.execute(text("ALTER TABLE organization_limits DROP COLUMN plan_id"))

    # 2) Remove legacy subscription linkage to plan.
    if _column_exists(conn, "organization_subscriptions", "plan_id"):
        conn.execute(text("ALTER TABLE organization_subscriptions DROP COLUMN plan_id"))

    # 3) Remove plans table now that limits are organization-owned.
    if _table_exists(conn, "plans"):
        conn.execute(text("DROP TABLE plans"))
