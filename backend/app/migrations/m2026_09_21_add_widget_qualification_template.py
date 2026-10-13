from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_09_21_add_widget_qualification_template"


def upgrade(conn: Connection) -> None:
    columns = {column["name"] for column in inspect(conn).get_columns("widget_configs")}
    if "qualification_template_id" not in columns:
        conn.execute(
            text(
                "ALTER TABLE widget_configs "
                "ADD COLUMN qualification_template_id INTEGER NULL"
            )
        )
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_widget_configs_qualification_template_id "
            "ON widget_configs (qualification_template_id)"
        )
    )
