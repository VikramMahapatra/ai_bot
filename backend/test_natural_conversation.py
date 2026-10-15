"""Natural visitor conversations: production AST, SQLite only, no LLM/startup IO."""
from copy import deepcopy
import json
from types import SimpleNamespace as NS
import unittest
from unittest.mock import Mock

from fastapi import HTTPException
import test_dataset_chat as chat_tests
import test_dataset_filter_resolution as filter_tests
import test_company_document_answers as company_tests
from test_dataset_chat import SCHEMA, TYPES, USAGE, column, load_ast


class NaturalConversationTests(unittest.TestCase):
    def setUp(self):
        self.fixture = filter_tests.FilterResolutionTests("runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        f = self.fixture
        f.columns = [SCHEMA.Column.model_validate(c).model_dump() for c in [
            column("city"), {**column("district"), "label": "Area"},
            column("price_range_low", "decimal", currency="INR", unit="per seat"),
            column("price_range_high", "decimal", currency="INR", unit="per seat"),
            {**column("private_note"), "public": False}]]
        f.version.columns = f.columns
        f.version.required_filters = ["city", "district"]
        f.db.query(filter_tests.Row).delete()
        self.data = [dict(city="Pune", district="Kharadi", price_range_low="7000.0", price_range_high="13000.0", private_note="SECRET"),
                     dict(city="Mumbai", district="Andheri East", price_range_low="9000.0", price_range_high="15000.0"),
                     dict(city="Mumbai", district="Andheri West", price_range_low="8500.0", price_range_high="14000.0"),
                     dict(city="Mumbai", district="Bandra", price_range_low="11000.0", price_range_high="17000.0")]
        for i, values in enumerate(self.data, 539):
            f.db.add(filter_tests.Row(organization_id=7, widget_id="widget", dataset_id=10, version_id=20,
                                     row_number=i, values=values))
        f.db.flush()
        load_ast("app/services/structured_dataset_service.py", f.service,
                 {"get_public_catalog_values", "get_public_location_listing", "resolve_explicit_price_lookup"})
        f.service["MAX_TENANT_ROWS"] = 20000
        self.chat = chat_tests.DatasetChatTests("runTest")
        self.chat.setUp()
        self.addCleanup(self.chat.doCleanups)
        self.chat.service.get_active_catalog.return_value = [dict(dataset_id=10, version_id=20,
            name="Published records", description="Approved attributes, not an availability promise",
            columns=[c for c in f.columns if c["public"]], required_filters=f.version.required_filters)]
        for name in ("execute_query", "resolve_text_filter_values"):
            setattr(self.chat.service, name, Mock(side_effect=lambda db, org, widget, plan, name=name:
                    f.service[name](f.db, org, widget, plan)))
        for name in ("get_public_catalog_values", "get_public_location_listing", "resolve_explicit_price_lookup"):
            setattr(self.chat.service, name, Mock(side_effect=lambda db, org, widget, *args, name=name:
                    f.service[name](f.db, org, widget, *args)))
        self.choose()

    def choose(self, city="Pune", area="Kharadi", select=None, carry=()):
        filters = [dict(column="city", operator="eq", value=city)] if city else []
        if area:
            filters.append(dict(column="district", operator="eq", value=area))
        self.chat.provider.generate_dataset_plan.return_value = {
            **chat_tests.decision(filters=filters, select=select or ["price_range_low", "price_range_high"]),
            "carry_filters": list(carry)}, USAGE.copy()

    def history(self, *questions):
        self.chat.db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            (q,) for q in reversed(questions)]

    def test_transcript_city_then_area_natural_exact_source_separate(self):
        self.choose(area=None)
        first = self.chat.route("pune")
        self.assertEqual(first.override_response, "Please specify Area.")
        self.chat.remember(first)
        self.history("hi...", "pune")
        self.choose(carry=["city"])
        plan = self.chat.route("kharadi")
        self.assertEqual(plan.override_response,
            "For Published records (query: City = Pune, Area = Kharadi), Price_Range_Low is INR 7,000.0 per seat.\n"
            "For Published records (query: City = Pune, Area = Kharadi), Price_Range_High is INR 13,000.0 per seat.")
        self.assertEqual(plan.structured_citations[0]["row_numbers"], [539])
        self.assertEqual(plan.structured_citations[0]["version_id"], 20)
        for text in ("Row", "Source:", "version", "SECRET", "per month"):
            self.assertNotIn(text, plan.override_response)
        self.assertEqual(self.chat.provider.generate_dataset_plan.call_count, 2)
        self.chat.service.resolve_explicit_price_lookup.assert_not_called()

    def test_explicit_price_and_contextual_price_have_same_rendering(self):
        self.choose(area=None)
        self.chat.remember(self.chat.route("Pune"))
        self.history("Pune")
        self.choose(carry=["city"])
        contextual = self.chat.route("Kharadi")
        self.choose()
        explicit = self.chat.route("What is the price in Kharadi Pune?")
        self.assertEqual(contextual.override_response, explicit.override_response)
        self.assertEqual(contextual.structured_citations, explicit.structured_citations)

    def test_history_alone_and_unpersisted_carry_never_authorize_city_filter(self):
        self.history("Pune")
        for carry in ((), ("city",)):
            with self.subTest(carry=carry):
                self.choose(carry=carry)
                self.assertEqual(self.chat.route("Kharadi").answer_mode, "dataset_unavailable")
        self.chat.service.execute_query.assert_not_called()

    def test_abbreviation_and_current_city_override(self):
        self.history("Pune", "Kharadi", "are you dealing with residential flats")
        self.choose(city="Mumbai", area=None)
        for message in ("what abt mumbai", "whatabt Mumbai", "whatabout Mumbai", "what about Mumbai"):
            with self.subTest(message=message):
                text = self.chat.route(message).override_response
                self.assertEqual(text, "Please specify Area.")
                payload = json.loads(self.chat.provider.generate_dataset_plan.call_args.args[0][-1]["content"])
                self.assertEqual(payload["question"], message)
                self.assertNotIn("Pune", text)
                self.assertNotIn("Which city", text)
        self.chat.service.execute_query.assert_not_called()

    def test_model_discovery_does_not_invent_popularity_or_bypass_required_fields(self):
        self.history("Pune", "Kharadi")
        self.choose(city="Mumbai", area=None, select=["district"])
        for message in ("let me know top areas in mumbai", "popular areas in Mumbai", "which areas in Mumbai",
                        "list areas in Mumbai", "locations in Mumbai"):
            with self.subTest(message=message):
                plan = self.chat.route(message)
                self.assertEqual(plan.override_response, "Please specify Area.")
                self.assertNotIn("Pune", plan.override_response)
                self.assertEqual(plan.structured_citations, [])
                if "top" in message or "popular" in message:
                    self.assertNotIn("ranked", plan.override_response)
        self.chat.service.execute_query.assert_not_called()

    def test_discovery_does_not_bypass_required_filters_for_actual_lookup(self):
        entry = self.chat.service.get_active_catalog.return_value[0]
        result = self.fixture.service["execute_query"](self.fixture.db, 7, "widget", dict(
            dataset_id=10, version_id=20, operation="lookup", select=["price_range_low"],
            filters=[dict(column="city", operator="eq", value="Mumbai")]))
        self.assertEqual(result["status"], "clarify")
        self.assertEqual(entry["required_filters"], ["city", "district"])
        self.choose(city="Mumbai", area=None, select=["district"])
        self.assertEqual(self.chat.route("top areas in Mumbai").override_response, "Please specify Area.")
        self.chat.service.execute_query.assert_not_called()

    def test_discovery_unique_alphabetical_bounded_ten_with_exact_citations(self):
        f = self.fixture
        for i in range(12):
            f.db.add(filter_tests.Row(organization_id=7, widget_id="widget", dataset_id=10, version_id=20,
                    row_number=600+i, values=dict(city="Mumbai", district=f"Area {i:02}")))
        f.db.add(filter_tests.Row(organization_id=7, widget_id="widget", dataset_id=10, version_id=20,
                row_number=700, values=dict(city="Mumbai", district="Andheri East")))
        f.db.flush()
        listing = self.chat.service.get_public_location_listing(f.db, 7, "widget",
                   self.chat.service.get_active_catalog.return_value[0], "city", "Mumbai", "district")
        self.assertEqual(listing["total_values"], 15)
        self.assertEqual(len(listing["values"]), 10)
        self.assertEqual(listing["values"], sorted(listing["values"]))
        self.assertIn(700, listing["citations"][0]["row_numbers"])
        self.assertNotIn(611, listing["citations"][0]["row_numbers"])
        self.choose(city="Mumbai", area=None, select=["district"])
        self.assertEqual(self.chat.route("top areas in Mumbai").override_response, "Please specify Area.")
        self.chat.service.execute_query.assert_not_called()

    def test_unknown_city_and_compound_filtered_requests_stay_with_planner(self):
        self.history("Pune", "Kharadi")
        self.chat.provider.generate_dataset_plan.side_effect = None
        self.chat.provider.generate_dataset_plan.return_value = dict(route="clarify", query=None), {}
        for message in ("top areas in Unknowncity", "top areas in Mumbai below 8000", "cheapest areas in Mumbai",
                        "top areas in Mumbai and refund policy", "top areas in Mumbai excluding Bandra"):
            self.chat.provider.generate_dataset_plan.reset_mock()
            self.chat.route(message)
            self.chat.provider.generate_dataset_plan.assert_called_once()
        self.chat.service.get_public_location_listing.assert_not_called()

    def test_ambiguous_prefix_retains_options_not_guessed_lookup(self):
        self.history("Mumbai")
        self.chat.provider.generate_dataset_plan.return_value = dict(route="clarify", clarification="Andheri East costs 999"), USAGE
        self.assertEqual(self.chat.route("Andheri").override_response, self.chat.router["SCOPE_UNKNOWN"])
        self.chat.service.execute_query.assert_not_called()

    def test_natural_sync_sse_citations_credit_metrics_and_model_usage(self):
        ns = self.chat.orchestrator()
        message = "price in Kharadi Pune"
        response, sources, usage = ns["generate_chat_response"](message, "s", "widget", 3, 7, self.chat.db)
        stream = ns["stream_chat_response"](message, "s", "widget", 3, 7, self.chat.db)
        self.assertEqual(response, stream[2])
        self.assertEqual(usage["structured_citations"], stream[3]["structured_citations"])
        self.assertEqual(usage["total_tokens"], 18)
        self.assertEqual(self.chat.provider.generate_dataset_plan.call_count, 2)
        self.assertEqual(self.chat.renderer.call_count, 2)
        ns["reserve_chat_credits"].assert_called_once()
        ns["finalize_conversation_metrics"].assert_called_once()
        api, events = self.chat.api_events(stream)
        self.assertEqual(events[1]["text"], response)
        self.assertEqual(events[-1]["structured_citations"], usage["structured_citations"])
        api["_ensure_handoff_offer_response"].assert_not_called()
        self.chat.provider.generate_structured_answer.assert_not_called()

    def test_discovery_private_scope_version_schema_and_overflow_fail_closed(self):
        entry = self.chat.service.get_active_catalog.return_value[0]
        f = self.fixture
        helper = f.service["get_public_location_listing"]
        for org, widget, changed, key in [(8, "widget", entry, "district"), (7, "other", entry, "district"),
                (7, "widget", {**entry, "version_id": 21}, "district"),
                (7, "widget", {**entry, "required_filters": []}, "district"),
                (7, "widget", entry, "private_note"), (7, "widget", entry, "price_range_low")]:
            with self.subTest(org=org, widget=widget, key=key), self.assertRaises(HTTPException):
                helper(f.db, org, widget, changed, "city", "Mumbai", key)
        f.service["rows_query"] = Mock()
        f.service["rows_query"].return_value.limit.return_value.all.return_value = [NS()] * 2001
        with self.assertRaises(HTTPException):
            helper(f.db, 7, "widget", entry, "city", "Mumbai", "district")

    def test_discovery_excludes_foreign_rows_and_never_writes(self):
        f = self.fixture
        for key, value in (("organization_id", 8), ("widget_id", "other"), ("dataset_id", 11), ("version_id", 21)):
            fields = dict(organization_id=7, widget_id="widget", dataset_id=10, version_id=20,
                          row_number=900, values=dict(city="Mumbai", district="FOREIGN"))
            fields[key] = value
            f.db.add(filter_tests.Row(**fields))
        f.db.flush()
        self.choose(city="Mumbai", area="Andheri East", select=["district"])
        self.assertNotIn("FOREIGN", self.chat.route("Mumbai Andheri East").override_response)
        self.assertEqual(self.chat.route("Mumbai Andheri East").structured_citations[0]["row_numbers"], [540])
        self.assertFalse(f.db.new or f.db.dirty or f.db.deleted)

    def test_renderer_decimal_precision_null_boolean_date_generic_labels_and_limits(self):
        cols = [column("code"), column("amount", "decimal", currency="USD"), column("active", "boolean"),
                column("day", "date"), column("optional")]
        entry = self.chat.router["CatalogEntry"].model_validate(dict(dataset_id=10, version_id=20, name="Items",
                description="", columns=cols, required_filters=["code"]))
        query = SCHEMA.QueryPlan(dataset_id=10, version_id=20, operation="lookup", filters=[
            dict(column="code", operator="eq", value="001")])
        row = dict(code="001", amount="123456789.123456789012345678900", active=True, day="2026-10-14", optional=None)
        result = dict(status="matched", rows=[row]*20, total_matches=22, response="technical admin text")
        text = self.chat.router["_visitor_response"](result, query, entry)
        self.assertIn("USD 123,456,789.123456789012345678900", text)
        self.assertIn("Active: true; Day: 2026-10-14; Optional: not available", text)
        self.assertIn("Showing 20 of 22 matching records in Items", text)
        self.assertIn("Code: 001", text)
        self.assertEqual(row["amount"], "123456789.123456789012345678900")

    def test_bounds_remain_separate_exact_fields_without_inferred_range(self):
        entry = self.chat.router["CatalogEntry"].model_validate(self.chat.service.get_active_catalog.return_value[0])
        query = SCHEMA.QueryPlan(dataset_id=10, operation="lookup", select=["price_range_low", "price_range_high"])
        result = dict(status="matched", rows=[dict(price_range_low="7000.0", price_range_high="13000.0")], total_matches=1)
        render = self.chat.router["_visitor_response"]
        self.assertEqual(render(result, query, entry),
            "Published records: Price_Range_Low: INR 7,000.0 per seat; Price_Range_High: INR 13,000.0 per seat.")
        changed = entry.model_copy(deep=True)
        changed.columns[-1].unit = "per month"
        self.assertNotIn("7,000–13,000", render(result, query, changed))
        changed = entry.model_copy(deep=True)
        for c in changed.columns[-2:]:
            c.label = "Typical " + c.label
        self.assertIn("Typical Price_Range_Low", render(result, query, changed))
        self.assertIn("Typical Price_Range_High", render(result, query, changed))
        result["rows"][0]["price_range_low"] = "15000"
        self.assertNotIn("15,000–13,000", render(result, query, entry))

    def test_admin_response_unchanged_and_private_result_rejected(self):
        self.chat.route("price in Kharadi Pune")
        query = self.chat.service.execute_query.call_args.args[3]
        result = self.fixture.service["execute_query"](self.fixture.db, 7, "widget", query)
        self.assertIn("Row 539:", result["response"])
        self.assertIn("Source:", result["response"])
        result["rows"][0]["private_note"] = "SECRET"
        entry = self.chat.router["CatalogEntry"].model_validate(self.chat.service.get_active_catalog.return_value[0])
        with self.assertRaises(ValueError):
            self.chat.router["_visitor_response"](result, SCHEMA.QueryPlan.model_validate(query), entry)


