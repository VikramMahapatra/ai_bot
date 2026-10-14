"""Real service/router source with SQLite :memory: only; no app startup or LLM IO."""
from copy import deepcopy
from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
import re
from types import SimpleNamespace as NS
import unittest
from unittest.mock import Mock

from fastapi import HTTPException
from sqlalchemy import Boolean, Column, Integer, JSON, String, create_engine
from sqlalchemy.orm import Session, declarative_base

import test_dataset_generic_chat as chat_tests
from test_dataset_chat import SCHEMA, USAGE, column, load_ast

Base = declarative_base()


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer)
    widget_id = Column(String)
    is_deleted = Column(Boolean, default=False)
    status = Column(String, default="active")
    active_version_id = Column(Integer)
    name = Column(String, default="Locations")


class Version(Base):
    __tablename__ = "versions"
    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer)
    widget_id = Column(String)
    dataset_id = Column(Integer)
    status = Column(String, default="published")
    columns = Column(JSON)
    required_filters = Column(JSON, default=list)
    sheet_name = Column(String, default="Rates")
    version_number = Column(Integer, default=1)


class Row(Base):
    __tablename__ = "rows"
    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer)
    widget_id = Column(String)
    dataset_id = Column(Integer)
    version_id = Column(Integer)
    row_number = Column(Integer)
    values = Column(JSON)


class FilterResolutionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.db.close)
        self.columns = [column("city"), column("micro_market_location"), column("code"),
                        column("price", "decimal"),
                        {**column("secret"), "public": False},
                        {**column("note"), "queryable": False}]
        self.dataset = Dataset(id=10, organization_id=7, widget_id="widget", active_version_id=20)
        self.version = Version(id=20, organization_id=7, widget_id="widget", dataset_id=10,
                               columns=self.columns, required_filters=[])
        self.db.add_all([self.dataset, self.version])
        self.add_row(city="Ahmedabad", micro_market_location="Gota", code="001", price="10.50",
                     secret="Hidden", note="Note")
        self.db.flush()
        self.service = load_ast("app/services/structured_dataset_service.py", dict(
            Session=Session, Dataset=Dataset, Version=Version, Row=Row,
            WidgetConfig=NS(), HTTPException=HTTPException, QueryPlan=SCHEMA.QueryPlan,
            require_enabled=Mock(), require_widget=Mock(), MAX_ROWS=2000,
            re=re, Decimal=Decimal, InvalidOperation=InvalidOperation,
            localcontext=localcontext, date=date),
            {"get_dataset", "get_version", "versions_query", "rows_query", "normalize",
             "resolve_text_filter_values", "execute_query"})

    def add_row(self, **values):
        self.db.add(Row(organization_id=7, widget_id="widget", dataset_id=10, version_id=20,
                        row_number=1, values=values))

    def plan(self, value="Gota, Ahmedabad", key="city", **updates):
        plan = dict(dataset_id=10, version_id=20, operation="lookup",
                    filters=[dict(column=key, operator="eq", value=value)], select=["city"])
        plan.update(updates)
        return plan

    def resolve(self, plan, org=7, widget="widget"):
        return self.service["resolve_text_filter_values"](self.db, org, widget, plan)

    def assert_rejected(self, plan, status=422, **scope):
        with self.assertRaises(HTTPException) as caught:
            self.resolve(plan, **scope)
        self.assertEqual(caught.exception.status_code, status)

    def test_gota_ahmedabad_each_column_resolves_and_real_executor_matches(self):
        plan = self.plan(filters=[dict(column=key, operator="eq", value="Gota, Ahmedabad")
                                 for key in ("city", "micro_market_location")])
        original = deepcopy(plan)
        resolved = self.resolve(plan)
        self.assertEqual([f["value"] for f in resolved["filters"]], ["Ahmedabad", "Gota"])
        self.assertEqual(plan, original)
        result = self.service["execute_query"](self.db, 7, "widget", resolved)
        self.assertEqual((result["status"], result["total_matches"]), ("matched", 1))

    def test_wrong_tokens_substrings_and_other_columns_never_resolve(self):
        for phrase in ("Gota", "Ahmedabadi", "NotAhmedabad", "Ahmedabad_suffix", "Mumbai"):
            with self.subTest(phrase=phrase):
                plan = self.plan(phrase)
                self.assertEqual(self.resolve(plan)["filters"], plan["filters"])

    def test_two_distinct_candidates_and_case_variants_remain_ambiguous(self):
        self.add_row(city="Mumbai")
        self.db.flush()
        plan = self.plan("Ahmedabad, Mumbai")
        self.assertEqual(self.resolve(plan)["filters"], plan["filters"])
        self.add_row(city="AHMEDABAD")
        self.db.flush()
        plan = self.plan()
        self.assertEqual(self.resolve(plan)["filters"], plan["filters"])

    def test_exact_known_identifiers_and_stored_whitespace_are_not_mutated(self):
        self.add_row(city=" Ahmedabad ", code="001, 002")
        self.db.flush()
        for key, value in (("code", "001"), ("code", "001, 002"), ("city", " Ahmedabad ")):
            with self.subTest(value=value):
                plan = self.plan(value, key)
                self.assertEqual(self.resolve(plan)["filters"], plan["filters"])

    def test_duplicate_rows_are_distinct_values_casefold_and_literal_regex(self):
        self.add_row(city="Ahmedabad")
        self.add_row(city="A+B (East)")
        self.add_row(city="Straße")
        self.add_row(city="   ")
        self.add_row(city=None)
        self.db.flush()
        for phrase, expected in (("gota, ahmedabad", "Ahmedabad"),
                                 ("near A+B (East), district", "A+B (East)"),
                                 ("in STRASSE, district", "Straße")):
            with self.subTest(phrase=phrase):
                self.assertEqual(self.resolve(self.plan(phrase))["filters"][0]["value"], expected)
        self.assertEqual(self.resolve(self.plan("unrelated"))["filters"][0]["value"], "unrelated")

    def test_numeric_values_and_range_filters_are_unchanged(self):
        for value, operator in (("10.50", "eq"), (10, "gte")):
            plan = self.plan(value, "price")
            plan["filters"][0]["operator"] = operator
            self.assertEqual(self.resolve(plan)["filters"], plan["filters"])
        # Do not convert a numeric input into a text identifier either.
        self.assertEqual(self.resolve(self.plan(1, "code"))["filters"][0]["value"], 1)

    def test_validation_private_unknown_and_nonqueryable_access_before_rows(self):
        real_rows_query = self.service["rows_query"]
        self.service["rows_query"] = Mock(wraps=real_rows_query)
        for plan in (self.plan(key="secret"), self.plan(key="note"), self.plan(key="missing"),
                     self.plan(select=["secret"]), self.plan(select=["missing"]),
                     self.plan(operation="sum", aggregate_column="secret"),
                     self.plan(operation="sum", aggregate_column="city"),
                     self.plan(operation="sum"), self.plan(aggregate_column="price"),
                     self.plan(dataset_id="10"), self.plan(extra="invalid")):
            self.assert_rejected(plan)
        plan = self.plan()
        plan["filters"][0]["operator"] = "lt"
        self.assert_rejected(plan)
        self.service["rows_query"].assert_not_called()

    def test_cross_org_widget_deleted_inactive_and_old_version_are_blocked(self):
        self.assert_rejected(self.plan(), 404, org=8)
        self.assert_rejected(self.plan(), 404, widget="other")
        self.assert_rejected(self.plan(version_id=19), 409)
        self.dataset.is_deleted = True
        self.db.flush()
        self.assert_rejected(self.plan(), 404)
        self.dataset.is_deleted = False
        self.dataset.status = "draft"
        self.assert_rejected(self.plan(), 409)
        self.dataset.status = "active"
        self.version.status = "draft"
        self.assert_rejected(self.plan(), 409)

    def test_version_ownership_is_checked_on_all_scope_keys(self):
        for key, value in (("organization_id", 8), ("widget_id", "other"), ("dataset_id", 11)):
            with self.subTest(key=key):
                original = getattr(self.version, key)
                setattr(self.version, key, value)
                self.db.flush()
                self.assert_rejected(self.plan(), 404)
                setattr(self.version, key, original)
                self.db.flush()

    def test_rows_cannot_leak_from_another_org_widget_dataset_or_version(self):
        for key, value in (("organization_id", 8), ("widget_id", "other"),
                           ("dataset_id", 11), ("version_id", 19)):
            row = dict(organization_id=7, widget_id="widget", dataset_id=10, version_id=20,
                       row_number=2, values={"city": "Mumbai"})
            row[key] = value
            self.db.add(Row(**row))
        self.db.flush()
        plan = self.plan("Mumbai district")
        self.assertEqual(self.resolve(plan)["filters"], plan["filters"])

    def test_2000_rows_allowed_overflow_fail_closed_with_bounded_scan(self):
        self.db.add_all([Row(organization_id=7, widget_id="widget", dataset_id=10, version_id=20,
                             row_number=n, values={"city": "Ahmedabad"}) for n in range(2, 2001)])
        self.db.flush()
        self.assertEqual(self.resolve(self.plan())["filters"][0]["value"], "Ahmedabad")
        self.add_row(city="Mumbai")
        self.db.flush()
        self.assert_rejected(self.plan(), 409)
        bounded_query = Mock()
        bounded_query.limit.return_value.all.return_value = []
        self.service["rows_query"] = Mock(return_value=bounded_query)
        self.resolve(self.plan())
        bounded_query.limit.assert_called_once_with(2001)

    def router_fixture(self):
        chat = chat_tests.GenericDatasetChatTests("runTest")
        chat.setUp()
        self.addCleanup(chat.doCleanups)
        chat.db.configs[0].widget_id = "widget"
        chat.route = lambda message: chat.router.route_dataset_chat(
            message, "session", "widget", 7, chat.db)
        chat.service.get_active_catalog.return_value = [dict(
            dataset_id=10, version_id=20, name="Locations", description="",
            columns=[c for c in self.columns if c["public"]], required_filters=[])]
        chat.service.resolve_text_filter_values.side_effect = lambda db, org, widget, plan: self.resolve(plan, org, widget)
        chat.service.execute_query.side_effect = lambda db, org, widget, plan: self.service["execute_query"](
            self.db, org, widget, plan)
        chat.provider.generate_dataset_plan.return_value = dict(route="structured", query=self.plan(
            filters=[dict(column=key, operator="eq", value="Gota, Ahmedabad")
                     for key in ("city", "micro_market_location")]), clarification=None), USAGE.copy()
        return chat

    def test_real_router_and_executor_resolve_multi_field_phrase(self):
        chat = self.router_fixture()
        result = chat.route("Price in Gota, Ahmedabad?")
        self.assertEqual(result.retrieval_trace["dataset_status"], "matched")
        self.assertEqual([f["value"] for f in chat.service.execute_query.call_args.args[3]["filters"]],
                         ["Ahmedabad", "Gota"])

    def test_router_checks_original_evidence_before_resolution(self):
        chat = self.router_fixture()
        self.assertEqual(chat.route("Price in Gota?").answer_mode, "dataset_unavailable")
        chat.service.resolve_text_filter_values.assert_not_called()
        chat.service.execute_query.assert_not_called()

    def test_router_checks_canonical_evidence_after_resolution(self):
        chat = self.router_fixture()
        resolved = self.plan("invented")
        chat.service.resolve_text_filter_values.side_effect = lambda *args: resolved
        self.assertEqual(chat.route("Price in Gota, Ahmedabad?").answer_mode, "dataset_unavailable")
        chat.service.execute_query.assert_not_called()

    def test_unmatched_spelling_gets_clarification_without_executing_query(self):
        chat = self.router_fixture()
        decision, usage = chat.provider.generate_dataset_plan.return_value
        decision["query"]["filters"] = [
            dict(column="city", operator="eq", value="Pune"),
            dict(column="micro_market_location", operator="eq", value="Baner"),
        ]
        result = chat.route("banner pune")
        self.assertEqual(result.answer_mode, "dataset_clarify")
        self.assertIn("check its spelling", result.override_response)
        chat.service.execute_query.assert_not_called()

    def test_router_casefold_canonical_evidence_and_no_match(self):
        chat = self.router_fixture()
        decision, usage = chat.provider.generate_dataset_plan.return_value
        decision["query"] = self.plan("gota, ahmedabad")
        self.assertEqual(chat.route("Price in gota, ahmedabad?").retrieval_trace["dataset_status"], "matched")
        decision["query"] = self.plan("Gota")
        self.assertEqual(chat.route("Price in Gota?").retrieval_trace["dataset_status"], "no_match")


if __name__ == "__main__":
    unittest.main()