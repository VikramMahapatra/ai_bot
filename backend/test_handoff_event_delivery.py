"""Execute production endpoints/SSE iterators without app startup or live DB IO.

AST loading changes only decorators/default dependency expressions. Function
bodies (including nested streaming generators) and the hub are production code.
An independent in-memory ORM schema keeps eager app imports/migrations out.
"""
import ast
import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
import re
import threading
from types import SimpleNamespace as NS
from typing import Dict, List, Optional
import unittest
from unittest.mock import AsyncMock, Mock
import uuid

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import Session, declarative_base
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import TypeDecorator


ROOT = Path(__file__).parent


def load(path, namespace, names):
    tree = ast.parse((ROOT / path).read_text(encoding="utf-8"))
    nodes = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name in names:
            node.decorator_list = []
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                node.args.defaults = [ast.Constant(None) for _ in node.args.defaults]
            nodes.append(node)
    future = ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)
    namespace.setdefault("__name__", __name__)
    exec(compile(ast.fix_missing_locations(ast.Module(body=[future, *nodes], type_ignores=[])),
                 str(ROOT / path), "exec"), namespace)
    return namespace


class UTCDateTime(TypeDecorator):
    impl = DateTime
    cache_ok = True

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value is not None else None


Base = declarative_base()


class Widget(Base):
    __tablename__ = "widgets"
    id = Column(Integer, primary_key=True)
    widget_id = Column(String)
    user_id = Column(Integer)
    organization_id = Column(Integer)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer)
    username = Column(String)
    role = Column(String)


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer)
    session_id = Column(String)
    widget_id = Column(String)
    response = Column(Text)
    created_at = Column(UTCDateTime, default=lambda: datetime.now(timezone.utc))


