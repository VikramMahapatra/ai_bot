from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_09_20_extend_qualification_criteria"


def _column_names(conn: Connection, table_name: str) -> set[str]:
    return {column["name"] for column in inspect(conn).get_columns(table_name)}


def upgrade(conn: Connection) -> None:
    template_columns = _column_names(conn, "qualification_templates")
    if "qualification_mode" not in template_columns:
        conn.execute(
            text(
                "ALTER TABLE qualification_templates "
                "ADD COLUMN qualification_mode VARCHAR(32) NOT NULL "
                "DEFAULT 'essential_supporting'"
            )
        )

    criterion_columns = _column_names(conn, "qualification_template_criteria")
    additions = {
        "criterion_key": "VARCHAR(100) NULL",
        "source": "VARCHAR(16) NOT NULL DEFAULT 'predefined'",
        "importance": "VARCHAR(16) NOT NULL DEFAULT 'Essential'",
    }
    for column_name, definition in additions.items():
        if column_name not in criterion_columns:
            conn.execute(
                text(
                    f"ALTER TABLE qualification_template_criteria "
                    f"ADD COLUMN {column_name} {definition}"
                )
            )

    conn.execute(
        text(
            "UPDATE qualification_template_criteria "
            "SET importance = CASE WHEN is_required THEN 'Essential' ELSE 'Supporting' END"
        )
    )