from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_09_20_add_temperature_mode"


def upgrade(conn: Connection) -> None:
    columns = {
        column["name"]
        for column in inspect(conn).get_columns("qualification_templates")
    }
    if "temperature_mode" not in columns:
        conn.execute(
            text(
                "ALTER TABLE qualification_templates "
                "ADD COLUMN temperature_mode VARCHAR(16) NOT NULL DEFAULT 'standard'"
            )
        )
        conn.execute(
            text("UPDATE qualification_templates SET temperature_mode = 'custom'")
        )

    conn.execute(
        text(
            "UPDATE qualification_template_temperatures "
            "SET min_score = 1 WHERE min_score < 1"
        )
    )