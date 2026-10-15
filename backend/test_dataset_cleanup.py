"""Isolated SQLite FK regression tests; PostgreSQL compilation only.

Load owned source directly and extract deletion handlers with AST: never import
app.database, app.config, eager package initializers, migrations, or app.main.
All executed SQL targets disposable SQLite :memory: databases.
"""
import ast
import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException
from sqlalchemy import (
    Column, ForeignKey, Integer, String, create_engine, event, inspect,
    select, text,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, declarative_base


ROOT = Path(__file__).resolve().parent


def load_source(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cleanup = load_source("isolated_dataset_cleanup", ROOT / "app/services/structured_dataset_cleanup.py")
Base = declarative_base()


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True)


class WidgetConfig(Base):
    __tablename__ = "widget_configs"
    widget_id = Column(String, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)


# Actual dataset models and guards, but a disposable Base and parent placeholders.
database_stub = types.ModuleType("app.database")
database_stub.Base = Base
with patch.dict(sys.modules, {"app.database": database_stub}):
    models = load_source("isolated_cleanup_models", ROOT / "app/models/structured_dataset.py")
Dataset = models.StructuredDataset
Version = models.StructuredDatasetVersion
Row = models.StructuredDatasetRow


def extract_api(path, names, namespace):
    """Execute only selected handlers/constants, with dependencies supplied."""
    source = ast.parse(path.read_text(encoding="utf-8"))
    selected = []
    for node in source.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names:
            node.decorator_list = []
            node.args.defaults = []
            node.args.kw_defaults = [None for _ in node.args.kwonlyargs]
            selected.append(node)
        elif isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id in names for target in node.targets
        ):
            selected.append(node)
    module = ast.Module(body=[ast.ImportFrom(
        module="__future__", names=[ast.alias(name="annotations")], level=0,
    ), *selected], type_ignores=[])
    exec(compile(ast.fix_missing_locations(module), str(path), "exec"), namespace)
    return namespace


ADMIN = extract_api(ROOT / "app/api/admin.py", {"delete_widget_config"}, {
    "HTTPException": HTTPException,
})["delete_widget_config"]
SUPERADMIN = extract_api(ROOT / "app/api/superadmin.py", {
    "ORG_DELETE_BLOCKING_TABLES", "ORG_DELETE_CLEANUP_TABLES",
    "_table_exists", "delete_organization",
}, {
    "STRUCTURED_DATASET_TABLES": cleanup.STRUCTURED_DATASET_TABLES,
    "Organization": Organization, "HTTPException": HTTPException,
    "IntegrityError": IntegrityError, "inspect": inspect, "text": text,
})


