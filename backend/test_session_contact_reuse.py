"""Production-source regression tests; memory-only SQLite, no app/Chroma/startup IO."""
import ast
import asyncio
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import json
import logging
from pathlib import Path
import re
from threading import Lock
from types import SimpleNamespace as NS
from typing import Optional
import unittest
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo
from test_appointment_datetime import resolve as resolve_appointment_datetime

from dateutil import parser as dateutil_parser
from fastapi import HTTPException
from pydantic import BaseModel, EmailStr, TypeAdapter, ValidationError
from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import Session, declarative_base


ROOT = Path(__file__).parent


def definitions(path, namespace, names=None, endpoint=False):
    tree = ast.parse((ROOT / path).read_text(encoding="utf-8"))
    nodes = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and (
            names is None or node.name in names
        ):
            if endpoint:
                node.decorator_list = []
                node.args.defaults = [ast.Constant(None) for _ in node.args.defaults]
            nodes.append(node)
    tree.body = [ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), *nodes]
    namespace.setdefault("__name__", __name__)
    exec(compile(ast.fix_missing_locations(tree), str(ROOT / path), "exec"), namespace)
    return namespace


Base = declarative_base()


class LeadRow(Base):
    __tablename__ = "isolated_leads"
    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer)
    widget_id = Column(String)
    session_id = Column(String)
    name = Column(String)
    email = Column(String)
    phone = Column(String)
    company = Column(String)
    custom_fields = Column(Text)
    created_at = Column(DateTime, default=datetime.now)


class ConversationRow(Base):
    __tablename__ = "isolated_conversations"
    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer)
    user_id = Column(Integer)
    widget_id = Column(String)
    session_id = Column(String)
    source = Column(String)
    role = Column(String)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)


class ContactReuseTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.clock = Mock(return_value=100.0)
        self.cache_ns = dict(dataclass=dataclass, Lock=Lock, monotonic=self.clock, CacheProvider=object)
        definitions("app/services/chat/cache_service.py", self.cache_ns)
        self.cache = self.cache_ns["InMemoryTTLCache"]()
        self.contact_ns = dict(deepcopy=deepcopy, json=json, Lead=LeadRow,
                       Conversation=ConversationRow, chat_cache=self.cache)
        definitions("app/services/chat/persistence_service.py", self.contact_ns,
            {"recover_contact_form_records", "_parse_contact_form_submission"})
        definitions("app/services/chat/contact_context.py", self.contact_ns)
        self.get_contact = self.contact_ns["get_session_contact"]
        self.save = self.contact_ns["cache_session_contact"]
        self.contact = dict(name="Ada Visitor", email="ada@example.com", phone="+1 555 0100",
                            company="Visitor Co", custom_fields='{"role":"Founder","city":"Pune"}')
        self.user = NS(id=3, organization_id=7, organization=NS(timezone="UTC"))
        self.widget = NS(user_id=3, organization_id=7, widget_id="w")
        self.active = None
        self.io = Mock()
        self.intent_type = NS(**{name: name for name in (
            "BOOK_APPOINTMENT", "RESCHEDULE_APPOINTMENT", "PROVIDE_DATETIME", "PROVIDE_TIMEZONE",
            "CONFIRM", "REQUEST_HUMAN", "DENY", "PROVIDE_NAME", "PROVIDE_EMAIL")})
        self.api = dict(date=date, datetime=datetime, time=time, timedelta=timedelta,
            timezone=timezone, ZoneInfo=ZoneInfo,
            re=re, json=json, dateutil_parser=dateutil_parser, DEFAULT_APPOINTMENT_TIMEZONE="Asia/Kolkata",
            resolve_appointment_datetime=resolve_appointment_datetime,
            BaseModel=BaseModel, EmailStr=EmailStr, TypeAdapter=TypeAdapter, ValidationError=ValidationError,
            HTTPException=HTTPException, IntentType=self.intent_type,
            get_session_contact=lambda db, org, widget, session: self.get_contact(self.db, org, widget, session),
            _get_active_intake=lambda *args: self.active, _has_booked_appointment=lambda *args: False,
            _last_response_was_escalation=lambda *args: False, AppointmentIntake=self.make_intake,
            _finalize_intake_appointment=Mock(return_value="BOOKED"))
        names = {"_handle_appointment_intake_flow", "_hydrate_intake_contact", "_prompt_for_next_intake_field",
            "_is_cancel", "_is_skip", "_is_resume_booking_intent", "_is_booking_intent", "_mentions_appointment_topic",
            "_is_escalation_opt_in", "_is_greeting_or_smalltalk", "_is_relevant_for_next_field", "_extract_name",
            "_extract_email", "_extract_phone", "_extract_timezone", "_canonical_timezone", "_has_date_hint",
            "_normalize_datetime_text", "_looks_like_person_name",
            "_has_time_hint", "_parse_datetime_input", "_parse_date_only_input", "_parse_time_only_input",
            "_parse_iso_datetime_entity", "_appointment_datetime_examples_message", "AppointmentBookingRequest",
            "AppointmentBookingResponse", "_build_appointment_confirmation_message", "_has_captured_lead_for_session",
            "_handoff_lead_capture_prompt_for_direct_request", "_handoff_lead_capture_prompt_if_needed",
            "_normalize_handoff_text", "_is_handoff_opt_in", "_is_direct_live_agent_request",
            "_is_explicit_human_request"}
        definitions("app/api/chat.py", self.api, names)

    def make_intake(self, **kwargs):
        self.active = NS(name=None, email=None, phone=None, appointment_at=None, timezone=None, notes=None, **kwargs)
        return self.active

    def turn(self, message, intent="BOOK_APPOINTMENT", entities=None):
        return asyncio.run(self.api["_handle_appointment_intake_flow"](
            self.io, self.user, self.widget, "s", "w", message,
            message_intent=NS(primary_intent=intent, entities=entities or {})))

    def test_cache_scope_copy_custom_fields_and_existing_ttl(self):
        self.save(7, "w", "s", self.contact)
        got = self.get_contact(self.db, 7, "w", "s")
        self.assertEqual(got["company"], "Visitor Co")
        self.assertEqual(got["custom_fields"]["role"], "Founder")
        got["custom_fields"]["role"] = "Changed"
        self.assertEqual(self.get_contact(self.db, 7, "w", "s")["custom_fields"]["role"], "Founder")
        for scope in ((8, "w", "s"), (7, "other", "s"), (7, "w", "privacy-reset")):
            self.assertEqual(self.get_contact(self.db, *scope), {})
        self.clock.return_value = 219
        self.assertTrue(self.get_contact(self.db, 7, "w", "s"))
        self.clock.return_value = 221
        self.assertTrue(self.get_contact(self.db, 7, "w", "s"))
        self.clock.return_value = 342
        self.assertEqual(self.get_contact(self.db, 7, "w", "s"), {})

    def test_persisted_fallback_exact_scope_after_expiry_and_restart(self):
        for org, widget, session, name in ((7, "w", "s", "Right"), (8, "w", "s", "Other org"),
                (7, "other", "s", "Other widget"), (7, "w", "other", "Other session")):
            self.db.add(LeadRow(organization_id=org, widget_id=widget, session_id=session,
                               name=name, email="shared@example.com", company=name, custom_fields='{"city":"Pune"}'))
        self.db.commit()
        self.save(7, "w", "s", self.contact)
        self.clock.return_value = 221
        self.assertEqual(self.get_contact(self.db, 7, "w", "s")["name"], "Right")
        self.cache._items.clear()
        self.assertEqual(self.get_contact(self.db, 7, "w", "s")["company"], "Right")
        self.assertEqual(self.get_contact(self.db, 7, "w", "reset"), {})
        self.assertEqual(self.get_contact(self.db, 7, "", "s"), {})

    def test_key_delimiters_cannot_collide_and_partial_merges(self):
        self.save(7, "w::s", "x", self.contact)
        self.assertEqual(self.get_contact(self.db, 7, "w", "s::x"), {})
        self.save(7, "w", "s", self.contact)
        self.save(7, "w", "s", dict(phone="  ", custom_fields='{"tier":"Gold"}'))
        got = self.get_contact(self.db, 7, "w", "s")
        self.assertEqual(got["phone"], self.contact["phone"])
        self.assertEqual(got["custom_fields"], dict(role="Founder", city="Pune", tier="Gold"))

    def test_full_contact_booking_then_date_and_time_subsequent_turns(self):
        self.save(7, "w", "s", self.contact)
        self.assertIn("date and time", self.turn("book a meeting"))
        self.assertEqual(self.active.next_field, "appointment_at")
        self.assertEqual(self.active.phone, self.contact["phone"])
        self.assertIn("time as well", self.turn("13 May 2099", "PROVIDE_DATETIME"))
        self.assertEqual(self.turn("10:30 AM", "PROVIDE_DATETIME"), "BOOKED")
        self.assertEqual(self.active.appointment_at.year, 2099)
        self.assertEqual(self.active.appointment_at.hour, 10)
        self.assertEqual(self.active.appointment_at.minute, 30)

    def test_tom_abbreviation_with_time_resolves_tomorrow_in_business_timezone(self):
        self.save(7, "w", "s", self.contact)
        tomorrow = datetime.now(ZoneInfo("Asia/Kolkata")).date() + timedelta(days=1)
        self.assertIn("date and time", self.turn("book a meeting"))
        result = self.turn("tom at 4 pm", "PROVIDE_DATETIME")
        self.assertEqual(result, "BOOKED")
        self.assertEqual(self.active.appointment_at.date(), tomorrow)
        self.assertEqual((self.active.appointment_at.hour, self.active.appointment_at.minute), (16, 0))

    def test_relative_date_then_time_preserves_date_in_active_intake(self):
        self.save(7, "w", "s", self.contact)
        self.turn("book a meeting")
        date_reply = self.turn("tmrw", "PROVIDE_DATETIME")
        self.assertIn("time as well", date_reply)
        saved_date = self.active.appointment_at.date()
        self.assertEqual(self.turn("4pm", "PROVIDE_DATETIME"), "BOOKED")
        self.assertEqual(self.active.appointment_at.date(), saved_date)
        self.assertEqual((self.active.appointment_at.hour, self.active.appointment_at.minute), (16, 0))

    def test_ambiguous_hour_requests_clarification_without_booking(self):
        self.save(7, "w", "s", self.contact)
        self.turn("book a meeting")
        reply = self.turn("tom at 4", "PROVIDE_DATETIME")
        self.assertIn("couldn’t determine", reply)
        self.assertIsNone(self.active.appointment_at)

    def test_combined_transcript_recovery_hydrates_booking_after_cache_expiry(self):
        definitions("app/services/chat/persistence_service.py", self.contact_ns,
                    {"contact_form_messages"})
        message = next(self.contact_ns["contact_form_messages"](self.contact))
        self.db.add(ConversationRow(organization_id=7, user_id=3, widget_id="w",
            session_id="s", role="user", source="quick_connect", message=message))
        self.db.commit()
        self.save(7, "w", "s", self.contact)
        self.clock.return_value = 221
        self.assertIn("date and time", self.turn("book a meeting"))
        self.assertEqual(self.active.next_field, "appointment_at")
        self.assertEqual((self.active.name, self.active.email, self.active.phone),
                         (self.contact["name"], self.contact["email"], self.contact["phone"]))
        self.cache._items.clear()
        self.make_intake(status="collecting", next_field="name")
        self.assertEqual(self.turn("13 May 2099 at 10:30 AM", "PROVIDE_DATETIME",
            {"datetime": "2099-05-13T10:30:00+05:30"}), "BOOKED")
        for scope in ((8, "w", "s"), (7, "other", "s"), (7, "w", "reset")):
            self.assertEqual(self.get_contact(self.db, *scope), {})

    def test_initial_and_resumed_booking_datetime_is_not_discarded(self):
        self.save(7, "w", "s", self.contact)
        self.assertEqual(self.turn("book a meeting on 13 May 2099 at 10:30 AM",
            entities={"datetime": "2099-05-13T10:30:00+05:30"}), "BOOKED")
        self.make_intake(status="collecting", next_field="name")
        self.assertEqual(self.turn("schedule meeting 2099-05-14 11:30 AM",
            entities={"datetime": "2099-05-14T11:30:00+05:30"}), "BOOKED")
        self.make_intake(status="collecting", next_field="name")
        self.assertEqual(self.turn("that slot please", "PROVIDE_DATETIME",
            entities={"datetime": "2099-05-15T11:30:00+05:30"}), "BOOKED")

    def test_all_resume_prompts_hydrate_before_return(self):
        self.save(7, "w", "s", self.contact)
        for message in ("continue", "book a meeting", "yes", "meeting"):
            with self.subTest(message=message):
                self.make_intake(status="collecting", next_field="name")
                result = self.turn(message)
                self.assertIn("date and time", result)
                self.assertNotIn("full name", result)
                self.assertEqual(self.active.email, self.contact["email"])

    def test_partial_contacts_skip_only_populated_fields(self):
        for contact, expected in ((dict(name="Ada"), "email"),
                (dict(email="ada@example.com"), "name"),
                (dict(name="Ada", phone="555"), "email"),
                (dict(company="Acme"), "name")):
            with self.subTest(contact=contact):
                self.cache._items.clear()
                self.active = None
                self.save(7, "w", "s", contact)
                self.turn("book meeting")
                self.assertEqual(self.active.next_field, expected)
        self.cache._items.clear()
        self.active = None
        self.save(7, "w", "s", dict(email="ada@example.com"))
        self.turn("book meeting")
        self.assertIn("date and time", self.turn("My name is Ada Visitor", "PROVIDE_NAME"))
        self.assertEqual(self.active.email, "ada@example.com")

    def test_hydration_preserves_explicit_intake_and_datetime_state(self):
        self.save(7, "w", "s", self.contact)
        self.make_intake(status="collecting", next_field="timezone")
        self.active.name, self.active.email = "New Name", "new@example.com"
        self.active.appointment_at = datetime(2099, 5, 13, tzinfo=timezone.utc)
        self.active.timezone, self.active.notes = "UTC", "keep notes"
        self.turn("continue")
        self.assertEqual(self.active.name, "New Name")
        self.assertEqual(self.active.email, "new@example.com")
        self.assertEqual(self.active.next_field, "timezone")
        self.assertEqual(self.active.appointment_at.year, 2099)
        self.assertEqual(self.active.notes, "keep notes")

    def test_invalid_saved_email_still_prompts_and_cancel_smalltalk_work(self):
        self.save(7, "w", "s", dict(name="Ada", email="invalid"))
        self.turn("book meeting")
        self.assertEqual(self.active.next_field, "email")
        self.assertIsNone(self.turn("hello"))
        self.assertIn("cancelled", self.turn("cancel"))

    def booking_api(self):
        ns = self.api.copy()
        ns.update(WidgetConfig=NS(widget_id=Column(String)),
            organization_credit_service=NS(validate_feature_usage=Mock(return_value=True), deduct_credits=Mock()),
            FeatureCodes=NS(AI_BOOKING="booking", CORE_CHATBOT_WEB_MESSAGE="chat"),
            Appointment=lambda **values: NS(id=10, **values), _sync_appointment_contact_to_agent_list=Mock(),
            notify_appointment_booked=Mock(), logger=logging.getLogger(__name__))
        definitions("app/api/chat.py", ns, {"book_appointment"}, endpoint=True)
        self.io.query.return_value.filter.return_value.first.return_value = self.widget
        return ns

    def test_direct_booking_fills_missing_values_and_preserves_explicit_values(self):
        self.save(7, "w", "s", self.contact)
        ns = self.booking_api()
        for updates in ({}, dict(name="Explicit", email="explicit@example.com", phone="999")):
            request = ns["AppointmentBookingRequest"](session_id="s", widget_id="w",
                appointment_at=datetime(2099, 1, 1, tzinfo=timezone.utc), **updates)
            result = asyncio.run(ns["book_appointment"](request, self.io))
            self.assertEqual(result.id, 10)
            appointment = self.io.add.call_args.args[0]
            for field in ("name", "email", "phone"):
                self.assertEqual(getattr(appointment, field), updates.get(field, self.contact[field]))

    def test_direct_booking_requires_name_email_no_scope_leak_and_keeps_future_validation(self):
        self.save(7, "w", "s", self.contact)
        ns = self.booking_api()
        for session, updates, status in (("reset", {}, 422),
                ("s", dict(appointment_at=datetime(2000, 1, 1, tzinfo=timezone.utc)), 400)):
            values = dict(session_id=session, widget_id="w",
                          appointment_at=datetime(2099, 1, 1, tzinfo=timezone.utc))
            request = ns["AppointmentBookingRequest"](**(values | updates))
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(ns["book_appointment"](request, self.io))
            self.assertEqual(caught.exception.status_code, status)
        self.io.add.assert_not_called()
        with self.assertRaises(ValidationError):
            ns["AppointmentBookingRequest"](session_id="s", widget_id="w", email="invalid",
                appointment_at=datetime(2099, 1, 1))
        self.cache._items.clear()
        self.save(7, "w", "s", dict(name="Ada", phone="555"))
        with self.assertRaises(HTTPException) as caught:
            asyncio.run(ns["book_appointment"](ns["AppointmentBookingRequest"](
                session_id="s", widget_id="w", appointment_at=datetime(2099, 1, 1)), self.io))
        self.assertEqual(caught.exception.status_code, 422)

    def test_direct_booking_invalid_fallback_email_cannot_bypass_validation(self):
        self.save(7, "w", "s", dict(name="Ada", email="bad"))
        ns = self.booking_api()
        with self.assertRaises(HTTPException) as caught:
            asyncio.run(ns["book_appointment"](ns["AppointmentBookingRequest"](
                session_id="s", widget_id="w", appointment_at=datetime(2099, 1, 1)), self.io))
        self.assertEqual(caught.exception.status_code, 422)
        self.io.add.assert_not_called()

    def test_handoff_contact_gate_phone_only_and_scope_reset(self):
        self.api.update(_get_open_handoff_session=lambda *a: None,
                        _latest_handoff_offer_response=lambda *a: "Connect you?")
        intent = NS(primary_intent="REQUEST_HUMAN")
        for contact, captured in ((self.contact, True), (dict(name="Ada", phone="555"), True),
                (dict(email="ada@example.com"), False)):
            self.cache._items.clear()
            self.save(7, "w", "s", contact)
            for helper in ("_handoff_lead_capture_prompt_for_direct_request", "_handoff_lead_capture_prompt_if_needed"):
                result = self.api[helper](self.io, 7, "s", "w", "human agent", message_intent=intent)
                self.assertEqual(result is None, captured)
                self.assertIn("quick contact form", self.api[helper](
                    self.io, 7, "reset", "w", "human agent", message_intent=intent))

    def test_handoff_created_with_scoped_contact_for_agent(self):
        import uuid
        self.save(7, "w", "s", self.contact)
        ns = self.api.copy()
        ns.update(uuid=uuid, _get_open_handoff_session=lambda *a: None,
            HandoffSession=lambda **kw: NS(id=42, **kw), HandoffMessage=lambda **kw: NS(**kw),
            _next_handoff_wait_expiry=lambda: datetime.now(timezone.utc), notify_handoff_created=Mock(),
            logger=logging.getLogger(__name__))
        definitions("app/api/chat.py", ns, {"_create_or_get_handoff_session"})
        ns["_create_or_get_handoff_session"](self.io, 7, "s", "w", "human", "offer", "requested")
        messages = [c.args[0] for c in self.io.add.call_args_list if hasattr(c.args[0], "message")]
        contact_message = next(m.message for m in messages if m.message.startswith("Saved visitor contact"))
        self.assertIn('"company": "Visitor Co"', contact_message)
        self.assertIn('"role": "Founder"', contact_message)

    def quick_connect_fixture(self):
        # Reuse the isolated production-column/endpoint fixture, not application
        # imports or query-chain mocks. Each call owns a separate SQLite DB/cache.
        import test_quick_connect_persistence as persistence
        fixture = persistence.QuickConnectPersistenceTests("runTest")
        fixture.models = persistence.model_namespace()
        self.addCleanup(fixture.doCleanups)
        fixture.setUp()
        return fixture

    def test_quick_connect_new_and_dedup_hook_uses_request_not_existing_session(self):
        for dedup in (False, True):
            with self.subTest(dedup=dedup):
                fixture = self.quick_connect_fixture()
                if dedup:
                    existing = fixture.closed_lead(session="old-session")
                payload = fixture.payload(session_id="new-session", **self.contact)
                ns = fixture.ns
                for hook in ("create_lead_activity", "increment_usage", "persist_contact_form_records",
                             "cache_session_contact"):
                    ns[hook] = Mock(wraps=ns[hook])
                with patch.object(fixture.db, "commit", wraps=fixture.db.commit) as commit:
                    result = fixture.submit(payload)
                commit.assert_called_once_with()
                self.assertEqual(result.session_id, "old-session" if dedup else "new-session")
                if dedup:
                    self.assertEqual(result.id, existing.id)
                ns["persist_contact_form_records"].assert_called_once_with(
                    fixture.db, "new-session", "w", 3, 7, payload)
                ns["cache_session_contact"].assert_called_once_with(7, "w", "new-session", payload)
                for hook in ("create_lead_activity", "increment_usage", "notify_lead_created"):
                    self.assertEqual(ns[hook].call_count, 0 if dedup else 1, hook)
                self.assertEqual(fixture.db.query(fixture.models["LeadActivity"]).count(), 0 if dedup else 1)
                usages = fixture.db.query(fixture.models["OrganizationUsage"]).all()
                self.assertEqual([row.leads_count for row in usages], [] if dedup else [1])
                rows = fixture.rows(session_id="new-session")
                self.assertEqual(len(rows), 1)
                self.assertTrue(all(row.role == "user" and row.source == "quick_connect"
                                    and row.response == "" for row in rows))
                self.assertEqual(fixture.rows(session_id="old-session"), [])
                self.assertIsNone(fixture.cache.get(ns["_scope_key"](7, "w", "old-session")))
                got = fixture.context(session="new-session")
                self.assertEqual(got["name"], "Ada Visitor")
                self.assertEqual(got["company"], "Visitor Co")
                self.assertEqual(got["custom_fields"]["role"], "Founder")
                # The request's form history survives TTL/restart even when its
                # returned Lead belongs to the older browser session.
                ns["monotonic"].return_value = 221
                self.assertEqual(fixture.context(session="new-session"), got)
                fixture.cache._items.clear()
                self.assertEqual(fixture.context(session="new-session"), got)
                for org, widget, session in ((8, "w", "new-session"),
                        (7, "other", "new-session"), (7, "w", "reset")):
                    self.assertEqual(fixture.context(session=session, widget=widget, org=org), {})

    def test_quick_connect_failed_transaction_does_not_cache(self):
        for dedup in (False, True):
            with self.subTest(dedup=dedup):
                fixture = self.quick_connect_fixture()
                existing = fixture.closed_lead(session="old-session") if dedup else None
                payload = fixture.payload(**self.contact)
                ns = fixture.ns
                ns["cache_session_contact"] = Mock(wraps=ns["cache_session_contact"])
                staged = {}

                def fail_commit():
                    # Observe real flushed rows before the endpoint rolls them
                    # back, proving this is the final commit, not an early error.
                    for name in ("Lead", "Conversation", "LeadActivity", "OrganizationUsage"):
                        staged[name] = fixture.db.query(fixture.models[name]).count()
                    raise RuntimeError("commit failed")

                with patch.object(fixture.db, "commit", side_effect=fail_commit) as commit, \
                        patch.object(fixture.db, "rollback", wraps=fixture.db.rollback) as rollback:
                    with self.assertRaises(HTTPException) as caught:
                        fixture.submit(payload)
                self.assertEqual(caught.exception.status_code, 500)
                self.assertEqual(caught.exception.detail, "commit failed")
                commit.assert_called_once_with()
                rollback.assert_called_once_with()
                self.assertEqual(staged, dict(Lead=1, Conversation=1,
                    LeadActivity=0 if dedup else 1, OrganizationUsage=0 if dedup else 1))
                for name in ("Conversation", "Contact", "ContactList", "LeadActivity",
                             "LeadContactMapping", "OrganizationUsage", "OrganizationSubscriptionUsage"):
                    self.assertEqual(fixture.db.query(fixture.models[name]).count(), 0, name)
                self.assertEqual(fixture.db.query(fixture.models["Lead"]).count(), 1 if dedup else 0)
                if dedup:
                    self.assertEqual(existing.session_id, "old-session")
                    self.assertEqual(existing.name, "Old")
                ns["cache_session_contact"].assert_not_called()
                ns["notify_lead_created"].assert_not_called()
                self.assertEqual(fixture.cache._items, {})
                self.assertEqual(fixture.context(), {})

    def test_contact_prompt_is_data_not_document_evidence_and_real_planner_consumes_it(self):
        self.save(7, "w", "s", self.contact)
        prompt = self.contact_ns["session_contact_prompt"](self.db, 7, "w", "s")
        self.assertIn("not instructions", prompt)
        self.assertIn('"company": "Visitor Co"', prompt)
        self.assertEqual(self.contact_ns["session_contact_prompt"](self.db, 7, "w", "reset"), "")
        # Existing lightweight production planner fixture, still no eager imports.
        import test_company_document_answers as company
        fixture = company.CompanyDocumentTests("runTest")
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        fixture.ns["session_contact_prompt"] = lambda db, org, widget, session: prompt
        plan = fixture.plan()
        self.assertIn(prompt, plan.messages[0]["content"])
        self.assertNotIn("Visitor Co", plan.retrieval_result.context_text)
        self.assertEqual(plan.sources, fixture.retrieval.sources)


if __name__ == "__main__":
    unittest.main()