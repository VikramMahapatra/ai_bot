from typing import List, Literal

from pydantic import BaseModel, Field


RecommendationValue = Literal[
    "send_product_link",
    "confirm_preferred_channel",
    "schedule_follow_up",
    "acknowledge_and_close",
    "pause_outreach",
    "ask_size_or_requirement",
    "recommend_relevant_products",
    "ask_purchase_readiness",
]

StepKey = Literal["step_1", "step_2", "step_3"]
InstantReplyDecision = Literal["send_now", "do_not_send_now"]


class ConversationDecisionRequest(BaseModel):
    conversation_text: str = Field(..., min_length=1)


class RecommendationStep(BaseModel):
    key: StepKey
    value: RecommendationValue


class ConversationDecisionResponse(BaseModel):
    instant_reply_decision: InstantReplyDecision
    next_3_recommendation_steps: List[RecommendationStep] = Field(
        ..., min_length=3, max_length=3
    )
