from sqlalchemy import text
from sqlalchemy.engine import Connection
from typing import Callable

from app.migrations.m2026_04_08_drop_legacy_plan_artifacts import (
    MIGRATION_ID as DROP_LEGACY_PLAN_ARTIFACTS_ID,
    upgrade as drop_legacy_plan_artifacts_upgrade,
)
from app.migrations.m2026_04_08_drop_organization_numeric_limits import (
    MIGRATION_ID as DROP_ORG_NUMERIC_LIMITS_ID,
    upgrade as drop_org_numeric_limits_upgrade,
)
from app.migrations.m2026_04_09_add_organization_joining_dates import (
    MIGRATION_ID as ADD_ORG_JOINING_DATES_ID,
    upgrade as add_org_joining_dates_upgrade,
)
from app.migrations.m2026_04_09_create_org_credit_billing_tables import (
    MIGRATION_ID as CREATE_ORG_CREDIT_BILLING_TABLES_ID,
    upgrade as create_org_credit_billing_tables_upgrade,
)
from app.migrations.m2026_04_10_add_org_credit_payment_metadata import (
    MIGRATION_ID as ADD_ORG_CREDIT_PAYMENT_METADATA_ID,
    upgrade as add_org_credit_payment_metadata_upgrade,
)


MIGRATIONS: list[tuple[str, Callable[[Connection], None]]] = [
    (DROP_LEGACY_PLAN_ARTIFACTS_ID, drop_legacy_plan_artifacts_upgrade),
    (DROP_ORG_NUMERIC_LIMITS_ID, drop_org_numeric_limits_upgrade),
    (ADD_ORG_JOINING_DATES_ID, add_org_joining_dates_upgrade),
    (CREATE_ORG_CREDIT_BILLING_TABLES_ID, create_org_credit_billing_tables_upgrade),
    (ADD_ORG_CREDIT_PAYMENT_METADATA_ID, add_org_credit_payment_metadata_upgrade),
]


def apply_db_migrations(conn: Connection) -> None:
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id TEXT PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )

    applied_rows = conn.execute(text("SELECT id FROM schema_migrations")).fetchall()
    applied_ids = {str(row[0]) for row in applied_rows}

    for migration_id, migration_fn in MIGRATIONS:
        if migration_id in applied_ids:
            continue

        migration_fn(conn)
        conn.execute(
            text("INSERT INTO schema_migrations (id) VALUES (:id)"),
            {"id": migration_id},
        )
