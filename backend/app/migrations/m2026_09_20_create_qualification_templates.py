from sqlalchemy import text
from sqlalchemy.engine import Connection


MIGRATION_ID = "2026_09_20_create_qualification_templates"


def upgrade(conn: Connection) -> None:
    conn.execute(
        text(
            """
            DO $$ BEGIN
                CREATE TYPE qualificationtemplatestatus AS ENUM ('active', 'inactive');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;

            CREATE TABLE IF NOT EXISTS qualification_templates (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT NULL,
                objective TEXT NOT NULL,
                qualification_mode VARCHAR(32) NOT NULL DEFAULT 'essential_supporting',
                temperature_mode VARCHAR(16) NOT NULL DEFAULT 'standard',
                status qualificationtemplatestatus NOT NULL DEFAULT 'active',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL,
                CONSTRAINT uq_qualification_templates_org_name UNIQUE (organization_id, name)
            );
            CREATE INDEX IF NOT EXISTS ix_qualification_templates_organization_id
                ON qualification_templates(organization_id);

            CREATE TABLE IF NOT EXISTS qualification_template_criteria (
                id SERIAL PRIMARY KEY,
                template_id INTEGER NOT NULL REFERENCES qualification_templates(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT NULL,
                is_required BOOLEAN NOT NULL DEFAULT TRUE,
                weight INTEGER NOT NULL DEFAULT 10,
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS ix_qualification_template_criteria_template_id
                ON qualification_template_criteria(template_id);

            CREATE TABLE IF NOT EXISTS qualification_template_attributes (
                id SERIAL PRIMARY KEY,
                template_id INTEGER NOT NULL REFERENCES qualification_templates(id) ON DELETE CASCADE,
                key VARCHAR(100) NOT NULL,
                label VARCHAR(255) NOT NULL,
                data_type VARCHAR(32) NOT NULL DEFAULT 'text',
                description TEXT NULL,
                is_required BOOLEAN NOT NULL DEFAULT FALSE,
                is_qualification_relevant BOOLEAN NOT NULL DEFAULT FALSE,
                importance VARCHAR(16) NOT NULL DEFAULT 'Supporting',
                currency VARCHAR(8) NULL,
                value_rule VARCHAR(16) NOT NULL DEFAULT 'any',
                min_value NUMERIC(18, 4) NULL,
                max_value NUMERIC(18, 4) NULL,
                options JSON NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT uq_qualification_attributes_template_key UNIQUE (template_id, key)
            );
            CREATE INDEX IF NOT EXISTS ix_qualification_template_attributes_template_id
                ON qualification_template_attributes(template_id);

            CREATE TABLE IF NOT EXISTS qualification_template_positive_signals (
                id SERIAL PRIMARY KEY,
                template_id INTEGER NOT NULL REFERENCES qualification_templates(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                signal_key VARCHAR(100) NULL,
                category VARCHAR(32) NOT NULL DEFAULT 'Interest',
                source VARCHAR(16) NOT NULL DEFAULT 'predefined',
                description TEXT NULL,
                score INTEGER NOT NULL DEFAULT 10,
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS ix_qualification_template_positive_signals_template_id
                ON qualification_template_positive_signals(template_id);

            CREATE TABLE IF NOT EXISTS qualification_template_disqualifiers (
                id SERIAL PRIMARY KEY,
                template_id INTEGER NOT NULL REFERENCES qualification_templates(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                criterion_key VARCHAR(100) NULL,
                source VARCHAR(16) NOT NULL DEFAULT 'predefined',
                description TEXT NULL,
                action VARCHAR(32) NOT NULL DEFAULT 'disqualify',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS ix_qualification_template_disqualifiers_template_id
                ON qualification_template_disqualifiers(template_id);

            CREATE TABLE IF NOT EXISTS qualification_template_temperatures (
                id SERIAL PRIMARY KEY,
                template_id INTEGER NOT NULL REFERENCES qualification_templates(id) ON DELETE CASCADE,
                name VARCHAR(32) NOT NULL,
                min_score INTEGER NOT NULL,
                max_score INTEGER NOT NULL,
                description TEXT NULL,
                color VARCHAR(16) NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT uq_qualification_temperatures_template_name UNIQUE (template_id, name)
            );
            CREATE INDEX IF NOT EXISTS ix_qualification_template_temperatures_template_id
                ON qualification_template_temperatures(template_id);
            """
        )
    )