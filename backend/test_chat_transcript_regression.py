"""Production-source regression tests; isolated clients and in-memory data only."""
import json
import math
import unittest
from unittest.mock import Mock
from dataclasses import replace
from types import SimpleNamespace as NS

import test_dataset_chat as chat_tests
import test_dataset_generic_chat as generic
from test_dataset_chat import TYPES, USAGE, column, load_ast


class VectorStreamingTests(unittest.TestCase):
    def setUp(self):
        self.fixture = chat_tests.DatasetChatTests("runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.ns = self.fixture.orchestrator()
        load_ast("app/services/chat/orchestrator.py", self.ns, {"_generate_structured_response"})
        self.ns["_has_prior_escalation_contacts"] = Mock(return_value=False)
        self.ns["build_soft_fallback_message"] = Mock(return_value="No verified information is available.")
        context = "Our services include office space advisory and document support."
        retrieval = TYPES.HybridRetrievalResult("", [], TYPES.RetrievalConfidence(.9, "high"),
                                               {}, [], context)
        self.plan = TYPES.ChatResponsePlan(True, None, False, "No verified information is available.",
                                          {}, [], [{"role": "system", "content": "Return structured JSON."}], retrieval)
        self.ns["_build_plan"] = Mock(return_value=self.plan)

    def stream(self, question, **updates):
        raw = dict(answered=True, confidence=.9, requires_escalation=False,
                   response="Our services include office space advisory.")
        raw.update(updates)
        self.fixture.provider.generate_structured_answer.return_value = raw, USAGE.copy()
        return self.ns["stream_chat_response"](question, "s", "w", 3, 7, self.fixture.db)

    def test_all_vector_questions_validate_before_sse_no_raw_json_or_handoff(self):
        for question in ["are you dealing with office space?", "do you have office space in pune?",
                         "Explain your document support", "Unrelated vector question"]:
            with self.subTest(question=question):
                result = self.stream(question)
                self.assertIsNone(result[0])
                self.assertEqual(result[2], "Our services include office space advisory.")
                self.assertTrue(result[3]["prepared_response"])
                api, events = self.fixture.api_events(result)
                self.assertEqual(events[1]["text"], result[2])
                self.assertFalse(events[1]["text"].startswith("{"))
                api["_ensure_handoff_offer_response"].assert_not_called()
                self.assertEqual(result[3]["token_usage"], USAGE)
        self.fixture.provider.stream_chat_completion.assert_not_called()

    def test_answered_false_cannot_be_accepted_in_sync_or_stream(self):
        result = self.stream("Do you have offices?", answered=False)
        self.assertNotEqual(result[2], "Our services include office space advisory.")
        self.assertFalse(result[3].get("prepared_response", False))
        response, _, _ = self.ns["generate_chat_response"]("Do you have offices?", "s", "w", 3, 7, self.fixture.db)
        self.assertEqual(response, result[2])
        api, _ = self.fixture.api_events(result)
        api["_ensure_handoff_offer_response"].assert_called_once()

    def test_model_failure_preserves_usage_and_existing_handoff(self):
        error = RuntimeError("unavailable")
        error.token_usage = USAGE.copy()
        self.fixture.provider.generate_structured_answer.side_effect = error
        result = self.ns["stream_chat_response"]("question", "s", "w", 3, 7, self.fixture.db)
        self.assertIsNone(result[0])
        self.assertFalse(result[3].get("prepared_response", False))
        self.assertEqual(result[3]["token_usage"], USAGE)
        api, _ = self.fixture.api_events(result)
        api["_ensure_handoff_offer_response"].assert_called_once()

    def test_rejected_answer_not_authoritative_and_planner_usage_added(self):
        self.ns["_build_plan"].return_value = replace(self.plan, token_usage=USAGE.copy())
        self.ns["validate_answer"].return_value = TYPES.ValidatedResponse(False, "unsafe", 0, 0)
        result = self.stream("question")
        self.assertFalse(result[3].get("prepared_response", False))
        self.assertEqual(result[3]["token_usage"]["total_tokens"], 36)


class CatalogTranscriptTests(unittest.TestCase):
    def setUp(self):
        self.fixture = chat_tests.DatasetChatTests("runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.service.get_active_catalog.return_value = [generic.COURSES.copy()]
        self.fixture.config.system_prompt = "Offer advice on learning programs; published metadata is not enrollment availability."
        self.fixture.service.get_public_catalog_values = Mock(side_effect=AssertionError("No legacy catalog scan"))
        self.fixture.provider.generate_dataset_plan.return_value = dict(route="clarify", query=None), USAGE.copy()

    def choose(self, campus="North", program=None, carry=()):
        filters = [dict(column="campus", operator="eq", value=campus)]
        if program:
            filters.append(dict(column="program", operator="eq", value=program))
        self.fixture.provider.generate_dataset_plan.return_value = {
            **generic.decision(filters=filters), "carry_filters": list(carry)}, USAGE.copy()

    def payload(self):
        return json.loads(self.fixture.provider.generate_dataset_plan.call_args.args[0][-1]["content"])

    def metadata(self):
        self.fixture.provider.generate_dataset_plan.return_value = dict(route="metadata", dataset_ids=[10]), USAGE.copy()
        # Use the actual generic slot renderer and independent verification path.
        self.fixture.renderer.side_effect = self.fixture.generic.render_slots

    def history(self, *questions):
        self.fixture.db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            (q,) for q in reversed(questions)]

    def test_scope_uses_model_metadata_not_inventory_claims(self):
        self.metadata()
        for campus in ("North", "South", "West"):
            plan = self.fixture.route(f"Can you advise on programs at {campus}?")
            self.assertEqual(plan.answer_mode, "dataset_metadata")
            self.assertIn("Course catalog", plan.override_response)
            self.assertIn("does not confirm actual offerings", plan.override_response)
            self.assertNotIn("available programs", plan.override_response)
            self.assertNotIn("agent_system_prompt", self.payload())
            messages = self.fixture.provider.generate_dataset_plan.call_args.args[0]
            self.assertEqual(messages[1]["role"], "system")
            self.assertIn(self.fixture.config.system_prompt, messages[1]["content"])
            self.assertNotIn(self.fixture.config.system_prompt, messages[-1]["content"])
        self.assertEqual(self.fixture.provider.generate_dataset_plan.call_count, 3)
        self.fixture.service.execute_query.assert_not_called()

    def test_broad_service_question_routes_to_company_documents(self):
        self.fixture.provider.generate_dataset_plan.return_value = dict(route="vector"), USAGE.copy()
        plan = self.fixture.route("Explain the external admissions policy")
        self.assertEqual(plan.answer_mode, "vector")
        self.assertTrue(plan.retrieval_trace["dataset_document_question"])
        self.fixture.provider.generate_dataset_plan.assert_called_once()
        self.fixture.service.execute_query.assert_not_called()

    def test_followup_new_campus_overrides_prior(self):
        self.history("programs at North?")
        self.choose(campus="South")
        plan = self.fixture.route("what about South?")
        self.assertEqual(plan.override_response, "Please specify Program.")
        self.assertNotIn("North", plan.override_response)
        marker = plan.retrieval_trace["selected_chunks"][-1]
        self.assertEqual(marker["query"]["filters"][0]["value"], "South")

    def test_ambiguous_program_never_selects_or_queries(self):
        for question in ("North Phys", "Phys"):
            self.history("programs at North")
            plan = self.fixture.route(question)
            self.assertEqual(plan.override_response, self.fixture.router["SCOPE_UNKNOWN"])
            self.fixture.service.execute_query.assert_not_called()
        self.assertNotIn("Physics", plan.override_response)
        self.assertEqual(self.fixture.provider.generate_dataset_plan.call_count, 2)

    def test_campus_only_after_program_question_keeps_campus(self):
        self.history("tuition?", "North")
        self.choose()
        self.assertEqual(self.fixture.route("North").override_response, "Please specify Program.")
        self.assertEqual(self.payload()["prior_questions"], ["tuition?", "North"])

    def test_exact_program_selection_uses_scoped_campus_and_pinned_version(self):
        self.choose()
        self.fixture.remember(self.fixture.route("tuition at North"))
        self.history("tuition at North", "Phys")
        self.choose(program="Physics", carry=["campus"])
        self.fixture.service.execute_query.return_value.update(rows=[dict(tuition="7000.00")])
        plan = self.fixture.route("Physics")
        query = self.fixture.service.execute_query.call_args.args[3]
        self.assertEqual(query["version_id"], 20)
        self.assertEqual({f["column"]: f["value"] for f in query["filters"]},
                         {"campus": "North", "program": "Physics"})
        self.assertIn("EUR 7,000.00 per term", plan.override_response)

    def test_unknown_campus_never_becomes_available_from_prior_campus(self):
        self.history("programs at North?")
        self.fixture.provider.generate_dataset_plan.return_value = dict(route="vector"), USAGE
        plan = self.fixture.route("Are programs available at Unknowncampus?")
        self.assertEqual(plan.answer_mode, "vector")
        self.assertNotIn("North", str(plan.override_response))
        self.fixture.service.execute_query.assert_not_called()

    def test_program_followup_history_without_persisted_campus_fails_closed(self):
        self.history("tuition at North", "Phys")
        for carry in ((), ("campus",)):
            with self.subTest(carry=carry):
                self.choose(program="Physics", carry=carry)
                self.assertEqual(self.fixture.route("Physics").answer_mode, "dataset_unavailable")
        self.fixture.service.execute_query.assert_not_called()

    def test_what_after_scope_uses_model_clarification(self):
        self.history("What learning advice do you offer?")
        text = self.fixture.route("what?").override_response
        self.assertEqual(text, self.fixture.router["SCOPE_UNKNOWN"])
        self.assertNotIn("Campus", text)
        self.fixture.provider.generate_dataset_plan.assert_called_once()

    def test_referential_scope_and_item_questions_follow_model_decisions(self):
        self.history("What advice do you offer?", "What about programs?")
        self.metadata()
        self.assertIn("Course catalog", self.fixture.route("what?").override_response)
        self.choose(campus="West")
        self.assertEqual(self.fixture.route("what about West?").override_response, "Please specify Program.")
        self.history("What advice do you offer?", "tuition at South")
        self.choose(campus="South")
        self.fixture.remember(self.fixture.route("tuition at South"))
        self.choose(campus="South", carry=["campus"])
        self.assertEqual(self.fixture.route("what?").override_response, "Please specify Program.")
        self.fixture.service.execute_query.assert_not_called()

    def test_private_values_never_enter_planner_prompt(self):
        self.fixture.service.execute_query.return_value["rows"] = [{"tuition": "PRIVATE ROW VALUE"}]
        self.fixture.route("North Physics")
        self.fixture.provider.generate_dataset_plan.assert_called_once()
        self.assertNotIn("PRIVATE ROW VALUE", json.dumps(self.payload()))
        self.fixture.service.get_public_catalog_values.assert_not_called()
        self.assertEqual(self.fixture.service.get_active_catalog.call_args.args[1:3], (7, "widget"))

    def test_aggregate_compound_and_unrelated_requests_remain_constrained(self):
        for question in ("lowest North Physics", "count North", "North Physics policy",
                 "North technology", "North tuition 100", "not North Physics"):
            with self.subTest(question=question):
                self.fixture.provider.generate_dataset_plan.reset_mock()
                self.fixture.route(question)
                self.fixture.provider.generate_dataset_plan.assert_called_once()
        self.fixture.service.execute_query.assert_not_called()

    def test_current_different_campus_never_implicitly_carries_previous_program(self):
        self.history("tuition at North", "Physics")
        self.choose(campus="South")
        plan = self.fixture.route("South")
        self.assertEqual(plan.override_response, "Please specify Program.")
        self.assertEqual(plan.retrieval_trace["selected_chunks"][-1]["query"]["filters"],
                         [dict(column="campus", operator="eq", value="South")])
        self.fixture.service.execute_query.assert_not_called()

    def test_service_bounds_failure_fails_closed(self):
        self.fixture.service.get_active_catalog.side_effect = ValueError("overflow")
        self.assertEqual(self.fixture.route("North Physics").answer_mode, "dataset_unavailable")
        self.fixture.provider.generate_dataset_plan.assert_not_called()
        self.fixture.service.execute_query.assert_not_called()


class CompletionBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.ns = load_ast("app/services/chat/openai_service.py", dict(
            Any=object, Dict=dict, Tuple=tuple, json=json, math=math),
            {"StructuredCompletionError", "_validated_completion_payload"})

    def completion(self, raw, finish="stop"):
        return NS(usage=NS(**USAGE), choices=[NS(finish_reason=finish, message=NS(content=raw))])

    def test_valid_conversational_json_returns_only_validated_payload_and_usage(self):
        raw = dict(answered=True, confidence=.9, requires_escalation=False, response="Office advisory.")
        self.assertEqual(self.ns["_validated_completion_payload"](self.completion(json.dumps(raw))), (raw, USAGE))

    def test_truncated_duplicate_nonfinite_boolean_string_and_nested_json_fail_closed(self):
        raw = dict(answered=True, confidence=.9, requires_escalation=False, response="Office advisory.")
        cases = [(json.dumps(raw), "length"), ("bad", "stop"), ("[]", "stop"),
                 ('{"answered":true,"answered":false}', "stop")]
        cases += [(json.dumps({**raw, **updates}), "stop") for updates in (
            {"confidence": float("nan")}, {"confidence": True}, {"answered": "false"},
            {"requires_escalation": "false"}, {"response": '{"response":"raw"}'},
            {"response": "```json raw"}, {"extra": "private"})]
        for content, finish in cases:
            with self.subTest(content=content, finish=finish):
                with self.assertRaises(self.ns["StructuredCompletionError"]) as caught:
                    self.ns["_validated_completion_payload"](self.completion(content, finish))
                self.assertEqual(caught.exception.token_usage, USAGE)


class PublicValuesBoundaryTests(unittest.TestCase):
    def setUp(self):
        from test_dataset_filter_resolution import FilterResolutionTests
        self.fixture = FilterResolutionTests("runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.service = self.fixture.service
        load_ast("app/services/structured_dataset_service.py", self.service, {"get_public_catalog_values"})
        self.entry = dict(dataset_id=10, version_id=20,
                          columns=[c for c in self.fixture.columns if c["public"]], required_filters=[])

    def values(self, keys=None, org=7, widget="widget", entry=None):
        return self.service["get_public_catalog_values"](self.fixture.db, org, widget,
                                                        entry or self.entry, keys or ["city", "micro_market_location"])

    def test_projection_excludes_private_prices_and_scoped_foreign_rows(self):
        from test_dataset_filter_resolution import Row
        for key, value in (("organization_id", 8), ("widget_id", "other"),
                           ("dataset_id", 11), ("version_id", 21)):
            fields = dict(organization_id=7, widget_id="widget", dataset_id=10, version_id=20,
                          row_number=2, values={"city": "PRIVATE FOREIGN CITY"})
            fields[key] = value
            self.fixture.db.add(Row(**fields))
        self.fixture.db.flush()
        self.assertEqual(self.values(), [{"city": "Ahmedabad", "micro_market_location": "Gota"}])

    def test_private_nonqueryable_numeric_and_wrong_scope_rejected_before_row_io(self):
        from fastapi import HTTPException
        self.service["rows_query"] = Mock(wraps=self.service["rows_query"])
        for args in ({"keys": ["secret"]}, {"keys": ["note"]}, {"keys": ["price"]},
                     {"org": 8}, {"widget": "other"}, {"entry": {**self.entry, "version_id": 21}},
                     {"entry": {**self.entry, "required_filters": ["city"]}}):
            with self.subTest(args=args), self.assertRaises(HTTPException):
                self.values(**args)
        self.service["rows_query"].assert_not_called()

    def test_2000_bound_empty_and_overflow_fail_closed(self):
        from fastapi import HTTPException
        query = Mock()
        self.service["rows_query"] = Mock(return_value=query)
        query.limit.return_value.all.return_value = []
        self.assertEqual(self.values(), [])
        query.limit.assert_called_once_with(2001)
        query.limit.return_value.all.return_value = [NS(values={"city": "A"})] * 2000
        self.assertEqual(len(self.values()), 2000)
        query.limit.return_value.all.return_value.append(NS(values={"city": "B"}))
        with self.assertRaises(HTTPException):
            self.values()


if __name__ == "__main__":
    unittest.main()