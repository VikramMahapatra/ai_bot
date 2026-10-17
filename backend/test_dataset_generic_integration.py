"""Generic router/orchestrator/API contracts without eager app imports or real IO.

Reuse test_dataset_generic_chat's AST router, schemas, scoped query fixture and
provider. Execute production orchestrator functions, the normal API response
tail, the SSE event generator, and persist_conversation_record from their ASTs.
Auth/subscription/intake gates, credit accounting, ORM and external IO are fakes;
this is deliberately not a full HTTP/SQLAlchemy integration test.

Run from backend: python -B -m unittest test_dataset_generic_integration -v
"""
import ast
from contextlib import contextmanager
from dataclasses import replace
import json
import logging
import re
import sys
import time
from types import SimpleNamespace as NS
import unittest
from unittest.mock import Mock

import test_dataset_generic_chat as generic


ROOT = generic.ROOT
TYPES = generic.TYPES
USAGE_KEYS = ("prompt_tokens", "completion_tokens", "total_tokens")
COMPOSED_USAGE = dict(prompt_tokens=19, completion_tokens=13, total_tokens=32)
DOCUMENT_USAGE = dict(prompt_tokens=13, completion_tokens=8, total_tokens=21)
DOCUMENT_QUESTION = "What is the admissions policy?"
DOCUMENT_ANSWER = "Applications are reviewed by the admissions committee."
DOCUMENT_CITATION = dict(source_id=55, chunk_index=2, text=DOCUMENT_ANSWER)
DOCUMENT_SOURCES = [dict(id=55, name="Admissions reference", type="file")]


def source_tree(relative):
    return ast.parse((ROOT / relative).read_text(encoding="utf-8"))


def execute_nodes(nodes, namespace, filename):
    # Postpone annotations just as production does, without importing app or ORM.
    future = ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)
    tree = ast.Module(body=[future, *nodes], type_ignores=[])
    exec(compile(ast.fix_missing_locations(tree), str(ROOT / filename), "exec"), namespace)
    return namespace


def load_definitions(relative, namespace, names):
    nodes = [node for node in source_tree(relative).body
             if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
             and node.name in names]
    if {node.name for node in nodes} != set(names):
        raise AssertionError(f"Missing isolated definitions in {relative}: {names}")
    return execute_nodes(nodes, namespace, relative)


class ConversationRecord(NS):
    pass


class TraceRecord(NS):
    pass


class ContactRecord(NS):
    session_id = generic.Field("session_id")


class ContactQuery:
    def __init__(self, db):
        self.db, self.predicates = db, []

    def filter(self, *predicates):
        self.predicates.extend(predicates)
        return self

    def first(self):
        return next((contact for contact in self.db.contacts
                     if all(operation == "eq" and getattr(contact, field) == expected
                            for field, operation, expected in self.predicates)), None)


class IntegrationDatabase(generic.Database):
    """Real scope predicates/history floors plus fake ORM add/flush semantics."""
    def __init__(self):
        super().__init__()
        self.configs[0].escalation_contact_level_1 = None
        self.configs[0].escalation_contact_level_2 = None
        self.contacts, self.added, self.conversations = [], [], []
        self.next_conversation_id = 200
        self.flush_count = 0

    def query(self, target):
        if target is ContactRecord:
            query = ContactQuery(self)
            self.queries.append(query)
            return query
        return super().query(target)

    def add(self, record):
        self.added.append(record)

    def flush(self):
        self.flush_count += 1
        for record in self.added:
            if isinstance(record, ConversationRecord) and not hasattr(record, "id"):
                record.id = self.next_conversation_id
                self.next_conversation_id += 1
                self.conversations.append(record)
                self.history.append(record)
            elif isinstance(record, TraceRecord) and not hasattr(record, "id"):
                record.id = record.conversation_id
                self.traces.append(record)


@contextmanager
def fake_transaction(db):
    yield
    db.flush()


