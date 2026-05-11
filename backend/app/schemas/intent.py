from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class IntentType(str, Enum):
    GENERAL_CHAT = "general_chat"
    BOOK_APPOINTMENT = "book_appointment"
    RESCHEDULE_APPOINTMENT = "reschedule_appointment"
    CANCEL_APPOINTMENT = "cancel_appointment"
    REQUEST_HUMAN = "request_human"
    CONFIRM = "confirm"
    DENY = "deny"
    PROVIDE_NAME = "provide_name"
    PROVIDE_EMAIL = "provide_email"
    PROVIDE_PHONE = "provide_phone"
    PROVIDE_DATETIME = "provide_datetime"
    PROVIDE_TIMEZONE = "provide_timezone"
    SMALL_TALK = "small_talk"
    WAIT_MORE = "wait_more"
    OUT_OF_SCOPE = "out_of_scope"


class IntentDetectionResult(BaseModel):
    primary_intent: IntentType
    confidence: float = Field(ge=0.0, le=1.0)
    entities: Dict[str, Any] = Field(default_factory=dict)
    reasoning: Optional[str] = None


class ConversationActionType(str, Enum):
    CONTINUE_CONVERSATION = "continue_conversation"
    START_APPOINTMENT_FLOW = "start_appointment_flow"
    START_HANDOFF_FLOW = "start_handoff_flow"
    CAPTURE_LEAD = "capture_lead"
    ACKNOWLEDGE_SMALL_TALK = "acknowledge_small_talk"
    NOOP = "noop"


class ConversationActionResult(BaseModel):
    action: ConversationActionType
    confidence: float = Field(ge=0.0, le=1.0)
    intent: IntentDetectionResult
    reasoning: Optional[str] = None
