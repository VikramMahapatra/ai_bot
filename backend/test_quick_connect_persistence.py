"""Isolated production endpoint/services/columns; SQLite only, no app startup IO."""
import ast
import asyncio
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import logging
import re
from pathlib import Path
from threading import Lock
from types import SimpleNamespace as NS
from typing import Optional
from unittest import TestCase, main
from unittest.mock import Mock, patch

from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, EmailStr, field_validator
import sqlalchemy as sa
from sqlalchemy.orm import Session, declarative_base
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).parent


def definitions(path, namespace, names=None, endpoint=False, models=False):
    tree = ast.parse((ROOT / path).read_text(encoding="utf-8"))
    nodes = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        if names is not None and node.name not in names:
            continue
        if endpoint:
            node.decorator_list = []
            node.args.defaults = [ast.Constant(None) for _ in node.args.defaults]
        if models:
            # Preserve production SQL columns/constraints, omit relationships to
            # unrelated models so mapper setup cannot import application startup.
            node.body = [stmt for stmt in node.body if not (
                isinstance(stmt, ast.Assign) and isinstance(stmt.value, ast.Call)
                and isinstance(stmt.value.func, ast.Name) and stmt.value.func.id == "relationship")]
        nodes.append(node)
    tree.body = [ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), *nodes]
    namespace.setdefault("__name__", __name__)
    exec(compile(ast.fix_missing_locations(tree), str(ROOT / path), "exec"), namespace)


def model_namespace():
    base = declarative_base()
    ns = dict(vars(sa), Base=base, func=sa.func, SQLEnum=sa.Enum)
    for table in ("organizations", "users", "qualification_templates"):
        sa.Table(table, base.metadata, sa.Column("id", sa.Integer, primary_key=True))
    for path, names in (
        ("conversation.py", {"Conversation"}), ("lead.py", {"Lead"}),
        ("campaign.py", {"Contact", "ContactList"}), ("widget_config.py", {"WidgetConfig"}),
        ("lead_activities.py", {"LeadActivity"}), ("lead_contact_mapping.py", {"LeadContactMapping"}),
        ("organization_usage.py", {"OrganizationUsage"}),
        ("organization_subscription_usage.py", {"OrganizationSubscriptionUsage"}),
        ("organization_subscription.py", {"OrganizationSubscription"}),
    ):
        definitions("app/models/" + path, ns, names, models=True)
    return ns


