"""Isolated schema repair and local/external eligibility regressions."""

import ast
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import MetaData, create_engine, inspect, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from app.migrations import MIGRATIONS
from app.migrations import m2026_10_14_add_qualification_engine_metadata as migration
from app.models.qualification_templates import (
    DisqualificationCriterion, LeadTemperatureRule, QualificationAttribute,
    QualificationCriterion, QualificationPositiveSignal, QualificationTemplate,
    QualificationTemplateStatus,
)
from app.schemas.qualification_template import QualificationTemplateSummary
from app.services import qualification_template_service as service


MODELS = (
    QualificationTemplate, QualificationCriterion, QualificationAttribute,
    QualificationPositiveSignal, DisqualificationCriterion, LeadTemperatureRule,
)


def legacy_metadata():
    # Copy only qualification tables: never mutate shared ORM metadata or emit
    # unrelated enum/table DDL from its metadata event hooks.
    metadata = MetaData()
    from sqlalchemy import Column, Integer, Table
    Table("organizations", metadata, Column("id", Integer, primary_key=True))
    for model in MODELS:
        table = model.__table__.to_metadata(metadata)
        removed = migration.ADDITIONS.get(table.name, {})
        for index in list(table.indexes):
            if any(column.name in removed for column in index.columns):
                table.indexes.remove(index)
        for name in removed:
            table._columns.remove(table.c[name])
    return metadata


class QualificationMetadataMigrationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self.metadata = legacy_metadata()
        self.metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            conn.execute(self.metadata.tables["organizations"].insert(), {"id": 1})
            conn.execute(self.metadata.tables["qualification_templates"].insert(), {
                "id": 1, "organization_id": 1, "name": "Zen_template",
                "objective": "Existing objective", "description": "Keep me",
                "status": QualificationTemplateStatus.active,
                "created_at": datetime(2026, 1, 1),
            })
            for model in MODELS[1:]:
                table = self.metadata.tables[model.__tablename__]
                values = {"id": 1, "template_id": 1}
                if model is QualificationAttribute:
                    values.update(key="budget", label="Budget", options=["existing"])
                elif model is LeadTemperatureRule:
                    values.update(name="Cold", min_score=1, max_score=39, color="#4b86c6")
                else:
                    values.update(name="Existing rule")
                conn.execute(table.insert(), values)

    def tearDown(self):
        self.engine.dispose()

    def test_additive_defaults_preserve_every_old_column_and_row(self):
        with self.engine.begin() as conn:
            before = {table.name: conn.execute(select(table)).mappings().all()
                      for table in self.metadata.sorted_tables}
            migration.upgrade(conn)
            migration.upgrade(conn)
            for table in self.metadata.sorted_tables:
                self.assertEqual(conn.execute(select(table)).mappings().all(), before[table.name])
            for model in MODELS:
                self.assertEqual(
                    {column["name"] for column in inspect(conn).get_columns(model.__tablename__)},
                    set(model.__table__.columns.keys()),
                )
            row = conn.execute(text("SELECT * FROM qualification_templates")).mappings().one()
            self.assertEqual(row["version"], 1)
            self.assertEqual(row["sync_status"], "pending")
            for name in ("engine_template_id", "sync_error", "last_synced_at"):
                self.assertIsNone(row[name])
            for table in list(migration.ADDITIONS)[1:]:
                self.assertIsNone(conn.execute(text(f"SELECT rule FROM {table}")).scalar())
            index = inspect(conn).get_indexes("qualification_templates")
            self.assertTrue(any(item["column_names"] == ["engine_template_id"] for item in index))
        with Session(self.engine) as db:
            template = service.get_template(db, 1, 1)
            self.assertEqual(template.criteria[0].name, "Existing rule")
            self.assertIsNone(template.criteria[0].rule)
            self.assertEqual(template.attributes[0].options, ["existing"])
            self.assertEqual(QualificationTemplateSummary.model_validate(template).sync_status, "pending")

    def test_rerun_preserves_real_sync_metadata_and_rule_json(self):
        with self.engine.begin() as conn:
            migration.upgrade(conn)
            conn.execute(text(
                "UPDATE qualification_templates SET engine_template_id='real-engine-id', "
                "version=7, sync_status='synced', sync_error='keep', "
                "last_synced_at='2026-10-01 12:00:00'"
            ))
            for table in list(migration.ADDITIONS)[1:]:
                conn.execute(text(f"UPDATE {table} SET rule=:rule"), {"rule": '{"any_of":["existing"]}'})
            before = {table: conn.execute(text(f"SELECT * FROM {table}")).mappings().all()
                      for table in migration.ADDITIONS}
            migration.upgrade(conn)
            for table in migration.ADDITIONS:
                self.assertEqual(conn.execute(text(f"SELECT * FROM {table}")).mappings().all(), before[table])

    def test_missing_prerequisite_fails_before_altering_parent(self):
        with self.engine.begin() as conn:
            conn.execute(text("DROP TABLE qualification_template_disqualifiers"))
            with self.assertRaisesRegex(RuntimeError, "prerequisite"):
                migration.upgrade(conn)
            self.assertNotIn("sync_status", {c["name"] for c in inspect(conn).get_columns("qualification_templates")})

    def test_offline_postgres_exact_bounded_ddl_and_registration(self):
        statements = []
        conn = SimpleNamespace(dialect=postgresql.dialect(), execute=lambda sql: statements.append(str(sql.compile(dialect=postgresql.dialect()))))
        inspector = SimpleNamespace(has_table=lambda table: True, get_columns=lambda table: [])
        with patch.object(migration, "inspect", return_value=inspector):
            migration.upgrade(conn)
        self.assertEqual(len(statements), 9)
        self.assertIn('"last_synced_at" TIMESTAMP WITH TIME ZONE NULL', statements[4])
        self.assertIn("\"sync_status\" VARCHAR(32) NOT NULL DEFAULT 'pending'", statements[2])
        for sql in statements[5:8]:
            self.assertTrue(sql.endswith('ADD COLUMN "rule" JSON NULL'))
        self.assertFalse(any(word in " ".join(statements).upper() for word in ("DROP ", "UPDATE ", "COMMIT", "JSONB")))
        self.assertEqual(sum(mid == migration.MIGRATION_ID for mid, _ in MIGRATIONS), 1)

    def test_local_active_eligibility_keeps_external_default_and_org_isolation(self):
        with self.engine.begin() as conn:
            migration.upgrade(conn)
        with Session(self.engine) as db:
            db.add_all([
                QualificationTemplate(id=2, organization_id=1, name="Synced", objective="Sales", sync_status="synced"),
                QualificationTemplate(id=3, organization_id=1, name="Inactive", objective="Sales", status=QualificationTemplateStatus.inactive, sync_status="synced"),
                QualificationTemplate(id=4, organization_id=2, name="Other org", objective="Sales", sync_status="synced"),
                QualificationTemplate(id=5, organization_id=1, name="Failed", objective="Sales", sync_status="failed"),
            ])
            db.commit()
            self.assertEqual({t.id for t in service.template_lookup(db, 1)}, {2})
            self.assertEqual({t.id for t in service.template_lookup(db, 1, require_synced=False)}, {1, 2, 5})
            self.assertEqual({t.id for t in service.list_templates(db, 1, None, "Active", 0, 100)["items"]}, {1, 2, 5})
            # Execute the unchanged chat-parent validator in isolation: importing
            # app.api.admin would initialize unrelated integrations.
            source = Path(__file__).parent / "app/api/admin.py"
            tree = ast.parse(source.read_text(encoding="utf-8"))
            function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_validate_qualification_template")
            namespace = {"Session": Session, "HTTPException": HTTPException, "QualificationTemplate": QualificationTemplate, "QualificationTemplateStatus": QualificationTemplateStatus}
            exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), "exec"), namespace)
            validator = namespace["_validate_qualification_template"]
            self.assertEqual(validator(db, 1, 1), 1)
            for template_id in (3, 4, 999):
                with self.assertRaises(HTTPException) as raised:
                    validator(db, template_id, 1)
                self.assertEqual(raised.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()