"""Create ONLY owned tables. No legacy changes or data backfill."""
from sqlalchemy.engine import Connection
from sqlalchemy import inspect
from sqlalchemy.schema import AddConstraint

MIGRATION_ID = "2026_10_13_create_structured_datasets"


def upgrade(conn: Connection) -> None:
    # Lazy import avoids the database -> migrations -> models circular import.
    from app.models.structured_dataset import owned_metadata
    metadata = owned_metadata()
    tables = [metadata.tables[name] for name in (
        "structured_datasets", "structured_dataset_versions", "structured_dataset_rows")]
    metadata.create_all(conn, tables=tables, checkfirst=True)
    # create_all skips constraints on an already-existing table. Repair an owned
    # deferred FK left absent by a partial/bootstrap creation, without re-adding
    # it on normal reruns. SQLite emits this FK inline and has no ALTER support.
    if conn.dialect.name == "postgresql":
        table = metadata.tables["structured_datasets"]
        names = {fk["name"] for fk in inspect(conn).get_foreign_keys(table.name, schema=table.schema)}
        if "fk_sd_active_scope" not in names:
            constraint = next(c for c in table.constraints if c.name == "fk_sd_active_scope")
            conn.execute(AddConstraint(constraint))