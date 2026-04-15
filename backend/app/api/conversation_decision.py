from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.schemas.conversation_decision import (
    ConversationDecisionRequest,
    ConversationDecisionResponse,
)
from app.services.conversation_decision_service import analyze_conversation


router = APIRouter(
    prefix="/api/conversation-decision",
    tags=["conversation-decision"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/analyze", response_model=ConversationDecisionResponse)
def analyze_conversation_for_actions(payload: ConversationDecisionRequest):
    return analyze_conversation(payload.conversation_text)
