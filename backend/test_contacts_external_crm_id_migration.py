"""Isolated additive Contact schema repair regressions; no application startup."""

from types import SimpleNamespace
import unittest
from unittest.mock import patch

from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, inspect, select, text
from sqlalchemy.dialects import postgresql

from app.migrations import MIGRATIONS
from app.migrations import m2026_10_14_add_contacts_external_crm_id as migration
from app.models.campaign import Contact


class ContactsExternalCrmIdMigrationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        metadata = MetaData()
        Table("contact_lists", metadata, Column("id", Integer, primary_key=True))
        self.contacts = Contact.__table__.to_metadata(metadata)
        self.contacts._columns.remove(self.contacts.c.external_crm_id)
        metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            conn.execute(metadata.tables["contact_lists"].insert(), {"id": 1})
            conn.execute(self.contacts.insert(), [
                {"id": 1, "contact_list_id": 1, "name": "Synthetic fixture A"},
                {"id": 2, "contact_list_id": 1, "name": "Synthetic fixture B"},
            ])

    def tearDown(self):
        self.engine.dispose()

    def test_idempotent_nullable_addition_preserves_all_existing_columns_and_rows(self):
        with self.engine.begin() as conn:
            before = conn.execute(select(self.contacts)).mappings().all()
            migration.upgrade(conn)
            migration.upgrade(conn)
            self.assertEqual(conn.execute(select(self.contacts)).mappings().all(), before)
            columns = {c["name"]: c for c in inspect(conn).get_columns("contacts")}
            self.assertEqual(set(columns), set(Contact.__table__.columns.keys()))
            self.assertIsInstance(columns["external_crm_id"]["type"], String)
            self.assertEqual(columns["external_crm_id"]["type"].length, 100)
            self.assertTrue(columns["external_crm_id"]["nullable"])
            self.assertIsNone(columns["external_crm_id"]["default"])
            self.assertEqual(conn.execute(text("SELECT external_crm_id FROM contacts")).scalars().all(), [None, None])
            quoted = ", ".join('"' + c.name + '"' for c in Contact.__table__.columns)
            conn.execute(text(f"SELECT {quoted} FROM contacts LIMIT 0"))

    def test_rerun_preserves_existing_external_identifiers(self):
        with self.engine.begin() as conn:
            migration.upgrade(conn)
            conn.execute(text("UPDATE contacts SET external_crm_id=:value WHERE id=1"), {"value": "synthetic-existing-id"})
            before = conn.execute(text("SELECT * FROM contacts ORDER BY id")).mappings().all()
            migration.upgrade(conn)
            self.assertEqual(conn.execute(text("SELECT * FROM contacts ORDER BY id")).mappings().all(), before)

    def test_postgres_exact_ddl_matches_model_and_has_no_data_writes(self):
        statements = []
        conn = SimpleNamespace(dialect=postgresql.dialect(), execute=lambda sql: statements.append(str(sql)))
        with patch.object(migration, "inspect", return_value=SimpleNamespace(has_table=lambda name: name == "contacts")):
            migration.upgrade(conn)
            migration.upgrade(conn)
        model_column = Contact.__table__.c.external_crm_id
        self.assertEqual(str(model_column.type.compile(dialect=conn.dialect)), "VARCHAR(100)")
        self.assertTrue(model_column.nullable)
        self.assertEqual(statements, ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS external_crm_id VARCHAR(100) NULL"] * 2)
        self.assertEqual(sum(mid == migration.MIGRATION_ID for mid, _ in MIGRATIONS), 1)

    def test_missing_prerequisite_does_not_create_tables(self):
        with self.engine.begin() as conn:
            conn.execute(text("DROP TABLE contacts"))
            with self.assertRaisesRegex(RuntimeError, "prerequisite"):
                migration.upgrade(conn)
            self.assertFalse(inspect(conn).has_table("contacts"))


if __name__ == "__main__":
    unittest.main()