class CleanupFixture(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.execute(Organization.__table__.insert(), [{"id": 1}, {"id": 2}])
        self.db.execute(WidgetConfig.__table__.insert(), [
            {"widget_id": "agent-a", "organization_id": 1},
            {"widget_id": "agent-b", "organization_id": 1},
            {"widget_id": "agent-c", "organization_id": 2},
        ])
        for dataset_id, org, widget, deleted in [
            (1, 1, "agent-a", False), (2, 1, "agent-a", True),
            (3, 1, "agent-b", False), (4, 2, "agent-c", False),
        ]:
            self.seed_dataset(dataset_id, org, widget, deleted)
        self.db.commit()
        self.before = self.snapshot()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def seed_dataset(self, dataset_id, org, widget, deleted=False):
        scope = {"dataset_id": dataset_id, "organization_id": org, "widget_id": widget}
        self.db.execute(Dataset.__table__.insert().values(
            id=dataset_id, organization_id=org, widget_id=widget, name="Prices",
            status="inactive" if deleted else "active", is_deleted=deleted,
        ))
        # Historical published version plus the active published version and draft.
        for number, status in [(1, "published"), (2, "published"), (3, "draft")]:
            version_id = dataset_id * 10 + number
            self.db.execute(Version.__table__.insert().values(
                **scope, id=version_id, version_number=number, status=status,
                sheet_name="Rates", columns=[], required_filters=[], validation={}, row_count=1,
            ))
            self.db.execute(Row.__table__.insert().values(
                **scope, id=version_id, version_id=version_id, row_number=1, values={"price": "0.10"},
            ))
        self.db.execute(Dataset.__table__.update().where(Dataset.id == dataset_id).values(
            active_version_id=dataset_id * 10 + 2,
        ))

    def snapshot(self):
        return {
            table.name: [tuple(row) for row in self.db.execute(select(table).order_by(*table.primary_key))]
            for table in Base.metadata.tables.values()
        }

    def run_admin(self, widget, org, purge=None):
        model_stub = types.ModuleType("app.models")
        model_stub.WidgetConfig = WidgetConfig
        service_stub = types.ModuleType("app.services.structured_dataset_cleanup")
        service_stub.purge_agent_datasets = purge or cleanup.purge_agent_datasets
        with patch.dict(sys.modules, {
            "app.models": model_stub,
            "app.services.structured_dataset_cleanup": service_stub,
        }):
            return asyncio.run(ADMIN(widget, self.db, types.SimpleNamespace(organization_id=org)))

    def test_original_parent_delete_fails_with_foreign_keys(self):
        self.assertEqual(self.db.execute(text("PRAGMA foreign_keys")).scalar_one(), 1)
        self.db.delete(self.db.get(WidgetConfig, "agent-a"))
        with self.assertRaises(IntegrityError):
            self.db.flush()
        self.db.rollback()
        self.assertEqual(self.snapshot(), self.before)

    def test_cleanup_published_soft_deleted_and_history_preserves_other_scopes(self):
        cleanup.purge_agent_datasets(self.db, 1, "agent-a")
        after = self.snapshot()
        for table in (Dataset.__table__, Version.__table__, Row.__table__):
            keys = list(table.c.keys())
            expected = [row for row in self.before[table.name]
                        if row[keys.index("organization_id")] != 1
                        or row[keys.index("widget_id")] != "agent-a"]
            self.assertEqual(after[table.name], expected)
        self.assertEqual(after["widget_configs"], self.before["widget_configs"])

    def test_same_widget_in_other_org_is_not_touched(self):
        self.seed_dataset(5, 2, "agent-a")
        self.db.commit()
        cleanup.purge_agent_datasets(self.db, 1, "agent-a")
        self.assertEqual(self.db.get(Dataset, 5).active_version_id, 52)
        self.assertEqual(self.db.query(Version).filter_by(dataset_id=5).count(), 3)
        self.assertEqual(self.db.query(Row).filter_by(dataset_id=5).count(), 3)

    def test_rollback_restores_records_and_active_pointer(self):
        with patch.object(self.db, "commit", side_effect=AssertionError("internal commit")):
            cleanup.purge_agent_datasets(self.db, 1, "agent-a")
        self.db.delete(self.db.get(WidgetConfig, "agent-a"))
        self.db.flush()
        self.db.rollback()
        self.assertEqual(self.snapshot(), self.before)

    def test_parent_deletion_commits_without_fk_errors(self):
        self.assertEqual(self.run_admin("agent-a", 1), {"message": "Widget deleted successfully"})
        self.assertIsNone(self.db.get(WidgetConfig, "agent-a"))
        self.assertIsNotNone(self.db.get(WidgetConfig, "agent-b"))
        self.assertIsNotNone(self.db.get(WidgetConfig, "agent-c"))
        self.assertEqual(self.db.execute(text("PRAGMA foreign_key_check")).all(), [])

    def test_ownership_checked_before_cleanup(self):
        purge = Mock(side_effect=AssertionError("unauthorized cleanup"))
        for widget, org in [("agent-a", 2), ("missing", 1)]:
            with self.subTest(widget=widget), self.assertRaises(HTTPException) as caught:
                self.run_admin(widget, org, purge)
            self.assertEqual(caught.exception.status_code, 404)
        purge.assert_not_called()
        self.assertEqual(self.snapshot(), self.before)

    def test_current_session_connection_inspection_and_offline_postgres_sql(self):
        statements = []

        @event.listens_for(self.engine, "before_execute")
        def collect(connection, clause, multiparams, params, execution_options):
            if getattr(clause, "is_update", False) or getattr(clause, "is_delete", False):
                statements.append(clause)

        connection = self.db.connection()
        with patch.object(cleanup, "inspect", wraps=inspect) as inspected:
            cleanup.purge_agent_datasets(self.db, 1, "agent-a")
        inspected.assert_called_once_with(connection)
        self.assertEqual([s.table.name for s in statements], [
            "structured_datasets", "structured_dataset_rows",
            "structured_dataset_versions", "structured_datasets",
        ])
        self.assertTrue(statements[0].is_update)
        for statement in statements:
            compiled = statement.compile(dialect=postgresql.dialect())
            where = str(compiled).split(" WHERE ", 1)[1]
            self.assertIn("organization_id =", where)
            self.assertIn("widget_id =", where)
            self.assertIn(1, compiled.params.values())
            self.assertIn("agent-a", compiled.params.values())
        self.assertIsNone(statements[0].compile(dialect=postgresql.dialect()).params["active_version_id"])

    def test_orm_published_guards_remain_intact(self):
        self.db.delete(self.db.get(Version, 11))
        with self.assertRaisesRegex(ValueError, "immutable"):
            self.db.flush()
        self.db.rollback()
        self.db.delete(self.db.get(Row, 11))
        with self.assertRaisesRegex(ValueError, "immutable"):
            self.db.flush()
        self.db.rollback()

    def test_org_delete_blocks_widgets_and_dataset_tables(self):
        self.assertTrue(set(cleanup.STRUCTURED_DATASET_TABLES).issubset(
            SUPERADMIN["ORG_DELETE_BLOCKING_TABLES"]))
        with self.assertRaises(HTTPException) as caught:
            asyncio.run(SUPERADMIN["delete_organization"](1, self.db, None))
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("Cannot delete organization because related data exists", caught.exception.detail)
        for name in ("widget_configs", *cleanup.STRUCTURED_DATASET_TABLES):
            self.assertIn(name, caught.exception.detail)
        self.assertEqual(self.snapshot(), self.before)

    def test_org_dataset_blockers_independent_of_widget_blocker(self):
        real_exists = SUPERADMIN["_table_exists"]
        with patch.dict(SUPERADMIN, {"_table_exists": lambda db, name:
                name != "widget_configs" and real_exists(db, name)}):
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(SUPERADMIN["delete_organization"](1, self.db, None))
        self.assertEqual(caught.exception.status_code, 400)
        for name in cleanup.STRUCTURED_DATASET_TABLES:
            self.assertIn(name, caught.exception.detail)
        self.assertEqual(self.snapshot(), self.before)

    def test_missing_scope_is_noop_and_repeat_cleanup_is_safe(self):
        cleanup.purge_agent_datasets(self.db, 99, "agent-a")
        cleanup.purge_agent_datasets(self.db, 1, "missing")
        self.assertEqual(self.snapshot(), self.before)
        cleanup.purge_agent_datasets(self.db, 1, "agent-a")
        after = self.snapshot()
        cleanup.purge_agent_datasets(self.db, 1, "agent-a")
        self.assertEqual(self.snapshot(), after)


class BeforeMigrationTests(unittest.TestCase):
    def test_no_dataset_tables_noop_parent_and_org_delete(self):
        engine = create_engine("sqlite:///:memory:")

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(engine, tables=[Organization.__table__, WidgetConfig.__table__])
        try:
            with Session(engine) as db:
                db.add(Organization(id=1))
                db.flush()
                db.add(WidgetConfig(widget_id="legacy", organization_id=1))
                db.commit()
                statements = []

                @event.listens_for(engine, "before_execute")
                def collect(connection, clause, multiparams, params, execution_options):
                    statements.append(str(clause))

                connection = db.connection()
                with patch.object(cleanup, "inspect", wraps=inspect) as inspected:
                    cleanup.purge_agent_datasets(db, 1, "legacy")
                inspected.assert_called_once_with(connection)
                self.assertEqual(statements, [])
                # Absence checks never execute a SELECT against missing tables.
                for name in cleanup.STRUCTURED_DATASET_TABLES:
                    self.assertFalse(SUPERADMIN["_table_exists"](db, name))
                self.assertEqual(statements, [])
                db.delete(db.get(WidgetConfig, "legacy"))
                db.commit()
                self.assertEqual(asyncio.run(SUPERADMIN["delete_organization"](1, db, None)),
                                 {"success": True, "deleted_organization_id": 1})
                self.assertEqual(db.execute(text("PRAGMA foreign_key_check")).all(), [])
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()