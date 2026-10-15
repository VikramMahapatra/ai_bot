"""Hard cleanup exclusively for deletion of an already-authorized parent agent.

Core statements intentionally bypass published-record ORM immutability guards.
The caller owns the transaction; no feature flag, commit, or rollback is applied.
No model/config imports are needed on deployments predating the dataset tables.
"""
from sqlalchemy import Integer, String, column, delete, inspect, table, update
from sqlalchemy.orm import Session


STRUCTURED_DATASET_TABLES = (
    "structured_datasets",
    "structured_dataset_versions",
    "structured_dataset_rows",
)

_DATASETS = table(
    STRUCTURED_DATASET_TABLES[0],
    column("organization_id", Integer),
    column("widget_id", String),
    column("active_version_id", Integer),
)
_VERSIONS = table(
    STRUCTURED_DATASET_TABLES[1],
    column("organization_id", Integer),
    column("widget_id", String),
)
_ROWS = table(
    STRUCTURED_DATASET_TABLES[2],
    column("organization_id", Integer),
    column("widget_id", String),
)


def purge_agent_datasets(db: Session, organization_id: int, widget_id: str) -> None:
    """Remove all dataset history, including soft-deleted data, in this scope.

    Invoke only after checking parent ownership and before deleting that parent.
    Use the session's connection for inspection AND writes to preserve rollback
    and avoid an inspector opening a separate connection/transaction.
    """
    connection = db.connection()
    inspector = inspect(connection)
    present = [inspector.has_table(name) for name in STRUCTURED_DATASET_TABLES]
    if not any(present):
        return
    if not all(present):
        raise RuntimeError("Structured dataset schema is incomplete; cannot safely delete agent")

    connection.execute(
        update(_DATASETS).where(
            _DATASETS.c.organization_id == organization_id,
            _DATASETS.c.widget_id == widget_id,
        ).values(active_version_id=None)
    )
    for target in (_ROWS, _VERSIONS, _DATASETS):
        connection.execute(delete(target).where(
            target.c.organization_id == organization_id,
            target.c.widget_id == widget_id,
        ))