class HandoffSession(Base):
    __tablename__ = "handoffs"
    id = Column(Integer, primary_key=True)
    chat_id = Column(String, unique=True)
    session_id = Column(String)
    widget_id = Column(String)
    organization_id = Column(Integer)
    status = Column(String, default="waiting_for_agent")
    assigned_agent_id = Column(Integer)
    handoff_reason = Column(Text)
    bot_suggested_answer = Column(Text)
    wait_cycle = Column(Integer, default=1)
    waiting_expires_at = Column(UTCDateTime)
    waiting_timeout_notified = Column(Boolean, default=False)
    call_room_id = Column(String)
    call_status = Column(String, default="none")
    call_mode = Column(String, default="video")
    call_requested_at = Column(UTCDateTime)
    call_started_at = Column(UTCDateTime)
    call_ended_at = Column(UTCDateTime)
    created_at = Column(UTCDateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(UTCDateTime)
    closed_at = Column(UTCDateTime)


class HandoffMessage(Base):
    __tablename__ = "handoff_messages"
    id = Column(Integer, primary_key=True)
    handoff_session_id = Column(Integer)
    sender_type = Column(String)
    sender_user_id = Column(Integer)
    message = Column(Text)
    created_at = Column(UTCDateTime, default=lambda: datetime.now(timezone.utc))


class Socket:
    def __init__(self, broken=False):
        self.events = []
        self.broken = broken

    async def accept(self):
        pass

    async def send_json(self, payload):
        if self.broken:
            raise RuntimeError("Disconnected admin")
        self.events.append(dict(payload))


class HandoffDeliveryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_engine("sqlite://", poolclass=StaticPool,
                                    connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.user = User(id=3, organization_id=7, username="operator", role="admin")
        self.db.add_all([self.user, User(id=4, organization_id=8, username="other", role="admin"),
                         Widget(widget_id="w", user_id=3, organization_id=7),
                         Widget(widget_id="other", user_id=4, organization_id=8)])
        self.db.commit()
        hub_ns = load("app/services/handoff_hub.py", dict(asyncio=asyncio, defaultdict=defaultdict), {"HandoffHub"})
        self.hub = hub_ns["HandoffHub"]()
        self.admin, self.other_admin, self.broken = Socket(), Socket(), Socket(broken=True)
        await self.hub.connect(7, self.admin)
        await self.hub.connect(8, self.other_admin)
        await self.hub.connect(7, self.broken)
        self.loop = asyncio.get_running_loop()
        self.broadcasts = []
        real_broadcast = self.hub.broadcast

        async def record(org, event):
            self.assertIs(asyncio.get_running_loop(), self.loop)
            self.broadcasts.append((org, dict(event)))
            await real_broadcast(org, event)

        self.hub.broadcast = record
        self.enabled = True
        self.contact = True
        self.classification = NS(primary_intent="GENERAL_QUESTION", entities={})
        self.worker_threads = []

        def persist(*args, **kwargs):
            self.worker_threads.append(threading.get_ident())

        self.persist = Mock(side_effect=persist)
        intents = {name: name for name in ("REQUEST_HUMAN", "CONFIRM", "BOOK_APPOINTMENT",
            "RESCHEDULE_APPOINTMENT", "PROVIDE_DATETIME", "PROVIDE_TIMEZONE", "WAIT_MORE")}
        self.ns = dict(datetime=datetime, timedelta=timedelta, timezone=timezone,
            uuid=uuid, re=re, json=json, asyncio=asyncio, HTTPException=HTTPException,
            StreamingResponse=StreamingResponse, BaseModel=BaseModel,
            Dict=Dict, List=List, Optional=Optional,
            WidgetConfig=Widget, User=User, Conversation=Conversation,
            HandoffSession=HandoffSession, HandoffMessage=HandoffMessage,
            IntentType=NS(**intents), handoff_hub=self.hub, logger=logging.getLogger(__name__),
            settings=NS(HUMAN_HANDOFF_WAITING_MESSAGE="I am connecting you to a human expert.",
                HUMAN_HANDOFF_BUSY_MESSAGE="Agents are busy.", HUMAN_HANDOFF_WAIT_TIMEOUT_SECONDS=120,
                HUMAN_HANDOFF_MAX_WAIT_CYCLES=2, HUMAN_HANDOFF_FINAL_TIMEOUT_MESSAGE="Agents are still busy."),
            get_org_settings=Mock(return_value={}),
            get_effective_limits=lambda *a: dict(subscription_active=True, human_handoff_enabled=self.enabled),
            get_or_create_subscription_usage=Mock(return_value=None),
            get_or_create_usage=Mock(return_value=NS(conversations_count=0)),
            _ensure_chat_credits_available=Mock(), _get_monthly_session_count=Mock(return_value=0),
            _get_active_intake=Mock(return_value=None), _get_previous_assistant_message=Mock(return_value=None),
            _build_intent_context=Mock(return_value={}),
            _resolve_message_intent=AsyncMock(side_effect=lambda **kw: self.classification),
            _has_captured_lead_for_session=lambda *a: self.contact,
            get_session_contact=Mock(return_value={}), notify_handoff_created=Mock(),
            persist_conversation=self.persist, increment_usage=Mock(),
            _last_response_was_escalation=Mock(return_value=False),
            _handle_appointment_intake_flow=AsyncMock(return_value=None),
            generate_chat_response=Mock(return_value=("Ordinary answer", [], {"answer_mode": "dataset"})),
            stream_chat_response=Mock(return_value=(None, [], "Ordinary answer", {"answer_mode": "dataset"})),
            append_appointment_cta_if_needed=lambda text, *a: text)
        load("app/schemas/chat.py", self.ns, {"ChatMessage", "ChatResponse", "SourceInfo"})
        for name in ("SourceInfo", "ChatMessage", "ChatResponse"):
            self.ns[name].model_rebuild(_types_namespace=self.ns)
        load("app/api/chat.py", self.ns, {"chat", "chat_stream", "_get_open_handoff_session",
            "_normalize_handoff_text", "_is_direct_live_agent_request", "_is_handoff_opt_in",
            "_response_offers_handoff", "_latest_handoff_offer_response",
            "_handoff_lead_capture_prompt_for_direct_request", "_create_direct_handoff_request",
            "_handoff_lead_capture_prompt_if_needed", "_create_handoff_after_user_confirmation",
            "_create_or_get_handoff_session", "_add_response_only_handoff_message",
            "_route_user_message_to_handoff_if_active",
            "_handoff_wait_timeout_seconds", "_handoff_max_wait_cycles", "_next_handoff_wait_expiry",
            "_final_handoff_timeout_message", "_close_handoff_to_bot_after_timeout",
            "_emit_handoff_timeout_prompt_if_needed", "_disabled_handoff_response",
            "get_handoff_session_status", "get_handoff_messages"})
        self.admin_ns = dict(self.ns, UserRole=NS(ADMIN="admin", USER_HANDOFF="handoff"))
        load("app/api/handoff.py", self.admin_ns, {"accept_handoff_request", "_get_session_for_org",
                                                 "_assert_session_access", "_serialize_session"})

    def message(self, text="can i have a live chat with human"):
        return self.ns["ChatMessage"](message=text, session_id="s", widget_id="w")

    async def stream(self, text="can i have a live chat with human"):
        response = await self.ns["chat_stream"](self.message(text), self.db, None)
        # StreamingResponse wraps its real sync iterator in iterate_in_threadpool.
        frames = [json.loads(frame.removeprefix("data: ").strip())
                  async for frame in response.body_iterator]
        self.assertEqual(frames[0]["type"], "ready")
        self.assertEqual(frames[-1]["type"], "done")
        self.assertEqual(sum(frame["type"] == "done" for frame in frames), 1)
        return frames

    def seed(self, status="waiting_for_agent", **kwargs):
        row = HandoffSession(chat_id="chat", session_id="s", widget_id="w", organization_id=7,
            status=status, waiting_expires_at=datetime.now(timezone.utc) + timedelta(minutes=2), **kwargs)
        self.db.add(row)
        self.db.commit()
        return row

    async def assert_parity(self, frames, text="can i have a live chat with human"):
        result = await self.ns["chat"](self.message(text), self.db, None)
        for key in ("handoff_chat_id", "handoff_status", "ui_action"):
            self.assertEqual(getattr(result, key), frames[-1].get(key))
        return result

    async def test_direct_generic_intent_stream_done_broadcast_and_post_parity(self):
        frames = await self.stream()
        self.assertEqual(frames[-1]["ui_action"], "open_human_handoff")
        self.assertEqual(frames[-1]["handoff_status"], "waiting_for_agent")
        self.assertEqual(self.admin.events[0]["type"], "handoff_request_created")
        self.assertEqual(self.admin.events[0]["chat_id"], frames[-1]["handoff_chat_id"])
        self.assertEqual(self.other_admin.events, [])
        self.assertNotIn(self.broken, self.hub._org_clients[7])
        self.assertNotEqual(self.worker_threads[0], threading.get_ident())
        await self.assert_parity(frames)

    async def test_direct_generic_without_contact_returns_form_not_fake_status(self):
        self.contact = False
        frames = await self.stream()
        self.assertEqual(frames[-1]["ui_action"], "open_lead_form")
        self.assertNotIn("handoff_chat_id", frames[-1])
        self.assertEqual(self.db.query(HandoffSession).count(), 0)
        self.assertEqual(self.broadcasts, [])
        await self.assert_parity(frames)

    async def test_post_direct_generic_creates_real_handoff_then_stream_matches(self):
        result = await self.ns["chat"](self.message(), self.db, None)
        row = self.db.query(HandoffSession).one()
        self.assertEqual(result.handoff_chat_id, row.chat_id)
        self.assertEqual(result.handoff_status, row.status)
        self.assertEqual(result.ui_action, "open_human_handoff")
        self.assertEqual(self.admin.events[-1]["type"], "handoff_request_created")
        frames = await self.stream()
        self.assertEqual(frames[-1]["handoff_status"], result.handoff_status)
        self.assertEqual(frames[-1]["handoff_chat_id"], result.handoff_chat_id)

    async def test_generic_non_handoff_chat_remains_ordinary_on_post_and_stream(self):
        frames = await self.stream("What products do you sell?")
        result = await self.assert_parity(frames, "What products do you sell?")
        self.assertEqual(result.response, "Ordinary answer")
        self.assertEqual(frames[-1], {"type": "done", "sources": []})
        self.assertEqual(self.db.query(HandoffSession).count(), 0)
        self.assertEqual(self.broadcasts, [])

    async def test_waiting_and_assigned_active_streams_deliver_done_and_matching_metadata(self):
        row = self.seed()
        frames = await self.stream("hello again")
        self.assertEqual(self.admin.events[-1]["type"], "handoff_user_message")
        await self.assert_parity(frames, "hello again")
        row.status, row.assigned_agent_id = "assigned", 3
        self.db.commit()
        frames = await self.stream("are you there")
        self.assertEqual([frame["type"] for frame in frames], ["ready", "done"])
        self.assertEqual(frames[-1]["ui_action"], "open_human_handoff")
        self.assertEqual(frames[-1]["handoff_status"], "assigned")
        result = await self.assert_parity(frames, "are you there")
        self.assertEqual(result.response, "")
        self.assertEqual(self.other_admin.events, [])

    async def test_confirmed_offer_stream_delivers_creation_event_and_done(self):
        self.classification = NS(primary_intent="CONFIRM", entities={})
        self.db.add(Conversation(session_id="s", widget_id="w", organization_id=7,
                                 response="Would you like me to connect you?"))
        self.db.commit()
        frames = await self.stream("yes")
        self.assertEqual(frames[-1]["handoff_status"], "waiting_for_agent")
        self.assertEqual(self.admin.events[-1]["type"], "handoff_request_created")
        await self.assert_parity(frames, "yes")

    async def test_disabled_direct_request_never_promises_transfer_or_sets_handoff_metadata(self):
        self.enabled = False
        self.seed()  # Even a historical open row must not activate disabled routing.
        frames = await self.stream()
        self.assertIn("not available", frames[1]["text"])
        self.assertNotIn("connecting", frames[1]["text"])
        self.assertEqual(frames[-1], {"type": "done", "sources": []})
        self.assertEqual(self.broadcasts, [])
        self.ns["stream_chat_response"].assert_not_called()
        result = await self.assert_parity(frames)
        self.assertEqual(result.response, frames[1]["text"])
        self.ns["generate_chat_response"].assert_not_called()

    async def test_admin_accept_commits_assigned_tenant_event_and_both_visitor_poll_endpoints(self):
        row = self.seed()
        result = await self.admin_ns["accept_handoff_request"]("chat", self.db, self.user)
        self.assertEqual(result["status"], "assigned")
        self.assertEqual(result["assigned_agent_id"], 3)
        self.assertEqual(self.admin.events[-1], dict(type="handoff_assigned", chat_id="chat",
            widget_id="w", session_id="s", assigned_agent_id=3, status="assigned"))
        self.assertEqual(self.other_admin.events, [])
        # Separate reader sees committed DB state, not the writer identity map.
        with Session(self.engine) as reader:
            status = await self.ns["get_handoff_session_status"]("s", "w", "chat", reader, None)
            messages = await self.ns["get_handoff_messages"]("chat", "s", "w", 0, reader, None)
        self.assertTrue(status["active"])
        for data in (status, messages):
            self.assertEqual(data["status"], "assigned")
            self.assertEqual(data["assigned_agent_id"], 3)
        count = self.db.query(HandoffMessage).count()
        await self.admin_ns["accept_handoff_request"]("chat", self.db, self.user)
        self.assertEqual(self.db.query(HandoffMessage).count(), count)
        self.assertEqual(len(self.broadcasts), 1)
        frames = await self.stream("hello human")
        self.assertEqual(frames[-1]["handoff_status"], row.status)

    async def test_cross_tenant_admin_accept_and_visitor_polling_cannot_access_session(self):
        self.seed()
        other = self.db.get(User, 4)
        with self.assertRaises(HTTPException) as error:
            await self.admin_ns["accept_handoff_request"]("chat", self.db, other)
        self.assertEqual(error.exception.status_code, 404)
        status = await self.ns["get_handoff_session_status"]("s", "other", "chat", self.db, None)
        messages = await self.ns["get_handoff_messages"]("chat", "s", "other", 0, self.db, None)
        self.assertIsNone(status["status"])
        self.assertIsNone(messages["status"])
        self.assertEqual(messages["items"], [])
        for session, widget in (("wrong", "w"), ("s", "other")):
            data = await self.ns["get_handoff_messages"]("chat", session, widget, 0, self.db, None)
            self.assertIsNone(data["status"])
        with self.assertRaises(HTTPException) as error:
            await self.ns["get_handoff_session_status"]("s", "w", "chat", self.db, other)
        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(self.broadcasts, [])

    async def test_timeout_metadata_is_bot_active_not_open_handoff(self):
        row = self.seed(wait_cycle=2)
        row.waiting_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.db.commit()
        frames = await self.stream("still here")
        self.assertEqual(frames[-1]["handoff_status"], "bot_active")
        self.assertNotIn("ui_action", frames[-1])
        self.assertEqual(self.admin.events[-1]["status"], "bot_active")

    async def test_notification_is_delivered_before_visitor_consumes_stream(self):
        response = await self.ns["chat_stream"](self.message(), self.db, None)
        self.assertEqual(self.admin.events[-1]["type"], "handoff_request_created")
        self.assertEqual(self.other_admin.events, [])
        await response.body_iterator.aclose()

    async def test_negated_human_request_does_not_trigger_direct_handoff(self):
        for text in ("don't connect me to a human", "do not chat with a human", "no need to talk to agent"):
            self.assertFalse(self.ns["_is_direct_live_agent_request"](text))
            self.assertIsNone(self.ns["_create_direct_handoff_request"](
                self.db, 7, "s", "w", text, self.classification))

    async def poll(self, row, after_id=0):
        # Use a separate reader to verify committed delivery audits and state.
        with Session(self.engine) as reader:
            return await self.ns["get_handoff_messages"](
                row.chat_id, row.session_id, row.widget_id, after_id, reader, None)

    def transcript(self, row, sender=None):
        query = self.db.query(HandoffMessage).filter(
            HandoffMessage.handoff_session_id == row.id)
        if sender:
            query = query.filter(HandoffMessage.sender_type == sender)
        return query.order_by(HandoffMessage.id).all()

    async def test_direct_creation_has_no_internal_bot_reason_and_no_poll_replay(self):
        frames = await self.stream()
        row = self.db.query(HandoffSession).one()
        waiting = self.ns["settings"].HUMAN_HANDOFF_WAITING_MESSAGE
        self.assertEqual([f["text"] for f in frames if f["type"] == "token"], [waiting])
        self.assertIsNone(row.bot_suggested_answer)
        self.assertEqual(row.handoff_reason, "user_requested_live_agent_directly")
        self.assertEqual([m.message for m in self.transcript(row, "bot")], [waiting])
        self.assertTrue(any(row.handoff_reason in m.message
                            for m in self.transcript(row, "system")))
        polled = await self.poll(row)
        self.assertEqual(polled["chat_id"], frames[-1]["handoff_chat_id"])
        self.assertEqual(polled["status"], frames[-1]["handoff_status"])
        self.assertEqual(polled["wait_cycle"], 1)
        self.assertTrue(polled["waiting_expires_at"])
        self.assertEqual([m["sender_type"] for m in polled["items"]], ["user"])
        self.assertNotIn("User requested a live agent directly.",
                         [m.message for m in self.transcript(row)])

    async def test_repeated_waiting_requests_are_silent_but_keep_genuine_user_turns(self):
        await self.stream()
        row = self.db.query(HandoffSession).one()
        for text in (self.message().message, self.message().message, "hello", "hello"):
            frames = await self.stream(text)
            self.assertEqual([f["type"] for f in frames], ["ready", "done"])
            self.assertEqual(frames[-1]["handoff_status"], "waiting_for_agent")
            self.assertEqual(frames[-1]["ui_action"], "open_human_handoff")
            self.assertEqual(self.persist.call_args.kwargs["response_text"], "")
        result = await self.ns["chat"](self.message(), self.db, None)
        self.assertEqual(result.response, "")
        self.assertEqual(result.handoff_chat_id, row.chat_id)
        self.assertEqual(len(self.transcript(row, "user")), 6)
        self.assertEqual(len(self.transcript(row, "bot")), 1)
        self.assertEqual(self.db.query(HandoffSession).count(), 1)
        self.ns["notify_handoff_created"].assert_called_once()
        self.assertEqual(sum(e["type"] == "handoff_request_created"
                             for _, e in self.broadcasts), 1)

    async def test_creation_helpers_replay_does_not_append_initial_messages(self):
        create = self.ns["_create_direct_handoff_request"]
        row = create(self.db, 7, "s", "w", self.message().message, self.classification)
        initial_ids = [m.id for m in self.transcript(row)]
        for _ in range(3):
            self.assertIsNone(create(self.db, 7, "s", "w", self.message().message,
                                     self.classification))
            same = self.ns["_create_or_get_handoff_session"](
                self.db, 7, "s", "w", "replayed", "replayed answer", "replayed reason")
            self.assertEqual(same.id, row.id)
        # Simulate the wrapper's first check missing an existing row, while the
        # central create-or-get guard sees it. No wrapper-owned bot insertion.
        real_get = self.ns["_get_open_handoff_session"]
        self.ns["_get_open_handoff_session"] = Mock(side_effect=[None, row])
        try:
            self.assertEqual(create(self.db, 7, "s", "w", self.message().message,
                                    self.classification).id, row.id)
        finally:
            self.ns["_get_open_handoff_session"] = real_get
        self.assertEqual([m.id for m in self.transcript(row)], initial_ids)
        self.ns["notify_handoff_created"].assert_called_once()
        self.assertEqual(self.db.query(HandoffSession).count(), 1)
        # Scope includes organization and widget, not just visitor session ID.
        other = self.ns["_create_or_get_handoff_session"](
            self.db, 8, "s", "other", "other visitor", "", "user_requested_live_agent_directly")
        self.assertNotEqual(other.id, row.id)
        self.assertEqual(len(self.transcript(other, "bot")), 1)

    async def test_confirmed_creation_keeps_offer_for_admin_without_visitor_replay(self):
        offer = "Would you like me to connect you?"
        self.classification = NS(primary_intent="CONFIRM", entities={})
        self.db.add(Conversation(session_id="s", widget_id="w", organization_id=7,
                                 response=offer))
        self.db.commit()
        frames = await self.stream("yes")
        row = self.db.query(HandoffSession).one()
        self.assertEqual(row.bot_suggested_answer, offer)
        self.assertEqual([m.message for m in self.transcript(row, "bot")],
                         [offer, self.ns["settings"].HUMAN_HANDOFF_WAITING_MESSAGE])
        count = len(self.transcript(row))
        self.assertIsNone(self.ns["_create_handoff_after_user_confirmation"](
            self.db, 7, "s", "w", "yes", self.classification))
        self.assertEqual(len(self.transcript(row)), count)
        self.assertEqual((await self.poll(row))["status"], frames[-1]["handoff_status"])
        self.assertFalse(any(m["sender_type"] == "bot" for m in (await self.poll(row))["items"]))

    async def test_request_busy_transition_response_only_then_followups_silent(self):
        row = self.seed(wait_cycle=1)
        row.waiting_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.db.commit()
        frames = await self.stream("still here")
        busy = self.ns["settings"].HUMAN_HANDOFF_BUSY_MESSAGE
        self.assertEqual([f["text"] for f in frames if f["type"] == "token"], [busy])
        self.assertEqual([m.message for m in self.transcript(row, "bot")], [busy])
        polled = await self.poll(row)
        self.assertEqual(polled["status"], frames[-1]["handoff_status"])
        self.assertEqual(polled["wait_cycle"], 2)
        self.assertTrue(polled["waiting_timeout_notified"])
        self.assertFalse(any(m["sender_type"] == "bot" for m in polled["items"]))
        frames = await self.stream("still here")
        self.assertEqual([f["type"] for f in frames], ["ready", "done"])
        result = await self.ns["chat"](self.message("another question"), self.db, None)
        self.assertEqual(result.response, "")
        self.assertEqual(len(self.transcript(row, "bot")), 1)

    async def test_post_final_timeout_and_booking_prompts_do_not_replay_in_poll(self):
        for intent, text, expected_ui in (
            ("GENERAL_QUESTION", "still here", None),
            ("BOOK_APPOINTMENT", "book a meeting", "open_appointment_form"),
        ):
            with self.subTest(intent=intent):
                self.db.query(HandoffMessage).delete()
                self.db.query(HandoffSession).delete()
                self.db.commit()
                row = self.seed(wait_cycle=2)
                row.waiting_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
                self.db.commit()
                self.classification = NS(primary_intent=intent, entities={})
                result = await self.ns["chat"](self.message(text), self.db, None)
                self.assertEqual(result.handoff_status, "bot_active")
                self.assertEqual(result.ui_action, expected_ui)
                self.assertIn("meeting", result.response)
                self.assertEqual([m.message for m in self.transcript(row, "bot")], [result.response])
                polled = await self.poll(row)
                self.assertEqual(polled["status"], result.handoff_status)
                self.assertFalse(any(m["sender_type"] == "bot" for m in polled["items"]))

    async def test_sse_final_timeout_reply_retained_for_admin_not_polling(self):
        row = self.seed(wait_cycle=2)
        row.waiting_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.db.commit()
        frames = await self.stream("still here")
        texts = [f["text"] for f in frames if f["type"] == "token"]
        self.assertEqual(texts, [self.ns["_final_handoff_timeout_message"]()])
        self.assertEqual([m.message for m in self.transcript(row, "bot")], texts)
        polled = await self.poll(row)
        status = await self.ns["get_handoff_session_status"]("s", "w", row.chat_id, self.db, None)
        self.assertFalse(status["active"])
        self.assertEqual(polled["status"], frames[-1]["handoff_status"])
        self.assertEqual(polled["status"], status["status"])
        self.assertFalse(any(m["sender_type"] == "bot" for m in polled["items"]))

    async def test_poll_triggered_timeouts_deliver_once_per_cursor_and_remain_silent_on_chat(self):
        row = self.seed(wait_cycle=1)
        row.waiting_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.db.commit()
        await self.ns["get_handoff_session_status"]("s", "w", row.chat_id, self.db, None)
        first = await self.poll(row)
        self.assertEqual([m["message"] for m in first["items"]],
                         [self.ns["settings"].HUMAN_HANDOFF_BUSY_MESSAGE])
        cursor = first["items"][-1]["id"]
        self.assertEqual((await self.poll(row, cursor))["items"], [])
        frames = await self.stream("still here")
        self.assertEqual([f["type"] for f in frames], ["ready", "done"])
        row.waiting_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.db.commit()
        final = await self.poll(row, cursor)
        self.assertEqual(final["status"], "bot_active")
        self.assertEqual([m["message"] for m in final["items"] if m["sender_type"] == "bot"],
                         [self.ns["_final_handoff_timeout_message"]()])
        self.assertEqual(len(self.transcript(row, "bot")), 2)
        self.assertEqual((await self.poll(row, final["items"][-1]["id"]))["items"], [])

    async def test_wait_more_cycle_change_reply_uses_response_only(self):
        row = self.seed(wait_cycle=1, waiting_timeout_notified=True)
        self.classification = NS(primary_intent="WAIT_MORE", entities={})
        frames = await self.stream("I will wait more")
        texts = [f["text"] for f in frames if f["type"] == "token"]
        self.assertEqual(len(texts), 1)
        self.assertIn("Thanks for waiting", texts[0])
        polled = await self.poll(row)
        self.assertEqual(polled["status"], frames[-1]["handoff_status"])
        self.assertEqual(polled["wait_cycle"], 2)
        self.assertFalse(polled["waiting_timeout_notified"])
        self.assertEqual([m.message for m in self.transcript(row, "bot")], texts)
        self.assertFalse(any(m["sender_type"] == "bot" for m in polled["items"]))
        frames = await self.stream("thank you")
        self.assertEqual([f["type"] for f in frames], ["ready", "done"])
        self.assertEqual(len(self.transcript(row, "bot")), 1)

    async def test_sse_booking_after_busy_keeps_form_and_reply_without_poll_replay(self):
        row = self.seed(wait_cycle=2, waiting_timeout_notified=True)
        self.classification = NS(primary_intent="BOOK_APPOINTMENT", entities={})
        frames = await self.stream("book a meeting instead")
        texts = [f["text"] for f in frames if f["type"] == "token"]
        self.assertEqual(len(texts), 1)
        self.assertIn("fill this short form", texts[0])
        self.assertEqual(frames[-1]["ui_action"], "open_appointment_form")
        self.assertEqual(frames[-1]["handoff_status"], "bot_active")
        self.assertEqual([m.message for m in self.transcript(row, "bot")], texts)
        polled = await self.poll(row)
        self.assertEqual(polled["status"], frames[-1]["handoff_status"])
        self.assertFalse(any(m["sender_type"] == "bot" for m in polled["items"]))

    async def test_poll_filter_is_message_id_scoped_not_text_or_cursor_scoped(self):
        row = self.seed()
        self.ns["_add_response_only_handoff_message"](self.db, row, "Same wording")
        self.db.commit()
        suppressed = self.transcript(row, "bot")[0]
        self.db.add(HandoffMessage(handoff_session_id=row.id, sender_type="bot",
                                   message="Same wording"))
        self.db.add(HandoffMessage(handoff_session_id=row.id, sender_type="agent",
                                   sender_user_id=3, message="Agent reply"))
        self.db.commit()
        # A cursor between bot and audit must not cause the bot to reappear.
        for cursor in (0, suppressed.id - 1, suppressed.id):
            items = (await self.poll(row, cursor))["items"]
            self.assertEqual([m["message"] for m in items], ["Same wording", "Agent reply"])
            self.assertNotIn(suppressed.id, [m["id"] for m in items])


if __name__ == "__main__":
    unittest.main()