class QuickConnectPersistenceTests(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.models = model_namespace()

    def setUp(self):
        self.engine = sa.create_engine("sqlite://", poolclass=StaticPool,
                                       connect_args={"check_same_thread": False})
        self.models["Base"].metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.ns = dict(self.models, datetime=datetime, timedelta=timedelta, timezone=timezone,
                       json=json, deepcopy=deepcopy, dataclass=dataclass, Lock=Lock,
                       monotonic=Mock(return_value=100.0), CacheProvider=object,
                       HTTPException=HTTPException, logger=logging.getLogger(__name__),
                       BaseModel=BaseModel, EmailStr=EmailStr, field_validator=field_validator,
                       ALLOWED_LEAD_SOURCES={"chat", "voice", "email", "sms", "whatsapp"},
                       is_valid_funnel_stage=lambda *a: True)
        definitions("app/schemas/lead.py", self.ns, {"LeadCreate", "LeadResponse"})
        for name in ("LeadCreate", "LeadResponse"):
            self.ns[name].model_rebuild(_types_namespace=dict(self.ns, Optional=Optional))
        definitions("app/services/chat/cache_service.py", self.ns)
        self.cache = self.ns["InMemoryTTLCache"]()
        self.ns["chat_cache"] = self.cache
        definitions("app/services/chat/persistence_service.py", self.ns,
                    {"find_session_contact", "persist_conversation_record", "contact_form_messages",
                     "persist_contact_form_records", "recover_contact_form_records",
                     "_parse_contact_form_submission"})
        definitions("app/services/chat/contact_context.py", self.ns)
        self.ns["get_current_year_month"] = lambda: (2026, 10)
        definitions("app/services/lead_persistence_service.py", self.ns)
        self.ns.update(create_lead_activity=self.ns["stage_lead_activity"],
                       increment_usage=self.ns["stage_lead_usage"],
                       get_effective_limits=lambda *a: dict(subscription_active=True, lead_generation_enabled=True),
                       FeatureCodes=NS(AI_LEAD_GEN="lead"),
                       organization_credit_service=NS(validate_feature_usage=Mock(return_value=True),
                                                      deduct_credits=Mock()),
                       notify_lead_created=Mock(), _normalize_phone=lambda p: "".join(c for c in p if c.isdigit()))
        # Use the actual agent-list helper, without editing/importing chat API.
        definitions("app/api/chat.py", self.ns, {"_get_or_create_agent_contact_list",
                    "_agent_contact_list_marker", "_agent_contact_list_name", "get_history"}, endpoint=True)
        definitions("app/api/leads.py", self.ns, {"_normalize_source", "_normalize_funnel_stage",
                    "_validate_funnel_stage_for_org", "_extract_lead_outcome_from_custom_fields",
                    "_sync_lead_contact_to_agent_list", "_link_lead_session_contact", "create_lead"}, endpoint=True)
        definitions("app/services/chat/prompt_builder.py", self.ns, {"build_chat_messages"})
        self.widget = self.models["WidgetConfig"](organization_id=7, user_id=3, widget_id="w",
                                                  name="Agent", qualification_template_id=1)
        self.db.add(self.widget)
        self.db.commit()
        self.custom = {"city": "Pune", "amount": 0, "opt_in": False, "empty": "", "null": None,
                       "nested": {"b": [0, False, {"a": "x:y"}], "a": 1},
                       'odd\": key\n💬': ["a", "b"], "city_name": "A", "city name": "B",
                       "name": "Custom, not standard"}

    def payload(self, **updates):
        return self.ns["LeadCreate"](**(dict(session_id="s", widget_id="w", name="Ada",
            email="ada@example.com", phone="5551234567", company="Acme",
            custom_fields=json.dumps(self.custom)) | updates))

    def submit(self, payload=None, user=None):
        return asyncio.run(self.ns["create_lead"](payload or self.payload(), self.db, user))

    def rows(self, **scope):
        return self.db.query(self.models["Conversation"]).filter_by(**scope).order_by(
            self.models["Conversation"].id).all()

    def context(self, session="s", widget="w", org=7):
        return self.ns["get_session_contact"](self.db, org, widget, session)

    def closed_lead(self, session="old", org=7):
        lead = self.models["Lead"](session_id=session, widget_id="w", organization_id=org,
             user_id=3, name="Old", email="ada@example.com", funnel_stage="closed_won", source="chat")
        self.db.add(lead)
        self.db.commit()
        return lead

    def test_fields_are_user_only_readable_exact_scope_and_reversible(self):
        self.submit()
        rows = self.rows()
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0].message.startswith("Quick Connect Details: Name: Ada | "
            "Email: ada@example.com | Phone: 5551234567 | Company: Acme | "))
        for row in rows:
            self.assertEqual((row.organization_id, row.user_id, row.widget_id, row.session_id), (7, 3, "w", "s"))
            self.assertEqual((row.role, row.response, row.source), ("user", "", "quick_connect"))
            self.assertIsNotNone(row.contact_id)
        self.cache._items.clear()
        self.assertEqual(self.context()["custom_fields"], self.custom)

    def test_dedup_changed_values_canonical_objects_and_reverting_values(self):
        self.closed_lead()
        self.submit()
        count = len(self.rows())
        self.submit()
        self.assertEqual(len(self.rows()), count)
        reordered = dict(reversed(list(self.custom.items())))
        reordered["nested"] = {"a": 1, "b": [0, False, {"a": "x:y"}]}
        self.submit(self.payload(custom_fields=json.dumps(reordered)))
        self.assertEqual(len(self.rows()), count)
        self.submit(self.payload(name="Grace", custom_fields=json.dumps(reordered)))
        self.assertEqual(len(self.rows()), count + 1)
        self.cache._items.clear()
        self.assertEqual(self.context()["name"], "Grace")
        self.submit()
        self.assertEqual(len(self.rows()), count + 1)
        self.cache._items.clear()
        self.assertEqual(self.context()["name"], "Ada")
        self.assertEqual(self.db.query(self.models["Lead"]).count(), 1)

    def test_closed_lead_other_session_recovers_submitted_values_after_ttl_and_restart(self):
        lead = self.closed_lead()
        result = self.submit()
        self.assertEqual(result.id, lead.id)
        self.assertEqual(result.session_id, "old")
        self.ns["monotonic"].return_value = 221
        self.assertEqual(self.context()["name"], "Ada")
        self.cache._items.clear()
        self.assertEqual(self.context()["custom_fields"], self.custom)
        self.assertEqual(self.context(session="reset"), {})
        self.assertEqual(self.context(widget="other"), {})
        self.assertEqual(self.context(org=8), {})

    def recover(self, session="s", widget="w", org=7):
        return self.ns["recover_contact_form_records"](self.db, org, widget, session)

    def form_row(self, message, **updates):
        row = self.models["Conversation"](**(dict(organization_id=7, user_id=3,
            widget_id="w", session_id="s", role="user", source="quick_connect",
            response="", message=message, created_at=datetime(2020, 1, 1)) | updates))
        self.db.add(row)
        self.db.flush()
        return row

    def test_combined_delimiters_quotes_and_nested_typed_custom_exact_roundtrip(self):
        custom = dict(self.custom, pipe='a | b: "quoted"\nnext',
            nested={"pipe | : key": ["x | Company: injected", {"line": "\r\n"}]})
        custom[' | Custom field "trap":\n'] = {"false": False, "null": None, "zero": 0}
        payload = self.payload(name='Ada | Email: other@example.com\n"Visitor"',
            company="Acme: Labs | Pune\\Office", custom_fields=json.dumps(custom))
        self.submit(payload)
        rows = self.rows()
        self.assertEqual(len(rows), 1)
        self.assertNotIn("\n", rows[0].message)
        self.assertIn('Name: "Ada | Email:', rows[0].message)
        self.assertIn('Custom field "pipe": "a | b:', rows[0].message)
        expected = dict(name=payload.name, email=str(payload.email), phone=payload.phone,
                        company=payload.company, custom_fields=custom)
        self.assertEqual(self.recover(), expected)
        self.cache._items.clear()
        self.assertEqual(self.context(), expected)

    def test_generator_one_message_empty_null_and_json_looking_standard_strings(self):
        for contact in ({}, {"name": "", "company": None},
                {"name": "null", "phone": "5551234567", "company": "false"},
                {"name": "  Ada  ", "company": '"Acme"'},
                {"company": "[nested | : value]", "phone": "001234"}):
            with self.subTest(contact=contact):
                messages = list(self.ns["contact_form_messages"](contact))
                self.assertEqual(len(messages), 1)
                parsed = self.ns["_parse_contact_form_submission"](messages[0])
                self.assertEqual(parsed, dict(contact, custom_fields={}))
        payload = self.ns["LeadCreate"](session_id="s", widget_id="w", name=None,
                                        custom_fields='{"empty":"","null":null,"zero":0,"false":false}')
        self.submit(payload)
        self.assertEqual(len(self.rows()), 1)
        self.assertTrue(self.rows()[0].message.startswith("Quick Connect Details: Name: null | "))
        self.assertNotIn("Email:", self.rows()[0].message)
        self.assertEqual(self.recover(), dict(name=None,
            custom_fields={"empty": "", "null": None, "zero": 0, "false": False}))

    def test_custom_only_changes_make_one_new_snapshot_and_revert_latest(self):
        self.closed_lead()
        self.submit(self.payload(custom_fields='{"a":0,"removed":"first"}'))
        first_id = self.rows()[0].id
        self.submit(self.payload(custom_fields='{"a":false,"new":"b | c"}'))
        self.assertEqual(len(self.rows()), 2)
        self.assertEqual(self.recover()["custom_fields"], {"a": False, "new": "b | c"})
        self.submit(self.payload(custom_fields='{"removed":"first","a":0}'))
        self.assertEqual(len(self.rows()), 2)
        self.assertEqual(self.recover()["custom_fields"], {"a": 0, "removed": "first"})
        self.assertEqual(self.rows()[0].id, first_id)

    def test_mixed_legacy_combined_history_preserves_live_rows_and_later_legacy(self):
        legacy = [self.form_row("Name: Legacy | raw: name\nline"),
                  self.form_row('Custom field "old": {"pipe": "x | y"}'),
                  self.form_row('Custom field "null": null')]
        self.db.commit()
        before = [(r.id, r.message, r.created_at) for r in legacy]
        self.assertEqual(self.recover(), {"name": "Legacy | raw: name\nline",
            "custom_fields": {"old": {"pipe": "x | y"}, "null": None}})
        self.submit()
        self.assertEqual(len(self.rows()), len(legacy) + 1)
        self.assertEqual([(r.id, r.message, r.created_at) for r in legacy], before)
        self.assertEqual(self.recover()["custom_fields"], self.custom)
        self.form_row("Company: Later | legacy: company\nline",
                      created_at=datetime(2099, 1, 1))
        self.form_row('Custom field "later | key": [false, "a | b"]',
                      created_at=datetime(2099, 1, 1))
        self.db.commit()
        self.assertEqual(self.recover()["company"], "Later | legacy: company\nline")
        self.assertEqual(self.recover()["custom_fields"],
                         dict(self.custom, **{"later | key": [False, "a | b"]}))

    def test_malformed_combined_rows_are_ignored_without_partial_overwrites(self):
        self.submit()
        before = deepcopy(self.recover())
        for message in ('Quick Connect Details: Name: Corrupt | Custom field "bad": {',
                'Quick Connect Details: Name: "unterminated | Company: trap',
                'Quick Connect Details: Custom field 2: false',
                'Quick Connect Details: Custom field "bad": ["a | b"] trailing',
                'Quick Connect Details: Name: Corrupt | ',
                'Custom field "bad": broken'):
            self.form_row(message, created_at=datetime(2099, 1, 1))
        self.db.commit()
        self.assertEqual(self.recover(), before)

    def test_combined_dedup_exact_user_tenant_widget_session_source_and_role(self):
        message = next(self.ns["contact_form_messages"](self.payload()))
        for scope in (dict(organization_id=8), dict(user_id=4), dict(widget_id="other"),
                      dict(session_id="other"), dict(source="chat"), dict(role="assistant")):
            self.form_row(message, **scope)
        self.db.commit()
        before = [(r.id, r.created_at) for r in self.rows()]
        self.submit()
        self.submit()
        self.assertEqual(len(self.rows()), 7)
        self.assertEqual([(r.id, r.created_at) for r in self.rows()[:6]], before)
        self.assertEqual(len(self.rows(organization_id=7, user_id=3, widget_id="w",
                                     session_id="s", source="quick_connect", role="user")), 1)

    def test_failed_revert_restores_previous_latest_snapshot_timestamp(self):
        self.closed_lead()
        self.submit()
        self.submit(self.payload(name="Grace", custom_fields='{"latest":false}'))
        before = [(r.id, r.message, r.created_at) for r in self.rows()]
        with patch.object(self.db, "commit", side_effect=RuntimeError("commit failure")):
            with self.assertRaises(HTTPException):
                self.submit()
        self.assertEqual([(r.id, r.message, r.created_at) for r in self.rows()], before)
        self.cache._items.clear()
        self.assertEqual(self.context()["name"], "Grace")
        self.assertEqual(self.recover()["custom_fields"], {"latest": False})

    def test_form_dedup_is_scope_local_not_lead_local(self):
        self.closed_lead()
        self.submit()
        count = len(self.rows())
        self.submit(self.payload(session_id="other"))
        self.assertEqual(len(self.rows()), count * 2)
        self.assertEqual(len(self.rows(session_id="other")), count)

    def test_history_endpoint_and_ai_builder_have_no_invented_assistant(self):
        self.submit()
        history = asyncio.run(self.ns["get_history"]("s", self.db, NS(organization_id=7), "w"))
        self.assertEqual(len(history), 1)
        messages = self.ns["build_chat_messages"]("system", [dict(user=r.message, assistant=r.response)
                                                                  for r in history], "next question")
        self.assertFalse(any(m["role"] == "assistant" for m in messages))
        self.assertIn({"role": "user", "content": history[0].message}, messages)
        self.assertEqual(asyncio.run(self.ns["get_history"]("s", self.db, NS(organization_id=8), "w")), [])

    def test_user_only_form_entries_do_not_hide_previous_handoff_offer(self):
        reply = "Would you like me to connect you with a human agent?"
        self.db.add(self.models["Conversation"](organization_id=7, user_id=3,
            session_id="s", widget_id="w", message="help", response=reply,
            role="user", source="chat", created_at=datetime(2020, 1, 1)))
        self.db.commit()
        self.submit()
        self.ns["re"] = re
        definitions("app/api/chat.py", self.ns, {"_get_previous_assistant_message",
            "_last_response_was_escalation", "_latest_handoff_offer_response",
            "_response_offers_handoff", "_normalize_handoff_text"})
        self.assertEqual(self.ns["_get_previous_assistant_message"](self.db, "s", "w"), reply)
        self.assertTrue(self.ns["_last_response_was_escalation"](self.db, "s", "w"))
        self.assertEqual(self.ns["_latest_handoff_offer_response"](self.db, "s", "w"), reply)

    def test_cache_miss_merge_new_form_over_old_exact_session_lead(self):
        self.closed_lead(session="s")
        self.submit()
        self.cache._items.clear()
        self.assertEqual(self.context()["name"], "Ada")
        copy = self.context()
        copy["custom_fields"]["nested"]["a"] = 9
        self.assertEqual(self.context()["custom_fields"]["nested"]["a"], 1)

    def test_existing_contact_reuse_returns_mapping_and_scoped_links(self):
        self.submit()
        contact_id = self.rows()[0].contact_id
        self.submit(self.payload(session_id="second", custom_fields='{"new":false}'))
        self.assertEqual(self.db.query(self.models["Contact"]).count(), 1)
        self.assertEqual(self.db.query(self.models["LeadContactMapping"]).count(), 2)
        self.assertTrue(all(r.contact_id == contact_id for r in self.rows(session_id="second")))

    def test_contact_lookup_and_link_updates_do_not_cross_org_or_widget(self):
        C, CL, Conv = (self.models[n] for n in ("Contact", "ContactList", "Conversation"))
        for org, widget in ((8, "w"), (7, "other")):
            cl = CL(organization_id=org, list_name="Other", description=f"AUTO_AGENT_APPOINTMENT_LIST::{widget}")
            self.db.add(cl)
            self.db.flush()
            c = C(contact_list_id=cl.id, session_id="s", name="Other", email="ada@example.com")
            self.db.add(c)
            self.db.flush()
            self.db.add(Conv(organization_id=org, widget_id=widget, session_id="s", message="keep",
                             response="keep", role="user", contact_id=c.id))
        self.db.commit()
        before = [(r.id, r.contact_id) for r in self.rows()]
        self.submit()
        for rid, cid in before:
            self.assertEqual(self.db.get(Conv, rid).contact_id, cid)
        own = self.ns["find_session_contact"](self.db, "s", "w", 7)
        self.assertIsNotNone(own)
        self.assertTrue(all(r.contact_id == own.id for r in self.rows(organization_id=7, widget_id="w")))

    def test_invalid_widget_never_falls_back_authenticated_organization(self):
        with self.assertRaises(HTTPException) as caught:
            self.submit(self.payload(widget_id="invalid"), NS(id=20, organization_id=8, username="other"))
        self.assertEqual(caught.exception.status_code, 404)
        self.assertEqual(self.rows(), [])
        self.assertEqual(self.db.query(self.models["Lead"]).count(), 0)
        self.assertEqual(self.cache._items, {})

    def test_no_widget_authenticated_lead_has_no_unbound_owner(self):
        self.submit(self.payload(widget_id=None), NS(id=3, organization_id=7, username="admin"))
        self.assertTrue(self.rows(widget_id=None))
        self.assertEqual(self.db.query(self.models["Contact"]).count(), 0)

    def assert_no_submission(self):
        for name in ("Lead", "Contact", "ContactList", "Conversation", "LeadActivity",
                     "LeadContactMapping", "OrganizationUsage", "OrganizationSubscriptionUsage"):
            self.assertEqual(self.db.query(self.models[name]).count(), 0, name)
        self.assertEqual(self.cache._items, {})
        self.ns["notify_lead_created"].assert_not_called()

    def test_credit_failure_rolls_back_lead_contact_activity_before_form_cache(self):
        self.ns["organization_credit_service"].deduct_credits.side_effect = RuntimeError("credit failure")
        with self.assertRaises(HTTPException):
            self.submit()
        self.assert_no_submission()

    def test_persistence_failure_rolls_back_usage_even_active_subscription(self):
        sub = self.models["OrganizationSubscription"](organization_id=7, is_active=True,
            start_date=datetime.now() - timedelta(days=1), end_date=datetime.now() + timedelta(days=20))
        self.db.add(sub)
        self.db.commit()
        self.ns["persist_contact_form_records"] = Mock(side_effect=RuntimeError("form failure"))
        with self.assertRaises(HTTPException):
            self.submit()
        self.assert_no_submission()

    def test_final_commit_failure_rolls_back_flushed_transcript_and_no_cache(self):
        with patch.object(self.db, "commit", side_effect=RuntimeError("commit failure")):
            with self.assertRaises(HTTPException):
                self.submit()
        self.assert_no_submission()

    def test_failed_resubmission_preserves_previous_transcript_and_cache(self):
        self.closed_lead()
        self.submit()
        before = [(r.id, r.message, r.created_at) for r in self.rows()]
        original_context = deepcopy(self.context())
        with patch.object(self.db, "commit", side_effect=RuntimeError("commit failure")):
            with self.assertRaises(HTTPException):
                self.submit(self.payload(name="Changed", custom_fields='{"city":"Changed"}'))
        self.assertEqual([(r.id, r.message, r.created_at) for r in self.rows()], before)
        self.assertEqual(self.context(), original_context)
        self.cache._items.clear()
        self.assertEqual(self.context(), original_context)

    def test_feature_and_credit_gates_leave_no_transcript_or_cache(self):
        self.ns["get_effective_limits"] = lambda *a: dict(subscription_active=False)
        with self.assertRaises(HTTPException) as caught:
            self.submit()
        self.assertEqual(caught.exception.status_code, 403)
        self.assert_no_submission()
        self.ns["get_effective_limits"] = lambda *a: dict(subscription_active=True, lead_generation_enabled=True)
        self.ns["organization_credit_service"].validate_feature_usage.return_value = False
        with self.assertRaises(HTTPException) as caught:
            self.submit()
        self.assertEqual(caught.exception.status_code, 400)
        self.assert_no_submission()

    def test_form_only_partial_and_chat_persistence_scope(self):
        result = self.submit(self.payload(name=None, email=None, phone=None, company=None,
                                         custom_fields='{"zero":0,"false":false}'))
        self.assertEqual(len(self.rows()), 1)
        self.assertEqual(self.context()["custom_fields"], {"zero": 0, "false": False})
        self.assertEqual(result.organization_id, 7)
        self.assertEqual(self.db.query(self.models["Contact"]).count(), 0)
        self.ns["persist_conversation_record"](self.db, "s", "w", 3, 7, "question", "answer")
        self.db.commit()
        row = self.rows()[-1]
        self.assertEqual((row.message, row.response, row.source, row.contact_id),
                         ("question", "answer", "chat", None))

    def test_successful_staging_commits_once_and_only_then_notifies(self):
        def notify(db, lead):
            self.assertEqual(commit.call_count, 1)
            self.assertTrue(self.rows())
            self.assertTrue(self.context())
        self.ns["notify_lead_created"].side_effect = notify
        with patch.object(self.db, "commit", wraps=self.db.commit) as commit:
            self.submit()
            self.assertEqual(commit.call_count, 1)
        self.assertEqual(self.db.query(self.models["OrganizationUsage"]).one().leads_count, 1)
        self.assertEqual(self.db.query(self.models["LeadActivity"]).count(), 1)

    def test_malformed_custom_values_fail_atomically_not_silently_dropped(self):
        for value in ("bad JSON", "[]", "false", "0"):
            with self.subTest(value=value), self.assertRaises(HTTPException):
                self.submit(self.payload(custom_fields=value))
            self.assert_no_submission()

    def test_expired_subscription_cannot_trigger_hidden_commit(self):
        sub = self.models["OrganizationSubscription"](organization_id=7, is_active=True,
            start_date=datetime.now() - timedelta(days=30), end_date=datetime.now() - timedelta(days=1))
        self.db.add(sub)
        self.db.commit()
        self.ns["persist_contact_form_records"] = Mock(side_effect=RuntimeError("form failure"))
        with self.assertRaises(HTTPException):
            self.submit()
        self.assert_no_submission()

    def test_http_post_uses_actual_endpoint_hook_and_pydantic_schema(self):
        app = FastAPI()
        async def endpoint(lead):
            return await self.ns["create_lead"](lead, self.db, None)
        endpoint.__annotations__["lead"] = self.ns["LeadCreate"]
        app.add_api_route("/api/admin/leads", endpoint, methods=["POST"], response_model=self.ns["LeadResponse"])
        async def post():
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                return await client.post("/api/admin/leads", json=self.payload().model_dump())
        response = asyncio.run(post())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["organization_id"], 7)
        self.assertEqual(len(self.rows()), 1)

    def test_http_post_failure_has_no_form_or_cache(self):
        app = FastAPI()
        async def endpoint(lead):
            return await self.ns["create_lead"](lead, self.db, None)
        endpoint.__annotations__["lead"] = self.ns["LeadCreate"]
        app.add_api_route("/api/admin/leads", endpoint, methods=["POST"])
        self.ns["organization_credit_service"].deduct_credits.side_effect = RuntimeError("no credits")
        async def post():
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                return await client.post("/api/admin/leads", json=self.payload().model_dump())
        response = asyncio.run(post())
        self.assertEqual(response.status_code, 500)
        self.assert_no_submission()


if __name__ == "__main__":
    main()