class GreetingTests(unittest.TestCase):
    def setUp(self):
        self.chat = chat_tests.DatasetChatTests("runTest")
        self.chat.setUp()
        self.addCleanup(self.chat.doCleanups)
        self.ns = self.chat.orchestrator()
        load_ast("app/services/chat/orchestrator.py", self.ns, {"_is_bare_clarification", "_build_vector_plan"})

    def test_punctuation_greetings_before_catalog_no_llm_even_with_prior_location(self):
        for message in ("hi...", "hello!", "Hi?!", "hey…", "good morning!"):
            plan = self.ns["_build_plan"](message, "s", "widget", 7, self.chat.db)
            self.assertEqual(plan.override_response, "Hi! How can I help you?")
            self.assertFalse(plan.should_generate_llm_response)
        self.chat.service.get_active_catalog.assert_not_called()
        self.chat.db.query.assert_not_called()
        self.chat.provider.generate_dataset_plan.assert_not_called()

    def test_compound_greetings_remain_normal_questions(self):
        for message in ("hi prices", "hello! price for 001", "hi... offices in Pune"):
            self.assertFalse(self.ns["_is_small_talk_message"](message))

    def test_disabled_greeting_still_legacy_and_does_not_access_datasets(self):
        self.chat.settings.STRUCTURED_DATASETS_ENABLED = False
        self.assertEqual(self.ns["_build_plan"]("hello!", "s", "widget", 7, self.chat.db).override_response,
                         "Hi! How can I help you?")
        self.chat.service.get_active_catalog.assert_not_called()


class ServiceEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.company = company_tests.CompanyDocumentTests("runTest")
        self.company.setUp()
        self.addCleanup(self.company.doCleanups)

    def test_unconfirmed_service_false_answer_has_natural_limit_no_negative_claim(self):
        message = "are you dealing with residential flats"
        plan = self.company.plan(message)
        text = self.company.ns["_finalize_response"](plan, self.company.answer(
            "This topic is not covered in the knowledge base", answered=False), message)
        self.assertEqual(text, "I don’t have verified information to confirm that detail.")
        self.assertNotIn("knowledge base", text)
        self.assertNotIn("does not offer", text)
        self.assertIn("An explicit exclusion requires explicit evidence", plan.messages[0]["content"])

    def test_grounded_supported_services_contrast_passes_normal_validation(self):
        c = self.company
        context = "Acme provides commercial workspaces including offices, coworking and managed offices."
        c.retrieval = deepcopy(c.retrieval)
        from dataclasses import replace
        retrieval = replace(c.retrieval, context_text=context, chunks=[replace(c.retrieval.chunks[0], text=context)])
        c.ns["retrieve_hybrid_result"].return_value = retrieval
        message = "are you dealing with residential flats"
        plan = c.plan(message)
        answer = "The information I have describes commercial workspaces—offices, coworking and managed offices. It doesn’t confirm residential-flat services."
        self.assertEqual(c.ns["_finalize_response"](plan, c.answer(answer), message), answer)
        self.assertTrue(plan.retrieval_trace["prepared_response"])
        c.ns["validate_answer"].assert_called_once()


if __name__ == "__main__":
    unittest.main()