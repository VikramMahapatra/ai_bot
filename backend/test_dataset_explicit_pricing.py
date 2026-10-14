"""Exact pricing regressions: real scoped SQL service, isolated in-memory DB only."""
import json
import unittest
from unittest.mock import Mock
from test_dataset_chat import SCHEMA
from test_dataset_generic_chat import PLANNER_USAGE
import test_dataset_filter_resolution as filter_tests
from test_dataset_filter_resolution import Dataset, Version, Row
from fastapi import HTTPException


class ExplicitPricingTests(unittest.TestCase):
    def setUp(self):
        self.fixture = filter_tests.FilterResolutionTests("runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        f = self.fixture
        f.columns = [SCHEMA.Column.model_validate(c).model_dump() for c in f.columns]
        f.version.columns = f.columns
        f.version.required_filters = ["city", "micro_market_location"]
        f.db.flush()
        from test_dataset_chat import load_ast
        f.service["MAX_TENANT_ROWS"] = 20000
        load_ast("app/services/structured_dataset_service.py", f.service, {"resolve_explicit_price_lookup"})
        self.chat = f.router_fixture()
        self.chat.service.get_active_catalog.return_value[0]["required_filters"] = f.version.required_filters
        self.chat.provider.generate_dataset_plan.return_value = dict(route="clarify", query=None), {}

    def resolve(self, question="What is the coworking price per seat in Gota, Ahmedabad?", org=7, widget="widget"):
        return self.fixture.service["resolve_explicit_price_lookup"](
            self.fixture.db, org, widget, question, self.chat.service.get_active_catalog.return_value)

    def test_generic_planner_metadata_exact_filters_and_numeric_permissions(self):
        f, chat = self.fixture, self.chat
        f.service["rows_query"] = Mock(wraps=f.service["rows_query"])

        def planner(messages):
            # The planner runs before either real resolver/executor row scan.
            f.service["rows_query"].assert_not_called()
            payload = json.loads(messages[-1]["content"])
            self.assertEqual(messages[1]["role"], "system")
            self.assertIn(chat.db.configs[0].system_prompt, messages[1]["content"])
            self.assertNotIn("agent_system_prompt", payload)
            self.assertEqual(payload["prior_questions"], [])
            self.assertIsNone(payload["query_context"])
            self.assertEqual(payload["catalog"][0]["required_filters"],
                             ["city", "micro_market_location"])
            columns = {c["key"]: c for c in payload["catalog"][0]["columns"]}
            self.assertEqual(columns["price"]["data_type"], "decimal")
            self.assertNotIn("secret", columns)
            self.assertFalse(columns["note"]["queryable"])
            self.assertNotIn("rows", payload["catalog"][0])
            for value in ("10.50", "Hidden"):
                self.assertNotIn(value, json.dumps(payload))
            return dict(route="structured", query=f.plan(
                filters=[dict(column="city", operator="eq", value="Ahmedabad"),
                         dict(column="micro_market_location", operator="eq", value="Gota")],
                select=["price"])), PLANNER_USAGE.copy()

        chat.provider.generate_dataset_plan.side_effect = planner
        for question in ["What is the coworking price per seat in Gota, Ahmedabad?",
                         "Price in GOTA, ahmedabad?", "How much does it cost in Gota Ahmedabad?"]:
            f.service["rows_query"].reset_mock()
            chat.provider.generate_dataset_plan.reset_mock()
            chat.provider.generate_structured_answer.reset_mock()
            chat.service.execute_query.reset_mock()
            plan = chat.route(question)
            self.assertEqual(plan.answer_mode, "structured")
            self.assertIn("10.50", plan.override_response)
            self.assertNotIn("Hidden", plan.override_response)
            self.assertNotIn("Note", plan.override_response)
            self.assertEqual(plan.token_usage["total_tokens"], 32)
            chat.provider.generate_dataset_plan.assert_called_once()
            chat.service.execute_query.assert_called_once()
            self.assertEqual(chat.service.execute_query.call_args.args[:3], (chat.db, 7, "widget"))
            query = chat.service.execute_query.call_args.args[3]
            self.assertEqual(query["version_id"], 20)
            self.assertEqual(query["select"], ["price"])
            self.assertEqual(query["filters"], [
                dict(column="city", operator="eq", value="Ahmedabad"),
                dict(column="micro_market_location", operator="eq", value="Gota")])
            self.assertEqual(plan.retrieval_trace["dataset_status"], "matched")
            template = chat.answer_payload("generate_template")
            self.assertEqual(list(template["opaque_slots"].values()), ["10.50"])
            self.assertNotIn("10.50", json.dumps(template["authorized_facts"]))
            verified = chat.answer_payload("verify_grounding")
            self.assertEqual([fact["value"] for fact in verified["authorized_facts"]], ["10.50"])
            self.assertEqual(verified["candidate"], plan.override_response)
            self.assertEqual(f.service["rows_query"].call_count, 2)

        # A bad planner is rejected, never rescued by a price-domain shortcut.
        chat.provider.generate_dataset_plan.side_effect = None
        for updates in (dict(select=["secret"]),
                        dict(filters=[dict(column="note", operator="eq", value="Note")]),
                        dict(filters=[dict(column="price", operator="eq", value="10")])):
            with self.subTest(updates=updates):
                f.service["rows_query"].reset_mock()
                chat.service.resolve_text_filter_values.reset_mock()
                chat.service.execute_query.reset_mock()
                chat.provider.generate_structured_answer.reset_mock()
                chat.plan(dict(route="structured", query=f.plan(**{"select": ["price"], **updates})))
                self.assertEqual(chat.route("Price in Gota, Ahmedabad?").answer_mode,
                                 "dataset_unavailable")
                chat.service.resolve_text_filter_values.assert_not_called()
                chat.service.execute_query.assert_not_called()
                chat.provider.generate_structured_answer.assert_not_called()
                f.service["rows_query"].assert_not_called()

        # Even a matching real row cannot authorize a model-invented number.
        chat.plan(dict(route="structured", query=f.plan(
            filters=[dict(column="city", operator="eq", value="Ahmedabad"),
                     dict(column="micro_market_location", operator="eq", value="Gota")],
            select=["price"])))
        chat.compose("The price is 999.")
        chat.provider.generate_structured_answer.reset_mock()
        plan = chat.route("Price in Gota, Ahmedabad?")
        self.assertEqual(plan.answer_mode, "structured")
        self.assertIn("10.50", plan.override_response)
        self.assertNotIn("999", plan.override_response)
        self.assertEqual(plan.override_response, plan.grounded_fallback)
        chat.provider.generate_structured_answer.assert_called_once()
        self.assertEqual(chat.answer_payload("generate_template")["opaque_slots"],
                         {"[[VALUE_a]]": "10.50"})
        chat.service.resolve_explicit_price_lookup.assert_not_called()
        chat.service.get_public_catalog_values.assert_not_called()

    def test_missing_no_match_conflicts_substrings_and_numeric_filters_do_not_guess(self):
        for question in ["Price in Ahmedabad?", "Price in Gota?", "Price in Gotaville, Ahmedabad?",
                         "Price in Gota, Mumbai?", "Price in Gota, Ahmedabad below 20?",
                         "Count prices in Gota Ahmedabad", "Minimum price in Gota Ahmedabad",
                         "Cheaper prices in Gota Ahmedabad", "Price and services in Gota Ahmedabad",
                         "Price in Gota Ahmedabad and returns policy?", "Price in Gota Ahmedabad excluding code?",
                         "Price and note in Gota Ahmedabad", "Price in Gota Ahmedabad only secret",
                         "Do you operate in Gota Ahmedabad?"]:
            with self.subTest(question=question):
                self.assertIsNone(self.resolve(question))
        self.fixture.add_row(city="Mumbai", micro_market_location="Gota", price="20")
        self.fixture.db.flush()
        self.assertIsNone(self.resolve("Price in Gota Ahmedabad Mumbai?"))

    def test_required_values_must_coexist_and_not_share_one_phrase(self):
        self.fixture.db.query(Row).first().values = dict(city="Ahmedabad", micro_market_location="Other", price="10")
        self.fixture.add_row(city="Other", micro_market_location="Gota", price="20")
        self.fixture.db.flush()
        self.assertIsNone(self.resolve())
        self.fixture.db.query(Row).first().values = dict(city="Ahmedabad", micro_market_location="Ahmedabad", price="10")
        self.fixture.db.flush()
        self.assertIsNone(self.resolve("Price in Ahmedabad?"))

    def test_duplicate_rows_ok_but_distinct_case_values_ambiguous(self):
        self.fixture.add_row(city="Ahmedabad", micro_market_location="Gota", price="20")
        self.fixture.db.flush()
        self.assertIsNotNone(self.resolve())
        self.fixture.add_row(city="AHMEDABAD", micro_market_location="Gota", price="30")
        self.fixture.db.flush()
        self.assertIsNone(self.resolve())

    def test_multiple_datasets_and_private_required_fields_never_choose(self):
        f = self.fixture
        f.db.add_all([Dataset(id=11, organization_id=7, widget_id="widget", active_version_id=21),
                      Version(id=21, organization_id=7, widget_id="widget", dataset_id=11,
                              columns=f.columns, required_filters=f.version.required_filters),
                      Row(organization_id=7, widget_id="widget", dataset_id=11, version_id=21,
                          row_number=1, values=dict(city="Ahmedabad", micro_market_location="Gota", price="99"))])
        f.db.flush()
        entry = self.chat.service.get_active_catalog.return_value[0]
        self.chat.service.get_active_catalog.return_value.append({**entry, "dataset_id": 11, "version_id": 21})
        self.assertIsNone(self.resolve())
        self.chat.service.get_active_catalog.return_value = [{**entry, "required_filters": ["secret"]}]
        self.assertIsNone(self.resolve("Price for Hidden?"))

    def test_scope_version_schema_and_row_bounds_fail_closed(self):
        for org, widget in [(8, "widget"), (7, "other")]:
            with self.assertRaises(HTTPException):
                self.resolve(org=org, widget=widget)
        self.fixture.dataset.active_version_id = 21
        self.fixture.db.flush()
        with self.assertRaises(HTTPException):
            self.resolve()
        self.fixture.dataset.active_version_id = 20
        self.fixture.version.required_filters = ["city"]
        self.fixture.db.flush()
        with self.assertRaises(HTTPException):
            self.resolve()
        self.fixture.version.required_filters = ["city", "micro_market_location"]
        self.fixture.service["rows_query"] = Mock()
        self.fixture.service["rows_query"].return_value.limit.return_value.all.return_value = [Mock()] * 2001
        with self.assertRaises(HTTPException):
            self.resolve()
        self.fixture.service["rows_query"].return_value.limit.assert_called_once_with(2001)


if __name__ == "__main__":
    unittest.main()