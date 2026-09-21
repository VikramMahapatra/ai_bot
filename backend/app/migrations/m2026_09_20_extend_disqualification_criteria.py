from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_09_20_extend_disqualification_criteria"


def upgrade(conn: Connection) -> None:
    columns = {
        column["name"]
        for column in inspect(conn).get_columns(
            "qualification_template_disqualifiers"
        )
    }
    additions = {
        "criterion_key": "VARCHAR(100) NULL",
        "source": "VARCHAR(16) NOT NULL DEFAULT 'predefined'",
    }
    for column_name, definition in additions.items():
        if column_name not in columns:
            conn.execute(
                text(
                    f"ALTER TABLE qualification_template_disqualifiers "
                    f"ADD COLUMN {column_name} {definition}"
                )
            )