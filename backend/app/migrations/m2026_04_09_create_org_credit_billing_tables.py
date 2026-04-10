from sqlalchemy import text
from sqlalchemy.engine import Connection

MIGRATION_ID = "2026_04_09_create_org_credit_billing_tables"


def upgrade(conn: Connection) -> None:
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS org_credits (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                estimator_id INTEGER NOT NULL REFERENCES credit_estimator_shares(id) ON DELETE RESTRICT,
                parent_org_credit_id INTEGER NULL REFERENCES org_credits(id) ON DELETE SET NULL,
                total_credit DOUBLE PRECISION NOT NULL DEFAULT 0,
                billing_cycle VARCHAR(16) NOT NULL DEFAULT 'monthly',
                payment_status VARCHAR(16) NOT NULL DEFAULT 'unpaid',
                billing_start_date DATE NOT NULL,
                billing_end_date DATE NOT NULL,
                billing_month VARCHAR(16) NOT NULL,
                is_topup BOOLEAN NOT NULL DEFAULT FALSE,
                topup_credit DOUBLE PRECISION NULL,
                is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
                notes VARCHAR(500) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL
            )
            """
        )
    )

    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credits_org_id ON org_credits(organization_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credits_estimator_id ON org_credits(estimator_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credits_parent ON org_credits(parent_org_credit_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credits_month ON org_credits(billing_month)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credits_period ON org_credits(billing_start_date, billing_end_date)"))

    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS org_credit_invoices (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                org_credit_id INTEGER NOT NULL REFERENCES org_credits(id) ON DELETE CASCADE,
                reference_invoice_id INTEGER NULL REFERENCES org_credit_invoices(id) ON DELETE SET NULL,
                total_credit DOUBLE PRECISION NOT NULL DEFAULT 0,
                invoice_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
                paid_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
                billing_month VARCHAR(16) NOT NULL,
                invoice_date DATE NOT NULL,
                payment_done_flag BOOLEAN NOT NULL DEFAULT FALSE,
                notes VARCHAR(500) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL
            )
            """
        )
    )

    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_invoices_org_id ON org_credit_invoices(organization_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_invoices_credit_id ON org_credit_invoices(org_credit_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_invoices_reference ON org_credit_invoices(reference_invoice_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_invoices_month ON org_credit_invoices(billing_month)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_invoices_status ON org_credit_invoices(payment_done_flag)"))

    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS org_credit_payments (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                invoice_id INTEGER NOT NULL REFERENCES org_credit_invoices(id) ON DELETE CASCADE,
                full_partial VARCHAR(16) NOT NULL,
                invoice_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
                actual_payment DOUBLE PRECISION NOT NULL DEFAULT 0,
                actual_credit DOUBLE PRECISION NOT NULL DEFAULT 0,
                payment_date DATE NOT NULL,
                payment_details TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL
            )
            """
        )
    )

    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_payments_org_id ON org_credit_payments(organization_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_payments_invoice_id ON org_credit_payments(invoice_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_payments_type ON org_credit_payments(full_partial)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_payments_date ON org_credit_payments(payment_date)"))

    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS org_credit_balances (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                billing_period VARCHAR(16) NOT NULL,
                total_credit DOUBLE PRECISION NOT NULL DEFAULT 0,
                used_credit DOUBLE PRECISION NOT NULL DEFAULT 0,
                remaining_credit DOUBLE PRECISION NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL,
                CONSTRAINT uq_org_credit_balances_org_period UNIQUE (organization_id, billing_period)
            )
            """
        )
    )

    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_balances_org_id ON org_credit_balances(organization_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_org_credit_balances_period ON org_credit_balances(billing_period)"))
