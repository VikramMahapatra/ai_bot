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
from app.migrations.m2026_09_20_create_qualification_templates import (
    MIGRATION_ID as CREATE_QUALIFICATION_TEMPLATES_ID,
    upgrade as create_qualification_templates_upgrade,
)
from app.migrations.m2026_09_20_extend_qualification_criteria import (
    MIGRATION_ID as EXTEND_QUALIFICATION_CRITERIA_ID,
    upgrade as extend_qualification_criteria_upgrade,
)
from app.migrations.m2026_09_20_extend_qualification_attributes import (
    MIGRATION_ID as EXTEND_QUALIFICATION_ATTRIBUTES_ID,
    upgrade as extend_qualification_attributes_upgrade,
)
from app.migrations.m2026_09_20_extend_positive_signals import (
    MIGRATION_ID as EXTEND_POSITIVE_SIGNALS_ID,
    upgrade as extend_positive_signals_upgrade,
)
from app.migrations.m2026_09_20_extend_disqualification_criteria import (
    MIGRATION_ID as EXTEND_DISQUALIFICATION_CRITERIA_ID,
    upgrade as extend_disqualification_criteria_upgrade,
)
from app.migrations.m2026_09_20_add_temperature_mode import (
    MIGRATION_ID as ADD_TEMPERATURE_MODE_ID,
    upgrade as add_temperature_mode_upgrade,
)


MIGRATIONS: list[tuple[str, Callable[[Connection], None]]] = [
    (DROP_LEGACY_PLAN_ARTIFACTS_ID, drop_legacy_plan_artifacts_upgrade),
    (DROP_ORG_NUMERIC_LIMITS_ID, drop_org_numeric_limits_upgrade),
    (ADD_ORG_JOINING_DATES_ID, add_org_joining_dates_upgrade),
    (CREATE_ORG_CREDIT_BILLING_TABLES_ID, create_org_credit_billing_tables_upgrade),
    (ADD_ORG_CREDIT_PAYMENT_METADATA_ID, add_org_credit_payment_metadata_upgrade),
    (CREATE_QUALIFICATION_TEMPLATES_ID, create_qualification_templates_upgrade),
    (EXTEND_QUALIFICATION_CRITERIA_ID, extend_qualification_criteria_upgrade),
    (EXTEND_QUALIFICATION_ATTRIBUTES_ID, extend_qualification_attributes_upgrade),
    (EXTEND_POSITIVE_SIGNALS_ID, extend_positive_signals_upgrade),
    (EXTEND_DISQUALIFICATION_CRITERIA_ID, extend_disqualification_criteria_upgrade),
    (ADD_TEMPERATURE_MODE_ID, add_temperature_mode_upgrade),
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
    conn.execute(text("COMMIT"))
    
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
