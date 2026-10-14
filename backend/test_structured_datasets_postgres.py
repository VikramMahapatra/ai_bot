"""Opt-in PostgreSQL 18 integration tests; never use the configured application DB.

Run from backend with unittest and STRUCTURED_DATASETS_TEST_DATABASE_URL set by
the caller to the disposable trust-authenticated dataset_test server on loopback
port 55439, database postgres. Missing URL skips all integration tests; an unsafe
URL fails before importing application code or making a connection. Each test
owns a fresh sd_test_<UUID> schema, including its parent tables and enum types.
No app.main, startup, full migration runner, Chroma, or configured DB connection
is used. Only the actual dataset migration is executed. No fixture files needed.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor, wait
from contextlib import contextmanager
import importlib
import importlib.util
import ipaddress
import os
from pathlib import Path
import re
import sys
import threading
import types
import unittest
from unittest.mock import patch
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from sqlalchemy import Enum, MetaData, create_engine, event, insert, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parent
ENV = "STRUCTURED_DATASETS_TEST_DATABASE_URL"
PREFIX = "/api/admin/knowledge/datasets"
OWNED_TABLES = {"structured_datasets", "structured_dataset_versions", "structured_dataset_rows"}
PARENT_TABLES = {"organizations", "users", "qualification_templates", "widget_configs"}
VERSION_FIELDS = {"sheet_name", "columns", "rows", "required_filters"}
SCHEMA_PATTERN = re.compile(r"sd_test_[0-9a-f]{32}\Z")


def guarded_url(raw):
    """Reject libpq overrides, sockets, passwords, other ports/users and DNS hosts.

    Never include the raw URL in exceptions. Canonicalizing localhost to a literal
    loopback address also prevents a hosts-file/DNS override from redirecting IO.
    """
    try:
        url = make_url(raw)
        valid = (
            url.drivername in {"postgresql", "postgresql+psycopg2", "postgresql+psycopg"}
            and url.host in {"localhost", "127.0.0.1", "::1"}
            and url.port == 55439
            and url.database == "postgres"
            and url.username == "dataset_test"
            and url.password in {None, ""}
            and not url.query
        )
    except Exception:
        raise ValueError("Invalid disposable PostgreSQL test target") from None
    if not valid:
        raise ValueError(
            "Refusing target: require PostgreSQL, loopback:55439/postgres, "
            "dataset_test, trust authentication and no URL query options"
        ) from None
    return url.set(host="127.0.0.1" if url.host == "localhost" else url.host)


def load_runtime():
    """Real model registry, but a temporary services package shell avoids Chroma.

    Config/database imports construct the legacy engine but never connect it.
    Load the router by filename to avoid app.api's eager unrelated imports.
    """
    from app.config import settings
    from app.database import get_db
    from app.models import Organization, User, UserRole, WidgetConfig, QualificationTemplate
    from app.models.structured_dataset import (
        StructuredDataset, StructuredDatasetVersion, StructuredDatasetRow,
    )
    from app.schemas.structured_dataset import DatasetCreate, VersionCreate

    package = types.ModuleType("app.services")
    package.__path__ = [str(ROOT / "app" / "services")]
    with patch.dict(sys.modules, {"app.services": package}):
        service = importlib.import_module("app.services.structured_dataset_service")
        cleanup = importlib.import_module("app.services.structured_dataset_cleanup")
        spec = importlib.util.spec_from_file_location(
            "_sd_postgres_actual_router", ROOT / "app" / "api" / "structured_datasets.py"
        )
        router = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(router)
    migration = importlib.import_module("app.migrations.m2026_10_13_create_structured_datasets")
    return types.SimpleNamespace(
        settings=settings, get_db=get_db, Organization=Organization, User=User,
        UserRole=UserRole, Widget=WidgetConfig, Qualification=QualificationTemplate,
        Dataset=StructuredDataset, Version=StructuredDatasetVersion, Row=StructuredDatasetRow,
        DatasetCreate=DatasetCreate, VersionCreate=VersionCreate,
        service=service, cleanup=cleanup, router=router, migration=migration,
    )


@contextmanager
def record_sql(engine):
    statements = []

    def record(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


@unittest.skipUnless(os.environ.get(ENV), "Explicit disposable PostgreSQL test URL not supplied")
class StructuredDatasetsPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Validation must precede any app import or engine construction.
        cls.target = guarded_url(os.environ[ENV])
        cls.rt = load_runtime()

    def setUp(self):
        self.schema = "sd_test_" + uuid4().hex
        self.schema_created = False
        self.engine = create_engine(
            self.target, echo=False, hide_parameters=True,
            pool_size=5, max_overflow=0, pool_timeout=3,
            connect_args={
                "connect_timeout": 3,
                # Override PGHOSTADDR / service-file defaults as well as DNS.
                "hostaddr": self.target.host,
                "application_name": "structured_datasets_disposable_tests",
                "options": f"-c search_path={self.schema} -c statement_timeout=10000 -c lock_timeout=2000",
            },
        )
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.drop_owned_schema)

        # Verify the connected server *before* the first write. PostgreSQL's
        # implicit pg_catalog is intentional; public is never on search_path.
        with self.engine.begin() as conn:
            self.assertEqual(conn.execute(text("SHOW search_path")).scalar_one(), self.schema)
            self.assertEqual(conn.execute(text("SHOW statement_timeout")).scalar_one(), "10s")
            self.assertEqual(conn.execute(text("SHOW lock_timeout")).scalar_one(), "2s")
            target = conn.execute(text(
                "SELECT current_database(), current_user, inet_server_addr()::text, "
                "inet_server_port(), current_setting('server_version_num')::integer"
            )).one()
            self.assertEqual(target[0:2], ("postgres", "dataset_test"))
            self.assertTrue(ipaddress.ip_interface(target[2]).ip.is_loopback)
            self.assertEqual(target[3], 55439)
            self.assertEqual(target[4] // 10000, 18, "Refusing anything other than PostgreSQL 18")
            self.assertIsNone(conn.execute(text(
                "SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=:schema"
            ), {"schema": self.schema}).scalar_one_or_none())
            conn.execute(text(f'CREATE SCHEMA "{self.schema}" AUTHORIZATION CURRENT_USER'))
        # Mark ownership only after CREATE has committed, never on a collision.
        self.schema_created = True

        metadata = MetaData()
        for model in (self.rt.Organization, self.rt.User, self.rt.Qualification, self.rt.Widget):
            table = model.__table__.to_metadata(metadata, schema=self.schema)
            for column in table.columns:
                if isinstance(column.type, Enum):
                    # to_metadata already copies/rebinds SchemaType table hooks.
                    # Replacing that copy would leave its CREATE TYPE hooks on
                    # the old type. Configure only the attached isolated copy.
                    self.assertIsNot(column.type, model.__table__.c[column.name].type)
                    column.type.metadata = None
                    column.type.schema = self.schema
                    column.type.inherit_schema = True
        self.parent_metadata = metadata
        with self.engine.begin() as conn:
            with record_sql(self.engine) as statements:
                metadata.create_all(conn)
                self.rt.migration.upgrade(conn)
                self.rt.migration.upgrade(conn)
            self.assertEqual(set(inspect(conn).get_table_names(schema=self.schema)), PARENT_TABLES | OWNED_TABLES)
            for statement in statements:
                if "CREATE TYPE" in statement.upper():
                    self.assertIn(self.schema, statement)
            conn.execute(insert(self.rt.Organization), [
                dict(id=1, name="One", org_domain="one"), dict(id=2, name="Two", org_domain="two"),
            ])
            conn.execute(insert(self.rt.User), [
                dict(id=n, organization_id=n, username=f"user{n}", email=f"user{n}@example.invalid",
                     hashed_password="unused", role=self.rt.UserRole.ADMIN) for n in (1, 2)
            ])
            conn.execute(insert(self.rt.Qualification), [
                dict(id=n, organization_id=n, name=f"Template {n}", objective="Integration test") for n in (1, 2)
            ])
            conn.execute(insert(self.rt.Widget), [
                dict(user_id=1, organization_id=1, widget_id="agent-a", name="A", qualification_template_id=1),
                dict(user_id=1, organization_id=1, widget_id="agent-b", name="B", qualification_template_id=1),
                dict(user_id=2, organization_id=2, widget_id="agent-other", name="Other", qualification_template_id=2),
            ])

        flags = patch.multiple(self.rt.settings, STRUCTURED_DATASETS_ENABLED=True,
                               STRUCTURED_DATASETS_CHAT_ENABLED=True,
                               STRUCTURED_DATASETS_ORGANIZATION_IDS="1,2")
        flags.start()
        self.addCleanup(flags.stop)
        self.db = Session(self.engine, expire_on_commit=False)
        self.addCleanup(self.db.close)

    def drop_owned_schema(self):
        if not self.schema_created:
            return
        self.assertRegex(self.schema, SCHEMA_PATTERN)
        with self.engine.begin() as conn:
            owner = conn.execute(text(
                "SELECT pg_catalog.pg_get_userbyid(nspowner) FROM pg_catalog.pg_namespace WHERE nspname=:schema"
            ), {"schema": self.schema}).scalar_one()
            self.assertEqual(owner, "dataset_test", "Refusing to drop a schema not owned by the test role")
            conn.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))
        with self.engine.connect() as conn:
            self.assertIsNone(conn.execute(text(
                "SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=:schema"
            ), {"schema": self.schema}).scalar_one_or_none(), "Owned schema was not removed")
            self.assertEqual(conn.execute(text(
                "SELECT count(*) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n "
                "ON t.typnamespace=n.oid WHERE n.nspname=:schema"
            ), {"schema": self.schema}).scalar_one(), 0)
        self.schema_created = False

    def payload(self, widget="agent-a", amount="0.10", required=True):
        return self.rt.DatasetCreate(
            widget_id=widget, name="Prices", description="Exact rates", sheet_name="Rates",
            columns=[dict(key="code", label="Code", data_type="text", public=True, queryable=True),
                     dict(key="price", label="Price", data_type="decimal", currency="USD", public=True, queryable=True),
                     dict(key="secret", label="Secret", data_type="text", public=False, queryable=False)],
            rows=[dict(code="001", price=amount, secret="hidden"),
                  dict(code="002", price="0.20", secret="internal")],
            required_filters=["code"] if required else [],
        )

    def version_payload(self, **kwargs):
        return self.rt.VersionCreate.model_validate(self.payload(**kwargs).model_dump(include=VERSION_FIELDS))

    def published(self, data=None, organization=1):
        dataset, version = self.rt.service.create_dataset(self.db, organization, data or self.payload())
        self.db.commit()
        self.rt.service.publish_version(self.db, organization, dataset.id, version.id)
        self.db.commit()
        return dataset, version

    def query(self, dataset, organization=1, widget="agent-a", **updates):
        plan = dict(dataset_id=dataset.id, operation="lookup",
                    filters=[dict(column="code", operator="eq", value="001")])
        plan.update(updates)
        return self.rt.service.execute_query(self.db, organization, widget, plan)

    def assert_http(self, code, call):
        with self.assertRaises(HTTPException) as caught:
            call()
        self.assertEqual(caught.exception.status_code, code)

    def snapshot(self):
        return {
            model.__tablename__: [tuple(row) for row in self.db.execute(
                select(model.__table__).order_by(*model.__table__.primary_key)
            )] for model in (self.rt.Dataset, self.rt.Version, self.rt.Row, self.rt.Widget)
        }

    def app(self, organization=1):
        app = FastAPI()
        app.include_router(self.rt.router.router)
        identity = {"organization": organization}

        def local_db():
            # A fresh real session per request, never application SessionLocal.
            with Session(self.engine, expire_on_commit=False) as db:
                try:
                    yield db
                finally:
                    db.rollback()

        def admin():
            return self.rt.User(id=identity["organization"], organization_id=identity["organization"],
                                role=self.rt.UserRole.ADMIN)

        app.dependency_overrides[self.rt.get_db] = local_db
        app.dependency_overrides[self.rt.router.require_admin] = admin
        return app, identity

    def concurrent(self, functions):
        """Workers never share Session/connection; every DB wait is bounded.

        A barrier overlaps real transactions, without mocking locks. Futures are
        bounded independently of SQL's 10s statement/2s lock timeouts. Always join
        workers before teardown; operations contain no unbounded retry loops.
        """
        self.db.rollback()  # Release the main session's connection and any locks.
        barrier = threading.Barrier(len(functions), timeout=5)

        def worker(function):
            with Session(self.engine, expire_on_commit=False) as db:
                pid = db.execute(text("SELECT pg_backend_pid()")).scalar_one()
                barrier.wait()
                try:
                    result = function(db)
                    db.commit()
                    return pid, result
                except Exception:
                    db.rollback()
                    raise

        with ThreadPoolExecutor(max_workers=len(functions), thread_name_prefix="sd-pg-test") as executor:
            futures = [executor.submit(worker, function) for function in functions]
            _, pending = wait(futures, timeout=25)
            self.assertFalse(pending, "Disposable PostgreSQL workers exceeded the bounded deadline")
            results = [future.result(timeout=1) for future in futures]
        self.assertEqual(len({pid for pid, result in results}), len(functions))
        self.db.expire_all()
        return [result for pid, result in results]

    def test_connection_scope_and_target_guards(self):
        self.assertEqual(self.db.execute(text("SHOW search_path")).scalar_one(), self.schema)
        self.assertEqual(self.db.execute(text("SELECT current_schemas(false)")).scalar_one(), [self.schema])
        self.assertEqual(self.db.execute(text("SHOW statement_timeout")).scalar_one(), "10s")
        self.assertEqual(self.db.execute(text("SHOW lock_timeout")).scalar_one(), "2s")
        for raw in [
            "postgresql://dataset_test@remote.invalid:55439/postgres",
            "postgresql://dataset_test@127.0.0.1:5432/postgres",
            "postgresql://dataset_test@127.0.0.1:55439/production",
            "postgresql://postgres@127.0.0.1:55439/postgres",
            "postgresql://dataset_test:secret@127.0.0.1:55439/postgres",
            "postgresql://dataset_test@127.0.0.1:55439/postgres?host=remote.invalid",
            "postgresql://dataset_test@/postgres", "sqlite:///:memory:",
        ]:
            with self.assertRaises(ValueError):
                guarded_url(raw)

    def test_migration_idempotency_and_missing_active_fk_repair(self):
        dataset, version = self.published()
        before = self.snapshot()
        self.db.rollback()
        with self.engine.begin() as conn:
            with record_sql(self.engine) as sql:
                self.rt.migration.upgrade(conn)
                self.rt.migration.upgrade(conn)
            self.assertFalse(any(s.lstrip().upper().startswith(("CREATE ", "ALTER ", "DROP ")) for s in sql))
            conn.execute(text("ALTER TABLE structured_datasets DROP CONSTRAINT fk_sd_active_scope"))
            with record_sql(self.engine) as repair:
                self.rt.migration.upgrade(conn)
                self.rt.migration.upgrade(conn)
            self.assertEqual(sum("ADD CONSTRAINT fk_sd_active_scope" in s for s in repair), 1)
            foreign_keys = inspect(conn).get_foreign_keys("structured_datasets", schema=self.schema)
            self.assertEqual(sum(fk["name"] == "fk_sd_active_scope" for fk in foreign_keys), 1)
            self.assertEqual(set(inspect(conn).get_table_names(schema=self.schema)), PARENT_TABLES | OWNED_TABLES)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.query(dataset)["citations"][0]["version_id"], version.id)

    def test_real_jsonb_round_trip_and_exact_lookup(self):
        data = self.payload(amount="123456789.123456789123456789")
        data.columns.extend([
            dict(key="flag", label="Flag", data_type="boolean", public=True, queryable=True),
            dict(key="date", label="Date", data_type="date", public=True, queryable=True),
            dict(key="big", label="Big", data_type="integer", public=True, queryable=True),
        ])
        data.rows[0].update(flag=True, date="2026-10-13", big="9007199254740993")
        dataset, version = self.published(data)
        self.db.expire_all()
        row = self.rt.service.rows_query(self.db, version).first()
        self.assertEqual(row.values, dict(code="001", price="123456789.123456789123456789",
                                        secret="hidden", flag=True, date="2026-10-13", big="9007199254740993"))
        types_found = self.db.execute(text(
            "SELECT table_name,column_name,data_type FROM information_schema.columns "
            "WHERE table_schema=:schema AND data_type='jsonb'"
        ), {"schema": self.schema}).all()
        self.assertEqual({(r[0], r[1]) for r in types_found}, {
            ("structured_dataset_versions", key) for key in ("columns", "required_filters", "validation")
        } | {("structured_dataset_rows", "values")})
        self.assertEqual(self.db.execute(text(
            "SELECT jsonb_typeof(values), jsonb_typeof(values->'price'), "
            "jsonb_typeof(values->'flag') FROM structured_dataset_rows WHERE id=:id"
        ), {"id": row.id}).one(), ("object", "string", "boolean"))
        result = self.query(dataset)
        self.assertEqual(result["rows"][0]["price"], data.rows[0]["price"])
        self.assertNotIn("secret", result["rows"][0])
        self.assertIn("123456789.123456789123456789 USD", result["response"])
        self.assertEqual(result["citations"][0]["row_numbers"], [1])

    def test_exact_decimal_sum_count_ranges_min_max(self):
        dataset, _ = self.published(self.payload(required=False))
        for operation, expected in [("sum", "0.30"), ("min", "0.10"), ("max", "0.20")]:
            result = self.query(dataset, operation=operation, filters=[], aggregate_column="price")
            self.assertEqual(result["rows"][0]["value"], expected)
            self.assertEqual(result["citations"][0]["row_numbers"], [1, 2])
        result = self.query(dataset, operation="count", filters=[dict(column="price", operator="gte", value="0.20")])
        self.assertEqual(result["rows"], [{"count": 1}])

    def test_required_filters_no_match_and_bounded_lookup(self):
        dataset, _ = self.published()
        self.assertEqual(self.query(dataset, filters=[])["status"], "clarify")
        for operation in ("lookup", "count", "sum", "min", "max"):
            updates = dict(operation=operation, filters=[dict(column="code", operator="eq", value="absent")])
            if operation in {"sum", "min", "max"}:
                updates["aggregate_column"] = "price"
            result = self.query(dataset, **updates)
            self.assertEqual((result["status"], result["rows"], result["citations"]), ("no_match", [], []))
        unrestricted, _ = self.published(self.payload(required=False))
        result = self.query(unrestricted, filters=[], limit=1)
        self.assertEqual(result["total_matches"], 2)
        self.assertEqual(len(result["rows"]), 1)
        self.assertIn("Showing 1 of 2", result["response"])

    def test_privacy_catalog_and_all_query_positions(self):
        dataset, _ = self.published()
        catalog = self.rt.service.get_active_catalog(self.db, 1, "agent-a")
        self.assertNotIn("secret", str(catalog))
        self.assertNotIn("hidden", str(catalog))
        for updates in [dict(select=["secret"]), dict(select=["forged"]),
                        dict(filters=[dict(column="secret", operator="eq", value="hidden")]),
                        dict(operation="sum", aggregate_column="secret")]:
            self.assert_http(422, lambda: self.query(dataset, **updates))
        self.assertNotIn("hidden", str(self.query(dataset)))

    def test_public_nonqueryable_output_only(self):
        data = self.payload(required=False)
        data.columns[1].queryable = False
        dataset, _ = self.published(data)
        self.assertEqual(self.query(dataset, filters=[])["rows"][0]["price"], "0.10")
        self.assert_http(422, lambda: self.query(dataset, filters=[dict(column="price", operator="eq", value="0.10")]))
        self.assert_http(422, lambda: self.query(dataset, operation="sum", filters=[], aggregate_column="price"))

    def test_tenant_agent_and_forged_version_isolation(self):
        dataset, version = self.published()
        other, foreign_version = self.published(self.payload(widget="agent-other"), organization=2)
        for call in [lambda: self.rt.service.get_dataset(self.db, 2, dataset.id),
                     lambda: self.query(dataset, widget="agent-b"),
                     lambda: self.query(other, organization=1),
                     lambda: self.rt.service.create_dataset(self.db, 1, self.payload(widget="agent-other")),
                     lambda: self.rt.service.get_version(self.db, dataset, foreign_version.id)]:
            self.assert_http(404, call)
        self.assert_http(409, lambda: self.query(dataset, version_id=foreign_version.id))
        self.assertEqual(self.rt.service.get_active_catalog(self.db, 1, "agent-b"), [])
        self.assertEqual(self.query(dataset)["citations"][0]["version_id"], version.id)

    def test_scoped_composite_foreign_keys(self):
        dataset, version = self.published()
        other, other_version = self.published(self.payload(widget="agent-other"), organization=2)
        cases = [
            (self.rt.Row, dict(dataset_id=dataset.id, version_id=version.id, organization_id=2,
                              widget_id="agent-other", row_number=99, values={})),
            (self.rt.Row, dict(dataset_id=other.id, version_id=version.id, organization_id=2,
                              widget_id="agent-other", row_number=99, values={})),
            (self.rt.Version, dict(dataset_id=dataset.id, organization_id=2, widget_id="agent-other",
                                  version_number=99, status="draft", sheet_name="Forged", columns=[],
                                  required_filters=[], validation={}, row_count=0)),
        ]
        for model, values in cases:
            with self.assertRaises(IntegrityError):
                self.db.execute(insert(model), values)
            self.db.rollback()
        dataset.active_version_id = other_version.id
        with self.assertRaises(IntegrityError):
            self.db.flush()
        self.db.rollback()
        self.assertEqual(dataset.active_version_id, version.id)

    def test_draft_publication_swap_and_historical_snapshot(self):
        dataset, old = self.published()
        self.rt.service.lock_tenant(self.db, 1)
        locked = self.rt.service.get_dataset(self.db, 1, dataset.id, lock=True)
        new = self.rt.service.add_version(self.db, locked, self.version_payload(amount="9.99"))
        self.db.commit()
        self.assertEqual(self.query(dataset)["rows"][0]["price"], "0.10")
        self.rt.service.publish_version(self.db, 1, dataset.id, new.id)
        self.db.commit()
        self.assertEqual(self.query(dataset)["rows"][0]["price"], "9.99")
        self.assertEqual(self.rt.service.rows_query(self.db, old).first().values["price"], "0.10")
        self.assertEqual(old.status, "published")
        self.assert_http(409, lambda: self.query(dataset, version_id=old.id))
        self.assert_http(409, lambda: self.rt.service.publish_version(self.db, 1, dataset.id, old.id))
        self.db.rollback()

    def test_invalid_draft_publish_rolls_back(self):
        dataset, version = self.rt.service.create_dataset(self.db, 1, self.payload(amount="invalid"))
        self.db.commit()
        self.assertFalse(version.validation["valid"])
        before = self.snapshot()
        self.assert_http(422, lambda: self.rt.service.publish_version(self.db, 1, dataset.id, version.id))
        self.db.rollback()
        self.assertEqual(self.snapshot(), before)
        self.assertIsNone(dataset.active_version_id)
        self.assertEqual(version.status, "draft")

    def test_publish_revalidates_stored_jsonb_not_cached_report(self):
        dataset, version = self.rt.service.create_dataset(self.db, 1, self.payload())
        self.db.commit()
        row = self.rt.service.rows_query(self.db, version).first()
        row.values = dict(row.values, price="corrupt")
        self.db.commit()
        self.assertTrue(version.validation["valid"])
        self.assert_http(422, lambda: self.rt.service.publish_version(self.db, 1, dataset.id, version.id))
        self.db.rollback()
        self.assertIsNone(dataset.active_version_id)

    def test_creation_and_publication_transaction_rollback(self):
        dataset, draft = self.rt.service.create_dataset(self.db, 1, self.payload())
        dataset_id = dataset.id
        self.db.rollback()
        self.assertIsNone(self.db.get(self.rt.Dataset, dataset_id))
        self.assertEqual(self.db.query(self.rt.Row).count(), 0)
        dataset, draft = self.rt.service.create_dataset(self.db, 1, self.payload())
        self.db.commit()
        before = self.snapshot()
        self.rt.service.publish_version(self.db, 1, dataset.id, draft.id)
        self.db.rollback()
        self.assertEqual(self.snapshot(), before)

    def test_published_version_orm_update_delete_and_expired_demotion(self):
        _, version = self.published()
        before = self.snapshot()
        for operation in ("update", "delete", "demote"):
            if operation == "update":
                version.sheet_name = "Changed"
            elif operation == "delete":
                self.db.delete(version)
            else:
                self.db.expire(version, ["status"])
                version.status = "draft"
            with self.assertRaisesRegex(ValueError, "immutable"):
                self.db.flush()
            self.db.rollback()
            self.assertEqual(self.snapshot(), before)

    def test_published_row_orm_insert_update_delete_and_expired_move(self):
        dataset, version = self.published()
        self.rt.service.lock_tenant(self.db, 1)
        draft = self.rt.service.add_version(self.db, self.rt.service.get_dataset(self.db, 1, dataset.id, lock=True),
                                            self.version_payload())
        self.db.commit()
        before = self.snapshot()
        for operation in ("insert", "update", "delete", "move"):
            row = self.rt.service.rows_query(self.db, version).first()
            if operation == "insert":
                self.db.add(self.rt.Row(dataset_id=dataset.id, version_id=version.id, organization_id=1,
                                       widget_id="agent-a", row_number=99, values={}))
            elif operation == "update":
                row.values = dict(row.values, price="1.00")
            elif operation == "delete":
                self.db.delete(row)
            else:
                self.db.expire(row, ["version_id"])
                row.version_id, row.row_number = draft.id, 99
            with self.assertRaisesRegex(ValueError, "immutable"):
                self.db.flush()
            self.db.rollback()
            self.assertEqual(self.snapshot(), before)

    def test_agent_cleanup_history_soft_deleted_and_other_scopes(self):
        live, _ = self.published()
        self.rt.service.lock_tenant(self.db, 1)
        draft = self.rt.service.add_version(self.db, self.rt.service.get_dataset(self.db, 1, live.id, lock=True),
                                            self.version_payload(amount="0.50"))
        self.db.commit()
        self.rt.service.publish_version(self.db, 1, live.id, draft.id)
        self.db.commit()
        deleted, _ = self.published()
        deleted.is_deleted, deleted.status = True, "inactive"
        self.db.commit()
        sibling, _ = self.published(self.payload(widget="agent-b"))
        foreign, _ = self.published(self.payload(widget="agent-other"), organization=2)
        before = self.snapshot()
        self.rt.cleanup.purge_agent_datasets(self.db, 1, "agent-a")
        self.db.execute(self.rt.Widget.__table__.delete().where(self.rt.Widget.widget_id == "agent-a"))
        self.db.commit()
        self.db.expire_all()
        self.assertEqual({d.id for d in self.db.query(self.rt.Dataset)}, {sibling.id, foreign.id})
        self.assertIsNone(self.db.query(self.rt.Widget).filter_by(widget_id="agent-a").first())
        after = self.snapshot()
        for model in (self.rt.Dataset, self.rt.Version, self.rt.Row):
            keys = list(model.__table__.c.keys())
            expected = [row for row in before[model.__tablename__]
                        if row[keys.index("organization_id")] != 1 or row[keys.index("widget_id")] != "agent-a"]
            self.assertEqual(after[model.__tablename__], expected)

    def test_agent_cleanup_parent_fk_and_rollback(self):
        self.published()
        before = self.snapshot()
        widget = self.db.query(self.rt.Widget).filter_by(widget_id="agent-a").one()
        self.db.delete(widget)
        with self.assertRaises(IntegrityError):
            self.db.flush()
        self.db.rollback()
        self.rt.cleanup.purge_agent_datasets(self.db, 1, "agent-a")
        self.db.execute(self.rt.Widget.__table__.delete().where(self.rt.Widget.widget_id == "agent-a"))
        self.db.rollback()
        self.assertEqual(self.snapshot(), before)

    def test_concurrent_tenant_quota_serializes_creation(self):
        def create(db):
            try:
                dataset, _ = self.rt.service.create_dataset(db, 1, self.payload())
                return "created", dataset.id
            except HTTPException as exc:
                db.rollback()
                return "rejected", exc.status_code

        with patch.object(self.rt.service, "MAX_TENANT_DATASETS", 1):
            results = self.concurrent([create, create])
        self.assertEqual(sorted(kind for kind, value in results), ["created", "rejected"])
        self.assertEqual(next(value for kind, value in results if kind == "rejected"), 409)
        self.assertEqual(self.db.query(self.rt.Dataset).count(), 1)
        self.assertEqual(self.db.query(self.rt.Version).count(), 1)
        self.assertEqual(self.db.query(self.rt.Row).count(), 2)

    def test_concurrent_version_numbering_separate_connections(self):
        dataset, _ = self.published()
        dataset_id = dataset.id

        def add(db):
            self.rt.service.lock_tenant(db, 1)
            locked = self.rt.service.get_dataset(db, 1, dataset_id, lock=True)
            return self.rt.service.add_version(db, locked, self.version_payload()).version_number

        numbers = self.concurrent([add, add, add])
        self.assertEqual(sorted(numbers), [2, 3, 4])
        self.assertEqual([v.version_number for v in self.rt.service.versions_query(self.db, dataset)
                          .order_by(self.rt.Version.version_number)], [1, 2, 3, 4])

    def test_concurrent_publication_same_draft_only_once(self):
        dataset, draft = self.rt.service.create_dataset(self.db, 1, self.payload())
        self.db.commit()
        dataset_id, version_id = dataset.id, draft.id

        def publish(db):
            try:
                self.rt.service.publish_version(db, 1, dataset_id, version_id)
                return 200
            except HTTPException as exc:
                db.rollback()
                return exc.status_code

        self.assertEqual(sorted(self.concurrent([publish, publish])), [200, 409])
        self.assertEqual(self.db.get(self.rt.Dataset, dataset_id).active_version_id, version_id)
        self.assertEqual(self.db.get(self.rt.Version, version_id).status, "published")
        self.assertEqual(self.query(dataset)["rows"][0]["price"], "0.10")

    def test_concurrent_publication_distinct_drafts_atomic_pointer(self):
        dataset, old = self.published()
        dataset_id = dataset.id
        drafts = []
        for amount in ("1.11", "2.22"):
            self.rt.service.lock_tenant(self.db, 1)
            locked = self.rt.service.get_dataset(self.db, 1, dataset_id, lock=True)
            draft = self.rt.service.add_version(self.db, locked, self.version_payload(amount=amount))
            self.db.commit()
            drafts.append(draft.id)

        def publisher(version_id):
            def publish(db):
                return self.rt.service.publish_version(db, 1, dataset_id, version_id).active_version_id
            return publish

        self.assertEqual(set(self.concurrent([publisher(v) for v in drafts])), set(drafts))
        active = self.db.get(self.rt.Dataset, dataset_id).active_version_id
        self.assertIn(active, drafts)
        self.assertTrue(all(self.db.get(self.rt.Version, v).status == "published" for v in [old.id, *drafts]))
        result = self.query(dataset)
        self.assertEqual(result["citations"][0]["version_id"], active)
        self.assertEqual(result["rows"][0]["price"], dict(zip(drafts, ["1.11", "2.22"]))[active])

    def test_api_real_routes_lifecycle_inspect_query_and_tenant(self):
        app, identity = self.app()

        async def requests():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                capabilities = await client.get(PREFIX + "/capabilities?widget_id=agent-a")
                self.assertEqual(capabilities.status_code, 200)
                self.assertTrue(capabilities.json()["enabled"])
                inspected = await client.post(PREFIX + "/inspect", data={"widget_id": "agent-a"},
                                              files={"file": ("rates.csv", b"code,price\r\n001,0.10\r\n002,0.20\r\n")})
                self.assertEqual(inspected.status_code, 200, inspected.text)
                self.assertEqual(inspected.json()["tables"][0]["rows"][0], {"code": "001", "price": "0.10"})
                created = await client.post(PREFIX + "/", json=self.payload(required=False).model_dump())
                self.assertEqual(created.status_code, 201, created.text)
                data = created.json()
                dataset_id, version_id = data["id"], data["draft_version"]["id"]
                self.assertEqual(data["status"], "draft")
                self.assertEqual(data["draft_version"]["rows"][0]["price"], "0.10")
                self.assertEqual((await client.patch(f"{PREFIX}/{dataset_id}", json={"status": "active"})).status_code, 409)
                validated = await client.post(f"{PREFIX}/{dataset_id}/versions/{version_id}/validate")
                self.assertTrue(validated.json()["valid"])
                published = await client.post(f"{PREFIX}/{dataset_id}/versions/{version_id}/publish")
                self.assertEqual(published.status_code, 200, published.text)
                self.assertEqual(published.json()["active_version_id"], version_id)
                query = dict(dataset_id=dataset_id, operation="sum", aggregate_column="price", filters=[])
                result = await client.post(f"{PREFIX}/{dataset_id}/test-query", json=query)
                self.assertEqual(result.status_code, 200, result.text)
                self.assertEqual(result.json()["rows"][0]["value"], "0.30")
                private = await client.post(f"{PREFIX}/{dataset_id}/test-query",
                                            json=dict(dataset_id=dataset_id, operation="lookup", select=["secret"]))
                self.assertEqual(private.status_code, 422)
                draft = await client.post(f"{PREFIX}/{dataset_id}/versions",
                                          json=self.version_payload(amount="9.99", required=False).model_dump())
                self.assertEqual(draft.status_code, 201, draft.text)
                self.assertEqual(draft.json()["active_version_id"], version_id)
                self.assertEqual(len((await client.get(f"{PREFIX}/{dataset_id}")).json()["versions"]), 2)
                rows = await client.get(f"{PREFIX}/{dataset_id}/rows?skip=1&limit=1")
                self.assertEqual(rows.json()["items"][0]["row_number"], 2)
                self.assertEqual((await client.get(PREFIX + "/?widget_id=agent-b")).json()["items"], [])
                identity["organization"] = 2
                self.assertEqual((await client.get(f"{PREFIX}/{dataset_id}")).status_code, 404)
                self.assertEqual((await client.post(f"{PREFIX}/{dataset_id}/test-query", json=query)).status_code, 404)
                self.assertEqual((await client.post(PREFIX + "/", json=self.payload().model_dump())).status_code, 404)
                identity["organization"] = 1
                self.assertEqual((await client.patch(f"{PREFIX}/{dataset_id}", json={"status": "inactive"})).status_code, 200)
                self.assertEqual((await client.post(f"{PREFIX}/{dataset_id}/test-query", json=query)).status_code, 409)
                self.assertEqual((await client.patch(f"{PREFIX}/{dataset_id}", json={"status": "active"})).status_code, 200)
                self.assertEqual((await client.delete(f"{PREFIX}/{dataset_id}")).status_code, 200)
                self.assertEqual((await client.get(f"{PREFIX}/{dataset_id}")).status_code, 404)

        asyncio.run(requests())

    def test_api_disabled_gates_and_failed_publish_rollback(self):
        app, _ = self.app()

        async def requests():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                created = await client.post(PREFIX + "/", json=self.payload(amount="invalid").model_dump())
                self.assertEqual(created.status_code, 201, created.text)
                data = created.json()
                dataset_id, version_id = data["id"], data["draft_version"]["id"]
                failed = await client.post(f"{PREFIX}/{dataset_id}/versions/{version_id}/publish")
                self.assertEqual(failed.status_code, 422, failed.text)
                detail = (await client.get(f"{PREFIX}/{dataset_id}")).json()
                self.assertIsNone(detail["active_version_id"])
                self.assertEqual(detail["versions"][0]["status"], "draft")
                with patch.object(self.rt.settings, "STRUCTURED_DATASETS_ENABLED", False):
                    with record_sql(self.engine) as sql:
                        capabilities = await client.get(PREFIX + "/capabilities")
                        self.assertFalse(capabilities.json()["enabled"])
                        self.assertFalse(capabilities.json()["chat_enabled"])
                        self.assertEqual((await client.get(PREFIX + "/?widget_id=agent-a")).json()["items"], [])
                        blocked = await client.post(PREFIX + "/", json=self.payload().model_dump())
                        self.assertEqual(blocked.status_code, 403)
                    self.assertFalse(any("structured_dataset" in statement for statement in sql))
                with patch.object(self.rt.settings, "STRUCTURED_DATASETS_ORGANIZATION_IDS", "2"):
                    self.assertEqual((await client.post(PREFIX + "/", json=self.payload().model_dump())).status_code, 403)
                with patch.object(self.rt.settings, "STRUCTURED_DATASETS_CHAT_ENABLED", False):
                    self.assertFalse((await client.get(PREFIX + "/capabilities")).json()["chat_enabled"])

        asyncio.run(requests())


if __name__ == "__main__":
    unittest.main()