class GenericDatasetIntegrationTests(unittest.TestCase):
    def setUp(self):
        # Composition, not inheritance: do not rediscover the harness's unit tests.
        self.fixture = generic.GenericDatasetChatTests()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.setUp()
        self.db = self.fixture.db = IntegrationDatabase()
        self.provider = self.fixture.provider
        self.service = self.fixture.service
        self.settings = self.fixture.settings
        self.eager_modules_before = {name for name in sys.modules
                                     if name == "app" or name.startswith("app.")}
        self.persistence = load_definitions("app/services/chat/persistence_service.py", dict(
            json=json, Contact=ContactRecord, Conversation=ConversationRecord,
            RetrievalTrace=TraceRecord), {"persist_conversation_record"})["persist_conversation_record"]
        self.persist = Mock(wraps=self.persistence)
        self.ns = self.orchestrator()

    def tearDown(self):
        eager_modules_after = {name for name in sys.modules
                               if name == "app" or name.startswith("app.")}
        self.assertEqual(eager_modules_after, self.eager_modules_before,
                         "Integration tests must not import eager app packages")

    def orchestrator(self):
        ns = dict(
            __name__="_generic_integration_orchestrator", json=json, re=re, time=time,
            replace=replace, SimpleNamespace=NS, logger=logging.getLogger(__name__),
            settings=self.settings, ChatResponsePlan=TYPES.ChatResponsePlan,
            StructuredAnswer=TYPES.StructuredAnswer,
            ValidatedResponse=TYPES.ValidatedResponse,
            route_dataset_chat=self.fixture.router.route_dataset_chat,
            openai_service=self.provider, WidgetConfig=generic.CONFIG,
            transactional_session=fake_transaction,
            reserve_chat_credits=Mock(return_value=NS(usage_id=1)),
            finalize_chat_credit_reservation=Mock(), rollback_chat_credit_reservation=Mock(),
            persist_conversation_record=self.persist, finalize_conversation_metrics=Mock(),
            FeatureCodes=NS(CORE_CHATBOT_WEB_MESSAGE="chat"),
            default_escalation_contacts=lambda: ("one", "two"),
            build_escalation_message=Mock(return_value="HANDOFF"),
            should_escalate_response=Mock(return_value=False),
            append_appointment_cta_if_needed=Mock(side_effect=lambda text, *args: text),
            _has_prior_turns=Mock(return_value=True),
            _has_prior_escalation_contacts=Mock(return_value=False),
            _prepare_history=Mock(side_effect=AssertionError("No assistant dataset history")),
            resolve_followup_context=Mock(return_value=NS(query_text=DOCUMENT_QUESTION)),
            retrieve_hybrid_result=Mock(side_effect=lambda **kwargs: self.document_plan().retrieval_result),
            session_contact_prompt=Mock(return_value=""),
            chroma_client=object(), build_clarifying_question=Mock(return_value="Clarify"),
            build_soft_fallback_message=Mock(return_value="Soft fallback"),
            build_grounded_fallback_message=Mock(return_value="Grounded fallback"),
        )
        load_definitions("app/services/chat/structured_answering.py", ns,
                         {"parse_structured_answer", "build_structured_response_instruction"})
        load_definitions("app/services/chat/prompt_builder.py", ns,
                         {"build_context_block", "build_system_prompt", "build_chat_messages"})
        load_definitions("app/services/chat/response_validator.py", ns,
                         {"_token_set", "_answer_context_similarity", "validate_answer"})
        # Read the production constant rather than duplicating its wording.
        constants = [node for node in source_tree("app/services/chat/orchestrator.py").body
                     if isinstance(node, ast.Assign)
                     and any(isinstance(target, ast.Name) and target.id == "DOCUMENT_UNAVAILABLE"
                             for target in node.targets)]
        self.assertEqual(len(constants), 1)
        execute_nodes(constants, ns, "app/services/chat/orchestrator.py")
        load_definitions("app/services/chat/orchestrator.py", ns, {
            "_normalize_message", "_is_small_talk_message", "_is_bare_clarification",
            "_configured_discovery_question",
            "_build_plan", "_build_vector_plan", "_complete_mixed_plan",
            "_generate_structured_response", "_finalize_response",
            "generate_chat_response", "stream_chat_response",
        })
        ns["is_document_summary_intent"] = Mock(return_value=False)
        ns["validate_answer"] = Mock(wraps=ns["validate_answer"])
        return ns

    def document_plan(self, generate=True):
        trace = dict(dataset_document_question=True,
                 user_query=DOCUMENT_QUESTION, retrieval_query=DOCUMENT_QUESTION,
                     query_variants=[DOCUMENT_QUESTION], source_ids=[55],
                     retrieved_chunks=[DOCUMENT_CITATION.copy()],
                     selected_chunks=[DOCUMENT_CITATION.copy()], has_context=True,
                     escalation_triggered=False, top_distance=0.25)
        retrieval = TYPES.HybridRetrievalResult(
            DOCUMENT_QUESTION, [TYPES.RerankedChunk(DOCUMENT_ANSWER, "rerank", 1, source_id=55)],
            TYPES.RetrievalConfidence(0.8, "high"), trace,
            [source.copy() for source in DOCUMENT_SOURCES], DOCUMENT_ANSWER)
        return TYPES.ChatResponsePlan(
            generate, None if generate else DOCUMENT_ANSWER, False, "Document unavailable",
            trace, retrieval.sources,
            [{"role": "system", "content": DOCUMENT_ANSWER},
             {"role": "user", "content": DOCUMENT_QUESTION}], retrieval)

    def build(self, message=DOCUMENT_QUESTION, retrieval_message="STALE DATASET OVERRIDE"):
        return self.ns["_build_plan"](message, "s", "w", 7, self.db, "fr", "French", retrieval_message)

    def marker(self, plan):
        # Document citations need not have the dataset harness's "type" key.
        markers = [chunk for chunk in plan.retrieval_trace["selected_chunks"]
                   if chunk.get("type") == "dataset_query_context"]
        self.assertEqual(len(markers), 1)
        return markers[0]

    def assert_scope(self, record, conversation_id):
        self.assertEqual((record.conversation_id, record.organization_id, record.widget_id,
                          record.session_id, record.user_id), (conversation_id, 7, "w", "s", 3))

    def api_namespace(self, message):
        return dict(
            json=json, logger=logging.getLogger(__name__), db=self.db,
            message=NS(message=message, session_id="s", widget_id="w", language_code="fr",
                       language_label="French", retrieval_message="STALE DATASET OVERRIDE"),
            user_id=3, organization_id=7, user=NS(organization_id=7),
            limits={"human_handoff_enabled": True}, widget_config=self.db.configs[0],
            is_first_turn=True, is_new_session=True,
            _ensure_handoff_offer_response=Mock(side_effect=AssertionError("No handoff injection")),
            append_appointment_cta_if_needed=Mock(side_effect=AssertionError("No dataset CTA")),
            increment_usage=Mock(), generate_chat_response=self.ns["generate_chat_response"],
            stream_chat_response=self.ns["stream_chat_response"],
        )

    def api_nonstream(self, message):
        tree = source_tree("app/api/chat.py")
        # Inspect every statement-list field, including nested orelse blocks.
        matches = [(body, index) for parent in ast.walk(tree) for _, body in ast.iter_fields(parent)
                   if isinstance(body, list) for index, node in enumerate(body)
                   if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call)
                   and isinstance(node.value.func, ast.Name)
                   and node.value.func.id == "generate_chat_response"]
        self.assertEqual(len(matches), 1)
        body, index = matches[0]
        function = ast.FunctionDef(
            name="normal_api_response", decorator_list=[],
            args=ast.arguments(posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]),
            body=body[index:])
        ns = self.api_namespace(message)
        schema = generic.load_source("_generic_integration_chat_schema", "app/schemas/chat.py")
        ns["ChatResponse"] = schema.ChatResponse
        execute_nodes([function], ns, "app/api/chat.py")
        return ns, ns["normal_api_response"]()

    def api_stream(self, message):
        candidates = [node for node in ast.walk(source_tree("app/api/chat.py"))
                      if isinstance(node, ast.FunctionDef) and node.name == "event_generator"]
        self.assertEqual(len(candidates), 1)
        ns = self.api_namespace(message)
        captured = []

        def stream(*args, **kwargs):
            result = self.ns["stream_chat_response"](*args, **kwargs)
            captured.append(result)
            return result

        def persist(db, *, token_usage, **kwargs):
            with fake_transaction(db):
                record = self.persist(db, **kwargs)
                self.ns["finalize_conversation_metrics"](
                    db, record.id, kwargs["organization_id"], kwargs["session_id"], token_usage=token_usage)
            return record

        # The API adapter is fake; the invoked persistence function is real AST.
        ns.update(stream_chat_response=stream, persist_conversation=Mock(side_effect=persist))
        execute_nodes(candidates, ns, "app/api/chat.py")
        generator = ns["event_generator"]()
        self.assertEqual(json.loads(next(generator).removeprefix("data: ")), {"type": "ready"})
        self.assertEqual(captured, [], "Ready must precede retrieval/planning")
        self.assertEqual(ns["persist_conversation"].call_count, 0)
        events = [{"type": "ready"}, *[json.loads(event.removeprefix("data: ")) for event in generator]]
        self.assertEqual(len(captured), 1)
        return ns, events, captured[0]

    def test_build_plan_forwards_generic_document_flag_scoped_questions_and_reset(self):
        self.fixture.seed_context()
        self.db.question("How do applications work?", 101)
        self.db.question("Foreign tenant", 102, org=8)
        self.db.question("Foreign widget", 103, widget="other")
        self.db.question("Foreign session", 104, session="other")
        self.fixture.plan(dict(route="vector"))
        vector = self.document_plan()
        self.ns["_build_vector_plan"] = Mock(return_value=vector)
        result = self.build()
        call = self.ns["_build_vector_plan"].call_args
        self.assertEqual(call.args, (DOCUMENT_QUESTION, "s", "w", 7, self.db, "fr", "French", None))
        self.assertEqual(call.kwargs, dict(company_question=True, dataset_questions=[
            "Tuition for Physics at North?", "How do applications work?"]))
        self.assertEqual(self.fixture.payload()["prior_questions"], call.kwargs["dataset_questions"])
        self.assertEqual(result.sources, DOCUMENT_SOURCES)
        self.assertEqual(result.retrieval_trace["source_ids"], [55])
        self.assertEqual(result.retrieval_trace["selected_chunks"][0], DOCUMENT_CITATION)
        marker = self.marker(result)
        self.assertIsNone(marker["query"])
        self.assertIsNone(marker["history_after_id"])
        self.assertEqual((marker["organization_id"], marker["widget_id"], marker["session_id"]), (7, "w", "s"))
        self.assertEqual(len(result.retrieval_trace["selected_chunks"]), 2)
        self.assertEqual(result.token_usage, generic.PLANNER_USAGE)
        self.assertEqual(result.retrieval_trace["token_usage"], generic.PLANNER_USAGE)
        planner_messages = self.provider.generate_dataset_plan.call_args.args[0]
        self.assertEqual(planner_messages[1]["role"], "system")
        self.assertIn(self.db.configs[0].system_prompt, planner_messages[1]["content"])
        self.assertNotIn("agent_system_prompt", self.fixture.payload())
        self.service.execute_query.assert_not_called()

    def test_disabled_router_keeps_legacy_override_and_none_history_without_document_flag(self):
        self.settings.STRUCTURED_DATASETS_CHAT_ENABLED = False
        vector = self.document_plan()
        self.ns["_build_vector_plan"] = Mock(return_value=vector)
        self.assertIs(self.build(), vector)
        call = self.ns["_build_vector_plan"].call_args
        self.assertEqual(call.args[-1], "STALE DATASET OVERRIDE")
        self.assertEqual(call.kwargs, {"dataset_questions": None})
        self.provider.generate_dataset_plan.assert_not_called()
        self.service.get_active_catalog.assert_not_called()
        self.assertEqual(self.db.queries, [])

    def test_greeting_bypasses_catalog_and_planner(self):
        result = self.build("Hello!")
        self.assertEqual(result.override_response, "Hi! How can I help you?")
        self.provider.generate_dataset_plan.assert_not_called()
        self.service.get_active_catalog.assert_not_called()
        self.assertEqual(self.db.queries, [])

    def test_opted_in_agent_asks_discovery_question_when_retrieval_is_empty(self):
        self.db.configs[0].system_prompt = (
            "## 4. DISCOVERY APPROACH\n"
            "Trigger lightweight discovery when the conversation involves AI solutions."
        )
        empty_retrieval = TYPES.HybridRetrievalResult(
            "I need to know more about AI", [],
            TYPES.RetrievalConfidence(0.0, "none", False, ("empty_retrieval",)),
            {"user_query": "I need to know more about AI", "retrieved_chunks": [],
             "selected_chunks": [], "source_ids": [], "has_context": False},
            [], "",
        )
        self.ns["retrieve_hybrid_result"].side_effect = None
        self.ns["retrieve_hybrid_result"].return_value = empty_retrieval

        plan = self.ns["_build_vector_plan"](
            "I need to know more about AI", "s", "w", 7, self.db,
            dataset_questions=[],
        )

        self.assertEqual(
            plan.override_response,
            "What specific challenge or process are you looking to improve in your business?",
        )
        self.assertFalse(plan.should_generate_llm_response)
        self.assertTrue(plan.retrieval_trace["discovery_fallback"])

    def test_discovery_is_used_when_generated_answer_is_unanswered(self):
        self.db.configs[0].system_prompt = (
            "## 4. DISCOVERY APPROACH\n"
            "Trigger lightweight discovery when the conversation involves AI solutions."
        )
        plan = self.ns["_build_vector_plan"](
            "hi i would like to know more about ai", "s", "w", 7, self.db,
            dataset_questions=[],
        )

        self.assertTrue(plan.should_generate_llm_response)
        self.assertIsNone(plan.override_response)
        response = self.ns["_finalize_response"](
            plan, TYPES.StructuredAnswer(False, 0.1, False, ""),
            "hi i would like to know more about ai",
        )

        self.assertEqual(
            response,
            "What specific challenge or process are you looking to improve in your business?",
        )

    def test_broad_ai_discovery_precedes_active_dataset_routing(self):
        self.db.configs[0].system_prompt = (
            "## 4. DISCOVERY APPROACH\n"
            "Trigger lightweight discovery when the conversation involves AI solutions."
        )
        self.ns["is_document_summary_intent"] = lambda message: False
        self.ns["_prepare_history"].side_effect = None
        self.ns["_prepare_history"].return_value = []

        plan = self.ns["_build_plan"](
            "hi i would like to know more about ai", "s", "w", 7, self.db,
        )

        self.assertEqual(
            plan.override_response,
            "What specific challenge or process are you looking to improve in your business?",
        )
        self.assertTrue(plan.retrieval_trace["discovery_fallback"])
        self.provider.generate_dataset_plan.assert_not_called()

    def test_discovery_requires_prompt_opt_in_and_does_not_repeat_known_goal(self):
        helper = self.ns["_configured_discovery_question"]
        configured = (
            "DISCOVERY APPROACH. Trigger lightweight discovery for AI solutions."
        )
        self.assertIsNone(helper("You are a general assistant.", "Tell me about AI", []))
        self.assertEqual(
            helper(configured, "I need AI for customer support", []),
            "Which process would you like to automate?",
        )
        self.assertIsNone(helper(configured, "What is your AI product pricing?", []))
        self.assertIsNone(helper(configured, "What is your AI team’s email?", []))
        self.assertEqual(helper(configured, "Tell me about AI", [
            NS(message="We want to improve customer support")
        ]), "Which process would you like to automate?")

    def test_process_automation_goal_advances_after_discovery_question(self):
        helper = self.ns["_configured_discovery_question"]
        configured = (
            "DISCOVERY APPROACH. Trigger lightweight discovery for services and automation."
        )
        first_question = "What specific challenge or process are you looking to improve in your business?"
        history = [
            NS(message="process automation", response=first_question),
        ]

        next_question = helper(configured, "want to do some process automation", history)

        self.assertIsNotNone(next_question)
        self.assertNotEqual(next_question, first_question)
        self.assertEqual(next_question, "Which process would you like to automate?")

    def test_discovery_does_not_repeat_when_prior_question_was_not_answered(self):
        helper = self.ns["_configured_discovery_question"]
        configured = (
            "DISCOVERY APPROACH. Trigger lightweight discovery for services and automation."
        )
        repeated_question = "What specific challenge or process are you looking to improve in your business?"

        next_question = helper(configured, "process automation", [
            NS(message="another question", response=repeated_question),
        ])
        self.assertIsNotNone(next_question)
        self.assertNotEqual(next_question, repeated_question)

    def test_discovery_none_leaves_vector_generation_flow_unchanged(self):
        self.db.configs[0].system_prompt = (
            "DISCOVERY APPROACH. Trigger lightweight discovery for services and automation."
        )
        history = [NS(message="process automation", response=(
            "What tools or systems do you currently use for that process?"
        ))]
        self.ns["is_document_summary_intent"] = lambda message: False
        self.ns["_prepare_history"].side_effect = None
        self.ns["_prepare_history"].return_value = history
        self.settings.STRUCTURED_DATASETS_CHAT_ENABLED = False
        self.fixture.plan(dict(route="vector"))

        result = self.build("want to do some process automation", retrieval_message=None)

        self.assertIsNone(result.override_response)
        self.assertTrue(result.should_generate_llm_response)

    def test_real_vector_builder_uses_agent_scope_question_only_history_and_no_stale_override(self):
        self.db.question("Tell me about admissions", 1)
        self.db.question("And the review process?", 2)
        self.fixture.plan(dict(route="vector"))
        result = self.build()
        self.assertTrue(result.should_generate_llm_response)
        self.ns["_prepare_history"].assert_not_called()
        history, question = self.ns["resolve_followup_context"].call_args.args
        self.assertEqual([(row.message, row.response) for row in history], [
            ("And the review process?", ""), ("Tell me about admissions", "")])
        self.assertEqual(question, DOCUMENT_QUESTION)
        retrieval_args = self.ns["retrieve_hybrid_result"].call_args.kwargs
        self.assertEqual(retrieval_args["query_text"], DOCUMENT_QUESTION)
        self.assertEqual((retrieval_args["organization_id"], retrieval_args["widget_id"]), (7, "w"))
        prompt = result.messages[0]["content"]
        self.assertIn(self.db.configs[0].system_prompt, prompt)
        self.assertIn("agent's configured scope and tone", prompt)
        self.assertIn("An explicit exclusion requires explicit evidence", prompt)
        self.assertIn("French (fr)", prompt)
        self.assertNotIn("STALE DATASET OVERRIDE", json.dumps(result.messages))
        self.assertEqual(result.messages[-1], dict(role="user", content=DOCUMENT_QUESTION))
        self.assertEqual([row["content"] for row in result.messages if row["role"] == "assistant"], ["", ""])
        self.assertTrue(result.retrieval_trace["dataset_document_question"])
        self.assertNotIn("dataset_company_question", result.retrieval_trace)
        self.assertIsNone(self.marker(result)["query"])

    def test_real_persistence_json_roundtrip_preserves_marker_citations_and_scoped_fields(self):
        plan = self.fixture.route()
        chunks = [DOCUMENT_CITATION.copy(), *plan.retrieval_trace["selected_chunks"]]
        trace = {**plan.retrieval_trace, "selected_chunks": chunks, "retrieval_query": DOCUMENT_QUESTION,
                 "query_variants": [DOCUMENT_QUESTION], "retrieved_chunks": [DOCUMENT_CITATION],
                 "source_ids": [55], "top_distance": "0.25", "organization_id": 999,
                 "widget_id": "forged", "session_id": "forged", "user_id": 999}
        self.db.contacts = [NS(id=88, session_id="foreign"), NS(id=89, session_id="s")]
        conversation = self.persistence(self.db, "s", "w", 3, 7, "Physics at North", "Réponse", trace)
        self.db.flush()
        record = self.db.traces[-1]
        self.assert_scope(record, conversation.id)
        self.assertEqual((conversation.organization_id, conversation.widget_id, conversation.session_id,
                          conversation.user_id, conversation.contact_id), (7, "w", "s", 3, 89))
        self.assertEqual((conversation.role, conversation.source, conversation.response), ("user", "chat", "Réponse"))
        self.assertIsInstance(record.selected_chunks, str)
        self.assertEqual(json.loads(record.selected_chunks), chunks)
        self.assertEqual(json.loads(record.query_variants), [DOCUMENT_QUESTION])
        self.assertEqual(json.loads(record.retrieved_chunks), [DOCUMENT_CITATION])
        self.assertEqual(json.loads(record.source_ids), [55])
        self.assertEqual(record.top_distance, 0.25)
        self.assertTrue(record.has_context)
        self.assertFalse(record.escalation_triggered)
        self.assertGreaterEqual(self.db.flush_count, 2)
        self.fixture.plan({**generic.decision(), "carry_filters": ["campus", "program"]})
        self.assertEqual(self.fixture.route("And that tuition?").answer_mode, "structured")
        self.assertEqual(self.fixture.payload()["query_context"]["version_id"], 20)

    def test_persisted_document_reset_blocks_old_filters_and_history_on_next_turn(self):
        self.fixture.seed_context()
        self.fixture.plan(dict(route="vector"))
        self.ns["_build_vector_plan"] = Mock(return_value=self.document_plan(generate=False))
        response, sources, usage = self.ns["generate_chat_response"](
            DOCUMENT_QUESTION, "s", "w", 3, 7, self.db, retrieval_message="old tuition")
        self.assertEqual(response, DOCUMENT_ANSWER)
        self.assertEqual(sources, DOCUMENT_SOURCES)
        self.assertEqual(usage, generic.PLANNER_USAGE)
        record = self.db.traces[-1]
        self.assert_scope(record, self.db.conversations[-1].id)
        chunks = json.loads(record.selected_chunks)
        self.assertEqual(chunks[0], DOCUMENT_CITATION)
        self.assertIsNone(next(chunk for chunk in chunks if chunk.get("type") == "dataset_query_context")["query"])
        self.fixture.plan(generic.decision())
        next_plan = self.fixture.route("And that tuition?")
        self.assertEqual(next_plan.answer_mode, "dataset_unavailable")
        self.assertIsNone(self.fixture.payload()["query_context"])
        self.assertEqual(self.fixture.payload()["prior_questions"], [DOCUMENT_QUESTION])
        self.service.execute_query.assert_not_called()
        history_query = next(query for query in reversed(self.db.queries)
                             if getattr(query, "target", None) is generic.CONVERSATION.message)
        self.assertIn(("id", "gt", record.conversation_id - 1), history_query.predicates)

    def prompt_driven_parity(self, mode, message, decision):
        self.fixture.plan(decision)
        self.assertEqual(self.db.conversations, [])
        api, response = self.api_nonstream(message)
        sync_metrics = self.ns["finalize_conversation_metrics"].call_args.kwargs["token_usage"]
        sync_trace = self.db.traces[-1]
        stream_api, events, stream_tuple = self.api_stream(message)
        stream, sources, text, trace = stream_tuple
        self.assertIsNone(stream)
        self.assertEqual((response.response, sources), (text, []))
        self.assertEqual([event["type"] for event in events], ["ready", "token", "done"])
        self.assertEqual(events[1], dict(type="token", text=response.response))
        self.assertEqual(events[-1], dict(type="done", sources=[], answer_mode=mode,
                                         structured_citations=response.structured_citations))
        self.assertEqual(trace["answer_mode"], mode)
        self.assertEqual({key: sync_metrics[key] for key in USAGE_KEYS}, COMPOSED_USAGE)
        self.assertEqual(sync_metrics["answer_mode"], mode)
        self.assertEqual(sync_metrics["structured_citations"], trace["structured_citations"])
        self.assertEqual(trace["token_usage"], COMPOSED_USAGE)
        persisted = stream_api["persist_conversation"].call_args.kwargs
        self.assertEqual(persisted["token_usage"], COMPOSED_USAGE)
        self.assertEqual(persisted["retrieval_trace"]["selected_chunks"], trace["selected_chunks"])
        self.assertEqual(len(self.db.conversations), 2)
        self.assertEqual(len(self.db.traces), 2)
        for conversation, record in zip(self.db.conversations, self.db.traces):
            self.assert_scope(record, conversation.id)
            self.assertEqual(conversation.response, response.response)
            self.assertEqual(json.loads(record.selected_chunks), trace["selected_chunks"])
        self.assertEqual(json.loads(sync_trace.selected_chunks), json.loads(self.db.traces[-1].selected_chunks))
        for endpoint in (api, stream_api):
            endpoint["_ensure_handoff_offer_response"].assert_not_called()
            endpoint["increment_usage"].assert_called_once_with(
                self.db, 7, conversations_count=1, messages_count=2, tokens_used=32)
        self.ns["append_appointment_cta_if_needed"].assert_not_called()
        stream_api["append_appointment_cta_if_needed"].assert_not_called()
        self.ns["validate_answer"].assert_not_called()
        self.ns["retrieve_hybrid_result"].assert_not_called()
        self.provider.stream_chat_completion.assert_not_called()
        self.assertEqual(self.provider.generate_dataset_plan.call_count, 2)
        self.assertEqual(self.provider.generate_structured_answer.call_count, 4)
        tasks = []
        for call in self.provider.generate_structured_answer.call_args_list:
            messages = call.kwargs["messages"]
            self.assertEqual(messages[1]["role"], "system")
            self.assertIn(self.db.configs[0].system_prompt, messages[1]["content"])
            payload = json.loads(messages[-1]["content"])
            self.assertNotIn("agent_system_prompt", payload)
            tasks.append(payload["task"])
        self.assertEqual(tasks, ["generate_template", "verify_grounding"] * 2)
        self.assertEqual(self.persist.call_count, 2)
        self.assertEqual(self.ns["finalize_conversation_metrics"].call_count, 2)
        self.ns["finalize_chat_credit_reservation"].assert_called_once()
        self.ns["rollback_chat_credit_reservation"].assert_not_called()
        return response.response

    def test_structured_prompt_reply_actual_api_sse_persistence_and_all_three_usage_stages(self):
        def prose(payload):
            slot = next(fact["value"] for fact in payload["authorized_facts"] if fact["kind"] == "field")
            return "For your selected program, the published term tuition is " + slot + "."

        self.fixture.compose(prose)
        text = self.prompt_driven_parity("structured", "Tuition for Physics at North?", generic.decision())
        self.assertEqual(text, "For your selected program, the published term tuition is EUR 123,456,789.12345678900 per term.")
        self.assertEqual(self.service.execute_query.call_count, 2)
        self.assertNotIn("123456789", json.dumps(self.fixture.payload()))
        self.assertEqual(self.fixture.answer_payload("verify_grounding")["candidate"], text)

    def test_metadata_prompt_reply_actual_api_sse_persistence_and_all_three_usage_stages(self):
        self.fixture.compose("Transport is outside our services.")
        text = self.prompt_driven_parity("dataset_metadata", "Can you arrange transport?",
                                       dict(route="metadata", dataset_ids=[]))
        self.assertEqual(text, "Transport is outside our services.")
        self.service.execute_query.assert_not_called()
        self.service.resolve_text_filter_values.assert_not_called()
        self.service.get_public_catalog_values.assert_not_called()
        chunks = json.loads(self.db.traces[-1].selected_chunks)
        self.assertEqual(len(chunks), 1)
        self.assertIsNone(chunks[0]["query"])

    def test_rejected_verifier_preserves_billed_usage_and_stream_nonstream_fallback_parity(self):
        self.fixture.compose("We provide transport services.", supported=False)
        text = self.prompt_driven_parity("dataset_metadata", "Can you arrange transport?",
                                       dict(route="metadata", dataset_ids=[]))
        self.assertIn("enough verified information", text)
        self.assertNotIn("We provide transport", text)

    def test_renderer_exception_counts_billed_usage_in_both_orchestrator_paths(self):
        error = ValueError("Rejected renderer completion")
        error.token_usage = generic.RENDER_USAGE.copy()
        self.provider.generate_structured_answer.side_effect = error
        response, _, usage = self.ns["generate_chat_response"](
            "Tuition for Physics at North?", "s", "w", 3, 7, self.db)
        stream, _, text, trace = self.ns["stream_chat_response"](
            "Tuition for Physics at North?", "s", "w", 3, 7, self.db)
        expected = dict(prompt_tokens=14, completion_tokens=11, total_tokens=25)
        self.assertEqual({key: usage[key] for key in USAGE_KEYS}, expected)
        self.assertEqual(trace["token_usage"], expected)
        self.assertIsNone(stream)
        self.assertEqual(response, text)
        self.assertIn("EUR 123,456,789.12345678900 per term", text)

    def test_vector_generation_merges_planner_usage_and_preserves_reset_in_both_paths(self):
        self.fixture.plan(dict(route="vector"))
        self.provider.generate_structured_answer.side_effect = None
        self.provider.generate_structured_answer.return_value = generic.envelope(DOCUMENT_ANSWER), DOCUMENT_USAGE.copy()
        response, sources, usage = self.ns["generate_chat_response"](
            DOCUMENT_QUESTION, "s", "w", 3, 7, self.db, retrieval_message="STALE")
        stream, stream_sources, text, trace = self.ns["stream_chat_response"](
            DOCUMENT_QUESTION, "s", "w", 3, 7, self.db, retrieval_message="STALE")
        expected = dict(prompt_tokens=24, completion_tokens=15, total_tokens=39)
        self.assertEqual(usage, expected)
        self.assertEqual(trace["token_usage"], expected)
        self.assertEqual((response, sources), (text, stream_sources))
        self.assertEqual(text, DOCUMENT_ANSWER)
        self.assertIsNone(stream)
        self.assertTrue(trace["prepared_response"])
        self.assertEqual(trace["selected_chunks"][0], DOCUMENT_CITATION)
        self.assertIsNone(next(chunk for chunk in trace["selected_chunks"]
                               if chunk.get("type") == "dataset_query_context")["query"])
        self.assertEqual(self.ns["validate_answer"].call_count, 2)

    def test_complete_mixed_plan_merges_usage_and_preserves_dataset_context_and_document_citations(self):
        self.fixture.plan({**generic.decision(), "route": "mixed", "document_question": DOCUMENT_QUESTION})
        dataset_plan = self.fixture.route("Tuition for Physics at North? " + DOCUMENT_QUESTION)
        self.assertEqual(dataset_plan.answer_mode, "mixed")
        original_chunks = json.loads(json.dumps(dataset_plan.retrieval_trace["selected_chunks"]))
        self.provider.generate_structured_answer.side_effect = None
        for outcome in ("answered", "rejected", "exception"):
            with self.subTest(outcome=outcome):
                document = self.document_plan()
                self.ns["_build_vector_plan"] = Mock(return_value=document)
                self.provider.generate_structured_answer.side_effect = None
                raw = generic.envelope(DOCUMENT_ANSWER)
                if outcome == "rejected":
                    raw["answered"] = False
                elif outcome == "exception":
                    error = ValueError("Malformed document completion")
                    error.token_usage = DOCUMENT_USAGE.copy()
                    self.provider.generate_structured_answer.side_effect = error
                self.provider.generate_structured_answer.return_value = raw, DOCUMENT_USAGE.copy()
                result = self.ns["_complete_mixed_plan"](dataset_plan, "s", "w", 7, self.db, "fr", "French")
                suffix = DOCUMENT_ANSWER if outcome == "answered" else self.ns["DOCUMENT_UNAVAILABLE"]
                self.assertEqual(result.override_response, dataset_plan.override_response + "\n\n" + suffix)
                self.assertEqual(result.grounded_fallback, result.override_response)
                expected = dict(prompt_tokens=32, completion_tokens=21, total_tokens=53)
                self.assertEqual(result.token_usage, expected)
                self.assertEqual(result.retrieval_trace["token_usage"], expected)
                self.assertEqual(result.retrieval_trace["document_status"],
                                 "answered" if outcome == "answered" else "unavailable")
                self.assertEqual(result.retrieval_trace["selected_chunks"], [*original_chunks, DOCUMENT_CITATION])
                self.assertEqual(self.marker(result), self.marker(dataset_plan))
                self.assertEqual(result.structured_citations, dataset_plan.structured_citations)
                self.assertEqual(result.sources, DOCUMENT_SOURCES)
                self.assertEqual(result.retrieval_trace["source_ids"], [55])
                self.assertEqual(result.retrieval_trace["document_retrieval_trace"], document.retrieval_trace)
                self.assertFalse(result.should_generate_llm_response)
                self.assertFalse(result.retrieval_trace["escalation_triggered"])
                self.ns["_build_vector_plan"].assert_called_once_with(
                    DOCUMENT_QUESTION, "s", "w", 7, self.db, "fr", "French",
                    dataset_questions=[], company_question=True)
                self.assertEqual(dataset_plan.token_usage, COMPOSED_USAGE)
                self.assertEqual(dataset_plan.retrieval_trace["selected_chunks"], original_chunks)

    def document_numeric_parity(self, mixed):
        """Real router, vector builder, parser and finalizer in sync and stream."""
        message = DOCUMENT_QUESTION
        decision = dict(route="vector")
        prefix, citations = "", []
        if mixed:
            message = "Tuition for Physics at North? " + DOCUMENT_QUESTION
            decision = {**generic.decision(), "route": "mixed", "document_question": DOCUMENT_QUESTION}
            self.fixture.plan(decision)
            dataset = self.fixture.route(message)
            prefix, citations = dataset.override_response + "\n\n", dataset.structured_citations
        self.fixture.plan(decision)
        for addition in ("", " Reviews take 999days.", " Reviews take ² days."):
            with self.subTest(mixed=mixed, addition=addition):
                candidate = DOCUMENT_ANSWER + addition

                def complete(*args, **kwargs):
                    if args:  # Document completion; dataset composition uses keyword messages.
                        return generic.envelope(candidate), DOCUMENT_USAGE.copy()
                    return self.fixture.render_slots(**kwargs)

                self.provider.generate_structured_answer.side_effect = complete
                response, sources, usage = self.ns["generate_chat_response"](
                    message, "s", "w", 3, 7, self.db, retrieval_message="STALE DATASET OVERRIDE")
                sync_trace = self.persist.call_args.kwargs["retrieval_trace"]
                stream, stream_sources, text, trace = self.ns["stream_chat_response"](
                    message, "s", "w", 3, 7, self.db, retrieval_message="STALE DATASET OVERRIDE")
                self.assertIsNone(stream)
                self.assertEqual((response, sources), (text, stream_sources))
                self.assertEqual(sources, DOCUMENT_SOURCES)
                if addition:
                    fallback = (self.ns["DOCUMENT_UNAVAILABLE"] if mixed else
                                "I don’t have verified information to confirm that detail.")
                    self.assertEqual(text, prefix + fallback)
                    self.assertNotIn(candidate, text)
                else:
                    self.assertEqual(text, prefix + DOCUMENT_ANSWER)
                for actual_trace in (sync_trace, trace):
                    document = actual_trace["document_retrieval_trace"] if mixed else actual_trace
                    self.assertTrue(document["dataset_document_question"])
                    validation = document["document_answer_validation"]
                    self.assertEqual(validation["reason"], "accepted")
                    self.assertGreaterEqual(validation["similarity"], 0.1)
                    self.assertTrue(validation["answered"])
                    self.assertEqual(validation["numeric_grounded"], not bool(addition))
                    self.assertEqual(document["prepared_response"], not bool(addition))
                    self.assertFalse(actual_trace["escalation_triggered"])
                    if mixed:
                        self.assertEqual(actual_trace["document_status"], "unavailable" if addition else "answered")
                        self.assertEqual(actual_trace["structured_citations"], citations)
                expected = (dict(prompt_tokens=32, completion_tokens=21, total_tokens=53) if mixed else
                            dict(prompt_tokens=24, completion_tokens=15, total_tokens=39))
                self.assertEqual({key: usage[key] for key in USAGE_KEYS}, expected)
                self.assertEqual(trace["token_usage"], expected)
                messages = self.provider.generate_structured_answer.call_args.args[0]
                self.assertIn("only authorized reference evidence", messages[0]["content"])
                self.assertEqual(messages[-1]["content"], DOCUMENT_QUESTION)
                for excluded in ("STALE DATASET OVERRIDE", "123456789", "Tuition for Physics"):
                    self.assertNotIn(excluded, json.dumps(messages))
        self.ns["_prepare_history"].assert_not_called()
        self.provider.stream_chat_completion.assert_not_called()

    def test_real_vector_rejects_unsupported_attached_and_superscript_numbers_before_emission(self):
        self.document_numeric_parity(mixed=False)
        self.service.execute_query.assert_not_called()

    def test_real_mixed_rejects_unsupported_attached_and_superscript_numbers_before_composition(self):
        self.document_numeric_parity(mixed=True)


if __name__ == "__main__":
    unittest.main()