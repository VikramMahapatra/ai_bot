"""Generic router contracts: real AST/schema/types; no eager app/DB/Chroma imports.

Run from backend: python -m unittest test_dataset_generic_chat -v
The in-memory query fixture actually applies scope predicates and history floors;
it does not bypass RetrievalTrace loading or return unscoped canned history.
"""
import ast
import copy
import importlib.util
import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace as NS
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).parent


def load_source(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


SCHEMA = load_source("_generic_dataset_schema", "app/schemas/structured_dataset.py")
TYPES = load_source("_generic_dataset_types", "app/services/chat/types.py")


class Field:
    def __init__(self, name):
        self.name = name

    def __eq__(self, value):
        return self.name, "eq", value

    def __gt__(self, value):
        return self.name, "gt", value

    def desc(self):
        return self.name


def model():
    return NS(**{k: Field(k) for k in (
        "message", "organization_id", "widget_id", "session_id", "created_at", "id")})


CONVERSATION, TRACE, CONFIG = model(), model(), model()


class Query:
    def __init__(self, db, target):
        self.db, self.target, self.predicates, self.bound = db, target, [], None

    def filter(self, *predicates):
        self.predicates.extend(predicates)
        return self

    def order_by(self, *args):
        return self

    def limit(self, bound):
        self.bound = bound
        return self

    def records(self):
        if self.target is CONFIG:
            rows = self.db.configs
        elif self.target is TRACE:
            rows = self.db.traces
        elif self.target is CONVERSATION.message:
            rows = self.db.history
        else:
            raise AssertionError("Unexpected query target")
        for field, operation, expected in self.predicates:
            rows = [r for r in rows if (getattr(r, field) == expected if operation == "eq"
                                       else getattr(r, field) > expected)]
        rows = sorted(rows, key=lambda r: r.id, reverse=True)
        return rows[:self.bound] if self.bound else rows

    def first(self):
        rows = self.records()
        return rows[0] if rows else None

    def all(self):
        return [(r.message,) for r in self.records()]


class Database:
    def __init__(self):
        self.configs = [NS(id=1, organization_id=7, widget_id="w", system_prompt=(
            "We advise on learning programs.\nWe explicitly do not provide transport services."))]
        self.traces, self.history, self.queries = [], [], []

    def query(self, target):
        query = Query(self, target)
        self.queries.append(query)
        return query

    def question(self, text, index, org=7, widget="w", session="s"):
        self.history.append(NS(id=index, organization_id=org, widget_id=widget,
                               session_id=session, message=text))

    def persist(self, plan, index):
        self.traces.append(NS(id=index, conversation_id=index, organization_id=7,
                              widget_id="w", session_id="s",
                              selected_chunks=json.dumps(plan.retrieval_trace["selected_chunks"])))


def column(key, label, kind="text", **kwargs):
    return dict(key=key, label=label, data_type=kind, public=True, queryable=True, **kwargs)


COURSES = dict(dataset_id=10, version_id=20, name="Course catalog", description="Published program information",
               columns=[column("campus", "Campus"), column("program", "Program"),
                        column("tuition", "Tuition", "decimal", currency="EUR", unit="per term")],
               required_filters=["campus", "program"])
INVENTORY = dict(dataset_id=11, version_id=21, name="Inventory", description="Published stock attributes",
                 columns=[column("sku", "SKU"), column("color", "Color"),
                          column("mass", "Mass", "decimal", unit="kg")], required_filters=["sku"])
PLANNER_USAGE = dict(prompt_tokens=11, completion_tokens=7, total_tokens=18)
RENDER_USAGE = dict(prompt_tokens=3, completion_tokens=4, total_tokens=7)
VERIFY_USAGE = dict(prompt_tokens=5, completion_tokens=2, total_tokens=7)


def decision(**updates):
    query = dict(dataset_id=10, operation="lookup", select=["tuition"], filters=[
        dict(column="campus", operator="eq", value="North"),
        dict(column="program", operator="eq", value="Physics")])
    query.update(updates)
    return dict(route="structured", query=query)


def envelope(response):
    return dict(answered=True, confidence=1.0, requires_escalation=False, response=response)


class GenericDatasetChatTests(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.settings = NS(STRUCTURED_DATASETS_ENABLED=True, STRUCTURED_DATASETS_CHAT_ENABLED=True,
                           STRUCTURED_DATASETS_ORGANIZATION_IDS="7", OPENAI_CHAT_MODEL="mock",
                           OPENAI_CHAT_TIMEOUT_SECONDS=40)
        self.provider = Mock()
        self.provider.generate_dataset_plan.return_value = decision(), PLANNER_USAGE.copy()
        self.provider.generate_structured_answer.side_effect = self.render_slots
        self.service = ModuleType("app.services.structured_dataset_service")
        self.service.get_active_catalog = Mock(return_value=copy.deepcopy([COURSES, INVENTORY]))
        self.service.resolve_text_filter_values = Mock(side_effect=lambda db, org, widget, plan: plan)
        self.service.execute_query = Mock(return_value=dict(status="matched", rows=[
            dict(tuition="123456789.12345678900")], total_matches=1, citations=[
                dict(dataset_id=10, version_id=20, name="Course catalog", sheet_name="Data", row_numbers=[1])]))
        # Forbidden legacy paths are tripwires, not test bypasses.
        self.service.resolve_explicit_price_lookup = Mock(side_effect=AssertionError("Legacy shortcut"))
        self.service.get_public_catalog_values = Mock(side_effect=AssertionError("No catalog scan"))
        self.module_patch = patch.dict(sys.modules, {"app.services.structured_dataset_service": self.service})
        self.module_patch.start()
        self.addCleanup(self.module_patch.stop)
        tree = ast.parse((ROOT / "app/services/chat/dataset_router.py").read_text(encoding="utf-8"))
        tree.body = [n for n in tree.body if not isinstance(n, ast.ImportFrom) or not (n.module or "").startswith("app.")]
        module = ModuleType("_generic_router_test")
        sys.modules[module.__name__] = module
        module.__dict__.update(settings=self.settings, Conversation=CONVERSATION, RetrievalTrace=TRACE,
                               WidgetConfig=CONFIG, Column=SCHEMA.Column, QueryPlan=SCHEMA.QueryPlan,
                               StrictModel=SCHEMA.StrictModel, openai_service=self.provider,
                               ChatResponsePlan=TYPES.ChatResponsePlan)
        exec(compile(ast.fix_missing_locations(tree), "dataset_router.py", "exec"), module.__dict__)
        self.router = module

    def render_slots(self, **kwargs):
        payload = json.loads(kwargs["messages"][-1]["content"])
        if payload["task"] == "verify_grounding":
            return envelope("supported"), VERIFY_USAGE.copy()
        facts = payload["authorized_facts"]
        if payload["metadata"]:
            text = "\n".join("Published dataset metadata describes " + f["subject"] + ": " + f["value"] +
                             ". This does not confirm actual offerings." for f in facts)
            return envelope(text or "You can ask us for advice on learning programs."), RENDER_USAGE.copy()
        return envelope("Here are the matching details:\n" + self.router._fact_fallback(facts, False)), RENDER_USAGE.copy()

    def answer_payload(self, task):
        return next(json.loads(c.kwargs["messages"][-1]["content"])
                    for c in reversed(self.provider.generate_structured_answer.call_args_list)
                    if json.loads(c.kwargs["messages"][-1]["content"])["task"] == task)

    def compose(self, text, supported=True):
        """Separate generation and independent verdict, never echo a template as verdict."""
        def respond(**kwargs):
            payload = json.loads(kwargs["messages"][-1]["content"])
            if payload["task"] == "verify_grounding":
                return {**envelope("supported" if supported else "unsupported"),
                        "answered": supported}, VERIFY_USAGE.copy()
            return envelope(text(payload) if callable(text) else text), RENDER_USAGE.copy()
        self.provider.generate_structured_answer.side_effect = respond

    def plan(self, raw):
        self.provider.generate_dataset_plan.return_value = raw, PLANNER_USAGE.copy()

    def route(self, message="Tuition for Physics at North?"):
        return self.router.route_dataset_chat(message, "s", "w", 7, self.db)

    def payload(self):
        return json.loads(self.provider.generate_dataset_plan.call_args.args[0][-1]["content"])

    def marker(self, plan):
        return next(c for c in plan.retrieval_trace["selected_chunks"] if c["type"] == "dataset_query_context")

    def seed_context(self, query=None):
        plan = self.route()
        if query is not None:
            self.marker(plan)["query"] = query
        self.db.persist(plan, 100)
        self.db.question("Tuition for Physics at North?", 100)
        self.service.execute_query.reset_mock()
        return plan

    def test_prompt_propagates_to_planner_and_renderer_without_rows_in_planner(self):
        result = self.route()
        self.assertEqual(result.answer_mode, "structured")
        messages = self.provider.generate_dataset_plan.call_args.args[0]
        self.assertEqual([m["role"] for m in messages], ["system", "system", "user"])
        self.assertIn("priority over agent configuration", messages[0]["content"])
        self.assertIn("subject to planning protocol", messages[1]["content"])
        self.assertIn(self.db.configs[0].system_prompt, messages[1]["content"])
        self.assertNotIn("agent_system_prompt", self.payload())
        self.assertNotIn(self.db.configs[0].system_prompt, messages[-1]["content"])
        self.assertNotIn("123456789", json.dumps(self.payload()))
        renderer = self.answer_payload("generate_template")
        verifier = self.answer_payload("verify_grounding")
        for call in self.provider.generate_structured_answer.call_args_list:
            messages = call.kwargs["messages"]
            self.assertEqual(messages[1]["role"], "system")
            self.assertIn(self.db.configs[0].system_prompt, messages[1]["content"])
            self.assertNotIn("agent_system_prompt", json.loads(messages[-1]["content"]))
        self.assertIn("opaque_slots", renderer)
        self.assertEqual(verifier["candidate"], result.override_response)
        self.assertIn("EUR 123,456,789.12345678900 per term", json.dumps(verifier["authorized_facts"]))
        self.assertIn("EUR 123,456,789.12345678900 per term", result.override_response)
        self.assertEqual(result.token_usage, dict(prompt_tokens=19, completion_tokens=13, total_tokens=32))
        self.assertEqual(result.override_response, result.grounded_fallback)
        self.assertFalse(result.should_generate_llm_response)  # same override for stream/nonstream
        self.assertNotIn("rows", self.marker(result)["query"])
        self.service.resolve_explicit_price_lookup.assert_not_called()

    def test_inventory_schema_all_selected_fields_labels_units(self):
        self.plan(decision(dataset_id=11, filters=[dict(column="sku", operator="eq", value="A001")],
                           select=["sku", "color", "mass"]))
        self.service.execute_query.return_value.update(rows=[dict(sku="A001", color="Blue", mass="0.00100")])
        result = self.route("Show all attributes for A001")
        for value in ["A001", "Blue", "0.00100 kg"]:
            self.assertIn(value, result.override_response)
        self.assertNotIn("Inventory", result.override_response)
        self.assertNotIn("EUR", result.override_response)

    def test_metadata_scope_natural_paraphrase_no_row_io_no_config_echo(self):
        self.plan(dict(route="metadata", dataset_ids=[]))
        self.compose("You can ask us for advice on learning programs.")
        result = self.route("What can you advise on?")
        self.assertEqual(result.answer_mode, "dataset_metadata")
        self.assertEqual(result.override_response, "You can ask us for advice on learning programs.")
        self.assertNotIn("configuration", result.override_response)
        self.assertIsNone(self.marker(result)["query"])
        self.service.execute_query.assert_not_called()
        self.service.resolve_text_filter_values.assert_not_called()
        self.service.get_public_catalog_values.assert_not_called()

    def test_metadata_catalog_attribution_not_coverage(self):
        self.plan(dict(route="metadata", dataset_ids=[10]))
        result = self.route("What information is published?")
        self.assertIn("Published dataset metadata", result.override_response)
        self.assertIn("does not confirm actual offerings", result.override_response)
        self.assertNotIn("Tuition:", result.override_response)
        self.service.execute_query.assert_not_called()
        self.assertEqual(self.payload()["prior_questions"], [])

    def test_unsupported_scope_cannot_pivot_or_invent_negative_service(self):
        self.plan(dict(route="metadata", dataset_ids=[]))
        for raw in [envelope("We do not offer shipping."),
                envelope("Here is the published information:\n[[scope_999]]"),
                envelope("Tuition is EUR 99")]:
            with self.subTest(raw=raw):
                self.compose(raw["response"], supported=False)
                result = self.route("Do you offer shipping?")
                self.assertIn("enough verified information", result.override_response)
                self.assertNotIn("99", result.override_response)
        self.service.execute_query.assert_not_called()

    def test_explicit_negative_can_be_naturally_paraphrased_after_verification(self):
        self.plan(dict(route="metadata", dataset_ids=[]))
        self.compose("Transport is outside our services.")
        result = self.route("Do you provide transport services?")
        self.assertEqual(result.override_response, "Transport is outside our services.")
        self.assertIn("Transport is outside", self.answer_payload("verify_grounding")["candidate"])

    def test_model_handles_typo_intent_not_keyword_router(self):
        self.plan(dict(route="metadata", dataset_ids=[]))
        self.route("Wht servces cn you hlp with?")
        self.provider.generate_dataset_plan.assert_called_once()
        planner_messages = self.provider.generate_dataset_plan.call_args.args[0]
        instructions = planner_messages[0]["content"]
        self.assertIn("Interpret an obvious spelling mistake", instructions)
        self.assertIn("Use structured for requests to find/list/filter/count/aggregate", instructions)
        self.assertIn("Use vector for company explanations,", instructions)
        self.assertIn("Use metadata for questions about", instructions)
        self.assertIn("trusted widget configuration", instructions)
        self.assertIn("If the intended term/value is uncertain", instructions)
        self.assertIn("what about [new location]", instructions)
        self.assertIn(self.db.configs[0].system_prompt, planner_messages[1]["content"])
        self.service.execute_query.assert_not_called()

    def test_rejected_result_fallback_is_customer_friendly_not_query_dump(self):
        self.compose("unsupported template", supported=False)
        answer = self.route("Tuition for Physics at North?").override_response
        self.assertIn("For Campus: North", answer)
        self.assertIn("Tuition is EUR 123,456,789.12345678900 per term", answer)
        for internal in ["query:", "Campus =", "Published dataset metadata"]:
            self.assertNotIn(internal, answer)

    def test_render_forgery_numbers_units_claims_slots_fail_closed_keep_usage(self):
        baseline = self.router._fact_fallback(self.router._answer_atoms(
            self.service.execute_query.return_value, SCHEMA.QueryPlan.model_validate(decision()["query"]),
            self.router.CatalogEntry.model_validate(COURSES)), False)
        for text in ["The price is EUR 1", "The price is [[VALUE_unknown]]", "The price is forty two",
                     "The price is [[VALUE_a]] available now", "The price is [[VALUE_a]] USD"]:
            with self.subTest(text=text):
                self.compose(text, supported=False)
                result = self.route()
                self.assertEqual(result.override_response, baseline)
                self.assertIn(result.token_usage["total_tokens"], {25, 32})

    def test_renderer_error_token_usage_is_accumulated(self):
        error = ValueError("malformed completion")
        error.token_usage = RENDER_USAGE
        self.provider.generate_structured_answer.side_effect = error
        result = self.route()
        self.assertIn("EUR 123,456,789", result.override_response)
        self.assertEqual(result.token_usage["total_tokens"], 25)

    def test_real_structured_completion_transport_accepts_slot_protocol(self):
        tree = ast.parse((ROOT / "app/services/chat/openai_service.py").read_text(encoding="utf-8"))
        tree.body = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and
                     n.name in {"_validated_completion_payload", "StructuredCompletionError"}]
        import math
        namespace = dict(Any=object, Dict=dict, Tuple=tuple, json=json, math=math)
        exec(compile(ast.fix_missing_locations(tree), "openai_service.py", "exec"), namespace)
        parse = namespace["_validated_completion_payload"]

        def transport(**kwargs):
            raw, _ = self.render_slots(**kwargs)
            response = NS(usage=NS(**RENDER_USAGE), choices=[NS(finish_reason="stop", message=NS(
                content=json.dumps(raw)))] )
            return parse(response)

        self.provider.generate_structured_answer.side_effect = transport
        self.assertTrue(self.route().override_response.startswith("Here are the matching details:"))
        self.plan(dict(route="metadata", dataset_ids=[]))
        self.assertEqual(self.route("Scope?").override_response, "You can ask us for advice on learning programs.")

    def test_scope_after_lookup_has_no_record_io(self):
        self.seed_context()
        self.service.resolve_text_filter_values.reset_mock()
        self.plan(dict(route="metadata", dataset_ids=[]))
        self.route("Scope?")
        self.service.resolve_text_filter_values.assert_not_called()
        self.service.execute_query.assert_not_called()

    def test_explicit_current_filter_field_cannot_silently_use_old_context(self):
        self.seed_context()
        self.plan({**decision(), "carry_filters": ["campus", "program"]})
        self.assertEqual(self.route("Change Campus to South").answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()

    def test_planner_error_and_rejected_plan_tokens_preserved(self):
        error = ValueError("malformed planner")
        error.token_usage = PLANNER_USAGE
        self.provider.generate_dataset_plan.side_effect = error
        self.assertEqual(self.route().token_usage, PLANNER_USAGE)
        self.provider.generate_dataset_plan.side_effect = None
        self.plan(dict(route="structured", query={"dataset_id": "forged"}))
        self.assertEqual(self.route().token_usage, PLANNER_USAGE)

    def test_hallucinated_ids_versions_private_fields_values_fail_before_execution(self):
        for updates in [dict(dataset_id=99), dict(version_id=999), dict(select=["secret"]),
                        dict(filters=[dict(column="secret", operator="eq", value="North")]),
                        dict(filters=[dict(column="campus", operator="eq", value="Invented")]),
                        dict(operation="sum", aggregate_column="program"),
                        dict(filters=[dict(column="program", operator="gt", value="Physics")])]:
            with self.subTest(updates=updates):
                self.plan(decision(**updates))
                self.assertEqual(self.route().answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()

    def test_exact_numeric_filter_boundaries(self):
        self.plan(decision(filters=[dict(column="tuition", operator="lte", value="10")]))
        for message in ["10.5", "-10", "+10", "100", "x10"]:
            self.assertEqual(self.route(message).answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()

    def test_casefold_canonical_stored_values_are_independently_grounded(self):
        def canonical(db, org, widget, plan):
            plan = copy.deepcopy(plan)
            plan["filters"][0]["value"] = "NORTH"
            return plan
        self.service.resolve_text_filter_values.side_effect = canonical
        result = self.route("Tuition for Physics at north?")
        self.assertEqual(result.answer_mode, "structured")
        self.assertEqual(self.service.execute_query.call_args.args[-1]["filters"][0]["value"], "NORTH")
        self.service.execute_query.reset_mock()
        self.service.resolve_text_filter_values.side_effect = lambda *a: {
            **a[-1], "filters": [dict(column="campus", operator="eq", value="Secret"), *a[-1]["filters"][1:]]}
        self.assertEqual(self.route().answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()

    def test_clarification_uses_only_missing_selected_labels(self):
        self.plan(decision(filters=[dict(column="campus", operator="eq", value="North")]))
        result = self.route("North")
        self.assertEqual(result.override_response, "Please specify Program.")
        self.assertNotIn("SKU", result.override_response)
        self.assertEqual(self.marker(result)["query"]["version_id"], 20)
        self.service.execute_query.assert_not_called()
        self.plan(dict(route="clarify", clarification="Invented response EUR 99"))
        self.compose("Invented response EUR 99", supported=False)
        self.assertEqual(self.route("what?").override_response, self.router.SCOPE_UNKNOWN)

    def test_empty_required_values_become_label_clarification_not_query(self):
        self.plan(decision(filters=[dict(column="campus", operator="eq", value=""),
                                   dict(column="program", operator="eq", value="Physics")]))
        self.assertEqual(self.route("Physics").override_response, "Please specify Campus.")
        self.service.execute_query.assert_not_called()

    def test_latest_twelve_scoped_user_questions_only(self):
        for i in range(1, 16):
            self.db.question(f"Question {i}", i)
        self.db.question("Foreign tenant secret", 100, org=8)
        self.db.question("Foreign widget secret", 101, widget="other")
        self.db.question("Foreign session secret", 102, session="other")
        self.plan(dict(route="vector"))
        result = self.route("New document topic")
        self.assertEqual(self.payload()["prior_questions"], [f"Question {i}" for i in range(4, 16)])
        self.assertTrue(result.retrieval_trace["dataset_document_question"])
        self.assertNotIn("dataset_company_question", result.retrieval_trace)
        self.assertIsNone(self.marker(result)["query"])
        history = next(q for q in self.db.queries if q.target is CONVERSATION.message)
        self.assertEqual(history.bound, 12)
        self.assertEqual({p[0] for p in history.predicates}, {"organization_id", "widget_id", "session_id"})

    def test_followup_beyond_three_turns_and_context_beyond_history_window(self):
        self.seed_context()
        for i in range(101, 115):
            self.db.question(f"Clarify detail {i}", i)
        self.plan({**decision(), "carry_filters": ["campus", "program"]})
        result = self.route("And that tuition?")
        self.assertEqual(result.answer_mode, "structured")
        self.assertEqual(len(self.payload()["prior_questions"]), 12)
        self.assertIsNotNone(self.payload()["query_context"])
        self.assertEqual(self.service.resolve_text_filter_values.call_count, 3)

    def test_prior_context_after_four_turns_requires_explicit_carry(self):
        self.seed_context()
        for i in range(101, 105):
            self.db.question(f"More detail {i}", i)
        self.plan({**decision(), "carry_filters": ["campus", "program"]})
        self.assertEqual(self.route("And tuition?").answer_mode, "structured")
        self.assertEqual(self.payload()["query_context"]["filters"], decision()["query"]["filters"])
        self.service.execute_query.assert_called_once()

    def test_stale_filters_without_carry_fail_even_with_history_and_valid_context(self):
        for with_context in [False, True]:
            with self.subTest(with_context=with_context):
                if with_context:
                    self.seed_context()
                else:
                    self.db.question("Tuition for Physics at North?", 1)
                self.plan({**decision(), "carry_filters": []})
                result = self.route("Tuition for Chemistry at East?")
                self.assertEqual(result.answer_mode, "dataset_unavailable")
                self.assertIn("Tuition for Physics at North?", self.payload()["prior_questions"])
                self.assertEqual(self.payload()["query_context"] is not None, with_context)
                self.assertIsNone(self.marker(result)["query"])
                self.service.execute_query.assert_not_called()

    def test_history_alone_cannot_authorize_explicit_carry(self):
        self.db.question("Tuition for Physics at North?", 1)
        self.plan({**decision(), "carry_filters": ["campus", "program"]})
        self.assertEqual(self.route("And tuition?").answer_mode, "dataset_unavailable")
        self.assertIsNone(self.payload()["query_context"])
        self.service.execute_query.assert_not_called()

    def test_carried_filters_must_match_previous_value_column_and_operator(self):
        self.seed_context()
        for filters, carry in [
            ([dict(column="campus", operator="eq", value="South"),
              dict(column="program", operator="eq", value="Physics")], ["campus", "program"]),
            ([dict(column="campus", operator="eq", value="Physics"),
              dict(column="program", operator="eq", value="North")], ["campus", "program"]),
            (decision()["query"]["filters"], ["campus"]),
        ]:
            with self.subTest(filters=filters, carry=carry):
                self.plan({**decision(filters=filters), "carry_filters": carry})
                self.assertEqual(self.route("And tuition?").answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()
        # Numeric ranges can be valid catalog filters, but cannot change operator
        # merely because the value and column match the persisted filter.
        self.db.traces.clear()
        numeric = decision()["query"]
        numeric["filters"].append(dict(column="tuition", operator="gte", value="10"))
        self.plan(dict(route="structured", query=numeric))
        previous = self.route("Tuition for Physics at North above 10?")
        self.db.persist(previous, 110)
        self.service.execute_query.reset_mock()
        numeric["filters"][-1]["operator"] = "lte"
        self.plan(dict(route="structured", query=numeric, carry_filters=["campus", "program", "tuition"]))
        self.assertEqual(self.route("And those details?").answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()

    def test_partial_clarification_context_supports_only_explicit_exact_carry(self):
        partial = decision(filters=[dict(column="program", operator="eq", value="Physics")])
        self.plan(partial)
        first = self.route("Tuition for Physics?")
        self.assertEqual(first.answer_mode, "dataset_clarify")
        self.assertEqual(first.override_response, "Please specify Campus.")
        self.assertEqual(self.marker(first)["query"]["filters"], partial["query"]["filters"])
        self.db.persist(first, 1)
        self.db.question("Tuition for Physics?", 1)
        self.plan(decision())
        self.assertEqual(self.route("North").answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()
        self.plan({**decision(), "carry_filters": ["program"]})
        result = self.route("North")
        self.assertEqual(result.answer_mode, "structured")
        self.assertEqual(self.payload()["query_context"], self.marker(first)["query"])
        self.assertEqual(self.service.execute_query.call_args.args[-1]["filters"], decision()["query"]["filters"])

    def test_model_directed_current_changes_are_not_merged_with_context(self):
        self.seed_context()
        self.plan({**decision(filters=[dict(column="campus", operator="eq", value="South"),
                                      dict(column="program", operator="eq", value="Physics")]),
                   "carry_filters": ["program"]})
        result = self.route("Now South instead")
        self.assertEqual(result.answer_mode, "structured")
        executed = self.service.execute_query.call_args.args[-1]
        self.assertEqual([f["value"] for f in executed["filters"]], ["South", "Physics"])
        self.assertNotIn("North", json.dumps(executed))

    def test_context_rejects_stale_private_foreign_version_and_corruption(self):
        initial = self.seed_context()
        base = copy.deepcopy(self.marker(initial))
        for mutation in [dict(catalog_digest="old"), dict(organization_id=8), dict(widget_id="other"),
                         dict(session_id="other"), dict(query={**base["query"], "version_id": 999}),
                         dict(query={**base["query"], "select": ["secret"]}),
                         dict(query={**base["query"], "version_id": None}),
                         dict(history_after_id=1000)]:
            with self.subTest(mutation=mutation):
                self.db.traces[-1].selected_chunks = json.dumps([{**base, **mutation}])
                self.plan({**decision(), "carry_filters": ["campus", "program"]})
                result = self.route("And tuition?")
                self.assertEqual(result.answer_mode, "dataset_unavailable")
                self.assertIsNone(self.payload()["query_context"])
                self.assertEqual(self.payload()["prior_questions"], [])
        self.service.execute_query.assert_not_called()
        self.db.traces[-1].selected_chunks = "broken JSON"
        self.plan(dict(route="vector"))
        self.assertEqual(self.route("Document question").answer_mode, "vector")
        self.assertIsNone(self.payload()["query_context"])

    def test_foreign_trace_is_not_loaded_even_if_latest_id(self):
        self.seed_context()
        foreign = copy.deepcopy(self.db.traces[0])
        foreign.id, foreign.organization_id = 999, 8
        foreign.selected_chunks = "foreign invalid JSON"
        self.db.traces.append(foreign)
        self.plan({**decision(), "carry_filters": ["campus", "program"]})
        self.assertEqual(self.route("More details").answer_mode, "structured")

    def test_topic_reset_never_resurrects_old_filters(self):
        self.seed_context()
        self.plan(dict(route="vector"))
        reset = self.route("A completely different document question")
        self.db.persist(reset, 110)
        self.db.question("A completely different document question", 110)
        self.plan(decision())
        result = self.route("And tuition?")
        self.assertEqual(result.answer_mode, "dataset_unavailable")
        self.assertIsNone(self.payload()["query_context"])
        self.assertEqual(self.payload()["prior_questions"], ["A completely different document question"])
        self.service.execute_query.assert_not_called()

    def test_scope_reset_and_history_floor_survive_next_valid_context(self):
        self.seed_context()
        self.plan(dict(route="metadata", dataset_ids=[]))
        self.db.persist(self.route("What can you help with?"), 110)
        self.db.question("What can you help with?", 110)
        self.plan(decision())
        fresh = self.route()
        self.assertEqual(self.marker(fresh)["history_after_id"], 109)
        self.db.persist(fresh, 120)
        self.db.question("Fresh current question", 120)
        self.plan(dict(route="vector"))
        self.route("Documents")
        self.assertEqual(self.payload()["prior_questions"], ["What can you help with?", "Fresh current question"])

    def test_aggregate_and_count_executor_exact_arithmetic_untouched(self):
        for operation in ["sum", "min", "max"]:
            with self.subTest(operation=operation):
                self.plan(decision(operation=operation, aggregate_column="tuition"))
                self.service.execute_query.return_value.update(rows=[dict(operation=operation, column="tuition",
                    value="999999999999999999.00000000000100", unit="per term", currency="EUR")])
                result = self.route()
                self.assertIn("EUR 999,999,999,999,999,999.00000000000100 per term", result.override_response)
        self.plan(decision(operation="count"))
        self.service.execute_query.return_value.update(rows=[dict(count=42)])
        self.assertIn("matching record count is 42.", self.route().override_response)

    def test_metadata_carry_revalidates_referent_and_preserves_next_structured_followup(self):
        self.seed_context()
        self.service.resolve_text_filter_values.reset_mock()
        self.plan(dict(route="metadata", dataset_ids=[10], carry_context=True))
        result = self.route("What kind of information is that?")
        self.assertIsNotNone(self.marker(result)["query"])
        self.service.execute_query.assert_not_called()
        self.service.resolve_text_filter_values.assert_called_once()
        for task in ["generate_template", "verify_grounding"]:
            referent = self.answer_payload(task)["referent_context"]
            self.assertEqual([f["value"] for f in referent["filters"]], ["North", "Physics"])
            self.assertNotIn("select", referent)
            self.assertNotIn("123456789", json.dumps(referent))
        self.db.persist(result, 110)
        self.db.question("What kind of information is that?", 110)
        self.plan({**decision(), "carry_filters": ["campus", "program"]})
        self.assertEqual(self.route("And the tuition?").answer_mode, "structured")
        self.service.execute_query.assert_called_once()

    def test_metadata_carry_without_valid_prior_fails_closed(self):
        self.plan(dict(route="metadata", dataset_ids=[10], carry_context=True))
        self.assertEqual(self.route("What kind is that?").answer_mode, "dataset_unavailable")
        self.provider.generate_structured_answer.assert_not_called()
        self.service.execute_query.assert_not_called()

    def test_metadata_carry_changed_resolver_fails_before_generation(self):
        self.seed_context()
        self.provider.generate_structured_answer.reset_mock()
        self.plan(dict(route="metadata", dataset_ids=[], carry_context=True))
        self.service.resolve_text_filter_values.side_effect = lambda *a: {
            **a[-1], "filters": [dict(column="campus", operator="eq", value="South")]}
        self.assertEqual(self.route("About that catalog?").answer_mode, "dataset_unavailable")
        self.provider.generate_structured_answer.assert_not_called()
        self.service.execute_query.assert_not_called()

    def test_metadata_carry_boolean_is_strict(self):
        for value in ["true", 1, None]:
            self.plan(dict(route="metadata", dataset_ids=[], carry_context=value))
            self.assertEqual(self.route().answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()

    def test_item_type_followup_executes_new_select_and_planner_guides_it(self):
        self.seed_context()
        self.plan({**decision(select=["program"]), "carry_filters": ["campus", "program"]})
        self.service.execute_query.return_value["rows"] = [dict(program="Physics")]
        result = self.route("Is it that type?")
        self.assertEqual(result.answer_mode, "structured")
        self.assertEqual(self.service.execute_query.call_args.args[-1]["select"], ["program"])
        instructions = self.provider.generate_dataset_plan.call_args.args[0][0]["content"]
        self.assertIn("fresh structured SELECT", instructions)
        self.assertIn("carry_context", instructions)

    def test_invalid_executor_projection_numeric_units_never_reach_renderer(self):
        for rows in [[dict(tuition="1", secret="private")], [dict(tuition=1.1)], [dict(tuition="NaN")],
                     [dict(campus="North")], []]:
            with self.subTest(rows=rows):
                self.service.execute_query.return_value["rows"] = rows
                self.assertEqual(self.route().answer_mode, "dataset_unavailable")
        self.provider.generate_structured_answer.assert_not_called()
        self.plan(decision(operation="sum", aggregate_column="tuition"))
        self.service.execute_query.return_value["rows"] = [dict(operation="sum", column="tuition",
            value="1", unit="kg", currency="USD")]
        self.assertEqual(self.route().answer_mode, "dataset_unavailable")

    def test_mixed_requires_exact_current_substring_and_legacy_stages(self):
        document = "What is the refund policy?"
        self.plan({**decision(), "route": "mixed", "document_question": document})
        result = self.route("Tuition for Physics at North? " + document)
        self.assertEqual(result.answer_mode, "mixed")
        self.assertEqual(result.document_question, document)
        self.plan({**decision(), "route": "mixed", "document_question": "Invented question?"})
        self.assertEqual(self.route().answer_mode, "mixed_staged")
        self.plan({**decision(), "route": "mixed"})
        self.assertEqual(self.route().answer_mode, "mixed_staged")
        self.plan({**decision(), "route": "mixed", "document_question": None})
        self.assertEqual(self.route().answer_mode, "dataset_unavailable")

    def test_no_match_generic_does_not_echo_untrusted_executor_prose(self):
        self.service.execute_query.return_value.update(status="no_match", rows=[], response="Secret USD 999")
        result = self.route()
        self.assertIn("matching published record", result.override_response)
        self.assertNotIn("Course catalog", result.override_response)
        self.assertNotIn("999", result.override_response)

    def test_mixed_no_match_preserves_independent_current_document_question(self):
        document = "What is the refund policy?"
        self.service.execute_query.return_value.update(status="no_match", rows=[], citations=[], total_matches=0)
        self.plan({**decision(), "route": "mixed", "document_question": document})
        result = self.route("Tuition for Physics at North? " + document)
        self.assertEqual(result.answer_mode, "mixed")
        self.assertEqual(result.document_question, document)
        self.assertEqual(result.retrieval_trace["dataset_status"], "no_match")
        self.assertIn("matching published record", result.override_response)
        self.assertEqual(result.structured_citations, [])
        self.assertIsNotNone(self.marker(result)["query"])
        for split in ["Invented question?", "   ", None]:
            with self.subTest(split=split):
                raw = {**decision(), "route": "mixed"}
                if split is not None:  # Legacy mixed plan without a split.
                    raw["document_question"] = split
                self.plan(raw)
                staged = self.route("Tuition for Physics at North? " + document)
                self.assertEqual(staged.answer_mode, "mixed_staged")
                self.assertIsNone(staged.document_question)
                self.assertIn(self.router.MIXED_NOTICE, staged.override_response)

    def test_bounds_fail_without_unsafe_model_or_record_access(self):
        self.assertEqual(self.route("x" * 8001).answer_mode, "dataset_unavailable")
        self.db.configs[0].system_prompt = "x" * 16001
        self.assertEqual(self.route().answer_mode, "dataset_unavailable")
        self.db.configs[0].system_prompt = "valid"
        self.service.get_active_catalog.return_value = [{**COURSES, "dataset_id": i + 1,
            "description": "x" * 4000} for i in range(20)]
        self.assertEqual(self.route().answer_mode, "dataset_unavailable")
        self.provider.generate_dataset_plan.assert_not_called()
        self.service.execute_query.assert_not_called()

    def test_combined_history_payload_budget_and_missing_scoped_config(self):
        for i in range(12):
            self.db.question("x" * 6000, i + 1)
        self.assertEqual(self.route().answer_mode, "dataset_unavailable")
        self.provider.generate_dataset_plan.assert_not_called()
        self.db.configs[0].organization_id = 8
        self.db.history.clear()
        self.assertEqual(self.route().answer_mode, "dataset_unavailable")
        self.service.execute_query.assert_not_called()

    def test_disabled_and_empty_catalog_no_config_context_or_model_io(self):
        self.settings.STRUCTURED_DATASETS_CHAT_ENABLED = False
        self.assertIsNone(self.route())
        self.service.get_active_catalog.assert_not_called()
        self.assertEqual(self.db.queries, [])
        self.settings.STRUCTURED_DATASETS_CHAT_ENABLED = True
        self.service.get_active_catalog.return_value = []
        self.assertIsNone(self.route())
        self.assertEqual(self.db.queries, [])
        self.provider.generate_dataset_plan.assert_not_called()


if __name__ == "__main__":
    unittest.main()