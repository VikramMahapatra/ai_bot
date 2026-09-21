from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_09_20_extend_positive_signals"


def upgrade(conn: Connection) -> None:
    columns = {
        column["name"]
        for column in inspect(conn).get_columns(
            "qualification_template_positive_signals"
        )
    }
    additions = {
        "signal_key": "VARCHAR(100) NULL",
        "category": "VARCHAR(32) NOT NULL DEFAULT 'Interest'",
        "source": "VARCHAR(16) NOT NULL DEFAULT 'predefined'",
    }
    for column_name, definition in additions.items():
        if column_name not in columns:
            conn.execute(
                text(
                    f"ALTER TABLE qualification_template_positive_signals "
                    f"ADD COLUMN {column_name} {definition}"
                )
            )