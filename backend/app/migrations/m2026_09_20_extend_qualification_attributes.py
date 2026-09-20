from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_09_20_extend_qualification_attributes"


def upgrade(conn: Connection) -> None:
    columns = {
        column["name"]
        for column in inspect(conn).get_columns("qualification_template_attributes")
    }
    additions = {
        "is_qualification_relevant": "BOOLEAN NOT NULL DEFAULT FALSE",
        "importance": "VARCHAR(16) NOT NULL DEFAULT 'Supporting'",
        "currency": "VARCHAR(8) NULL",
        "value_rule": "VARCHAR(16) NOT NULL DEFAULT 'any'",
        "min_value": "NUMERIC(18, 4) NULL",
        "max_value": "NUMERIC(18, 4) NULL",
    }
    for column_name, definition in additions.items():
        if column_name not in columns:
            conn.execute(
                text(
                    f"ALTER TABLE qualification_template_attributes "
                    f"ADD COLUMN {column_name} {definition}"
                )
            )