from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models import Conversation, WidgetConfig, User
from app.schemas import ChatMessage, ChatResponse, ConversationHistoryItem, TranslateRequest, TranslateResponse, SuggestedQuestionsResponse
from app.services import generate_chat_response, should_capture_lead, translate_text, stream_chat_response, persist_conversation, get_suggested_questions
from app.services.limits_service import get_effective_limits
from app.services.limits_service import get_effective_limits, get_or_create_subscription_usage, increment_usage
from app.services.email_service import send_conversation_email
from app.auth import get_current_user, get_current_user_optional
import logging
import json

from app.services.shopify_service import handle_shopify_intent, verify_shopify_customer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class EmailConversationRequest(BaseModel):
    session_id: str
    email: EmailStr
    widget_id: Optional[str] = None


@router.get("/suggested-questions", response_model=SuggestedQuestionsResponse)
async def suggested_questions(
    widget_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    try:
        organization_id = None
        if widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == widget_id
            ).first()
            if widget_config:
                organization_id = widget_config.organization_id
        elif current_user:
            organization_id = current_user.organization_id

        if organization_id is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid widget_id or user not found. Please provide a valid widget_id or authenticate."
            )

        questions = get_suggested_questions(widget_id, organization_id, db)
        return SuggestedQuestionsResponse(questions=questions)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in suggested questions endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ChatResponse)
async def chat(
    message: ChatMessage,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """Chat endpoint with RAG - uses user's knowledge base"""
    try:
        # Get user_id from widget_id or authenticated user
        user_id = None
        if message.widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == message.widget_id
            ).first()
            if widget_config:
                user_id = widget_config.user_id
        elif current_user:
            # If authenticated admin user, use their ID
            user_id = current_user.id
        
        # If no user_id found, return error
        if user_id is None:
            raise HTTPException(
                status_code=400, 
                detail="Invalid widget_id or user not found. Please provide a valid widget_id or authenticate."
            )
           
        use_shopify = False
        if message.customer_id and message.shop_domain:
            is_valid_customer  = await verify_shopify_customer(db, message.shop_domain, int(message.customer_id))
            use_shopify = is_valid_customer
            
        print(f"Shopify customer verified: {use_shopify}")
        
        # Resolve organization for scoping
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found for chat context")

        limits = get_effective_limits(db, user.organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        usage = get_or_create_subscription_usage(db, user.organization_id)
        if not usage:
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        word_count = len(message.message.split())
        if limits.get("max_query_words") and word_count > limits["max_query_words"]:
            raise HTTPException(
                status_code=400,
                detail=f"Query exceeds max word limit of {limits['max_query_words']}",
            )

        if limits.get("monthly_conversation_limit") and usage.conversations_count >= limits["monthly_conversation_limit"]:
            raise HTTPException(
                status_code=403,
                detail="Monthly conversation limit exceeded",
            )

        if limits.get("monthly_token_limit") and usage.tokens_used >= limits["monthly_token_limit"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Monthly token limit exceeded",
                    "tokens_used": usage.tokens_used,
                    "token_limit": limits["monthly_token_limit"],
                },
            )

        # ----------------------
        # Generate Response
        # ----------------------
        if use_shopify:
            # Shopify customer flow
            response_text = await handle_shopify_intent(
                db=db,
                shop_domain=message.shop_domain,
                customer_id=str(message.customer_id),
                user_message=message.message
            )
            return ChatResponse(
                response=response_text,
                session_id=message.session_id
            )
        else:
            # Generate response with organization-scoped knowledge base
            response_text, sources, token_usage = generate_chat_response(
                message.message,
                message.session_id,
                message.widget_id,
                user_id,
                user.organization_id,
                db,
                language_code=message.language_code,
                language_label=message.language_label,
                retrieval_message=message.retrieval_message
            )

            increment_usage(
                db,
                user.organization_id,
                conversations_count=2,
                messages_count=2,
                tokens_used=token_usage.get("total_tokens", 0)
            )
            
            return ChatResponse(
                response=response_text,
                session_id=message.session_id,
                sources=sources
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(
    message: ChatMessage,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    try:
        user_id = None
        if message.widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == message.widget_id
            ).first()
            if widget_config:
                user_id = widget_config.user_id
        elif current_user:
            user_id = current_user.id

        if user_id is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid widget_id or user not found. Please provide a valid widget_id or authenticate."
            )

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found for chat context")

        limits = get_effective_limits(db, user.organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        usage = get_or_create_subscription_usage(db, user.organization_id)
        if not usage:
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")

        word_count = len(message.message.split())
        if limits.get("max_query_words") and word_count > limits["max_query_words"]:
            raise HTTPException(
                status_code=400,
                detail=f"Query exceeds max word limit of {limits['max_query_words']}",
            )

        if limits.get("monthly_conversation_limit") and usage.conversations_count >= limits["monthly_conversation_limit"]:
            raise HTTPException(
                status_code=403,
                detail="Monthly conversation limit exceeded",
            )

        if limits.get("monthly_token_limit") and usage.tokens_used >= limits["monthly_token_limit"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Monthly token limit exceeded",
                    "tokens_used": usage.tokens_used,
                    "token_limit": limits["monthly_token_limit"],
                },
            )

        stream, sources = stream_chat_response(
            message.message,
            message.session_id,
            message.widget_id,
            user_id,
            user.organization_id,
            db,
            language_code=message.language_code,
            language_label=message.language_label,
            retrieval_message=message.retrieval_message
        )

        def event_generator():
            collected_parts = []
            usage_tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            try:
                for chunk in stream:
                    if getattr(chunk, "usage", None):
                        usage = chunk.usage
                        usage_tokens = {
                            "prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
                            "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
                            "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
                        }
                    if not getattr(chunk, "choices", None):
                        continue
                    if not chunk.choices or not getattr(chunk.choices[0], "delta", None):
                        continue
                    delta = getattr(chunk.choices[0].delta, "content", None)
                    if delta:
                        collected_parts.append(delta)
                        yield f"data: {{\"type\": \"token\", \"text\": {json.dumps(delta)} }}\n\n"
            finally:
                full_text = "".join(collected_parts)
                persist_conversation(
                    db,
                    session_id=message.session_id,
                    widget_id=message.widget_id,
                    user_id=user_id,
                    organization_id=user.organization_id,
                    message=message.message,
                    response_text=full_text,
                    token_usage=usage_tokens
                )
                increment_usage(
                    db,
                    user.organization_id,
                    conversations_count=2,
                    messages_count=2,
                    tokens_used=usage_tokens.get("total_tokens", 0)
                )
                yield f"data: {{\"type\": \"done\", \"sources\": {json.dumps(sources)} }}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat stream endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    request: TranslateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    try:
        organization_id = None
        if current_user:
            organization_id = current_user.organization_id
        elif request.widget_id:
            widget_config = db.query(WidgetConfig).filter(
                WidgetConfig.widget_id == request.widget_id
            ).first()
            if widget_config:
                organization_id = widget_config.organization_id

        if organization_id is None:
            raise HTTPException(status_code=400, detail="Invalid widget_id or user not found")

        limits = get_effective_limits(db, organization_id)
        if not limits.get("subscription_active"):
            raise HTTPException(status_code=403, detail="Subscription inactive or expired")
        if not limits.get("multilingual_text_enabled", False):
            raise HTTPException(status_code=403, detail="Multilingual text support is disabled")

        translated = translate_text(
            request.text,
            target_language_code=request.target_language_code,
            target_language_label=request.target_language_label
        )
        return TranslateResponse(translated_text=translated)
    except Exception as e:
        logger.error(f"Error in translate endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}", response_model=List[ConversationHistoryItem])
async def get_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    widget_id: str = None,
):
    """Get conversation history (scoped to user's organization)"""
    query = db.query(Conversation).filter(
        Conversation.session_id == session_id,
        Conversation.organization_id == current_user.organization_id
    )
    if widget_id:
        query = query.filter(Conversation.widget_id == widget_id)
    conversations = query.order_by(Conversation.created_at).all()
    
    return conversations


@router.get("/should-capture-lead/{session_id}")
async def check_lead_capture(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
    widget_id: str = None,
):
    """Check if lead should be captured (scoped to org + widget)"""
    org_id = None
    if widget_id:
        widget_owner = db.query(WidgetConfig).filter(WidgetConfig.widget_id == widget_id).first()
        if widget_owner:
            org_id = widget_owner.organization_id

    if org_id is None and current_user:
        org_id = current_user.organization_id

    if org_id is None:
        return {"should_capture": False}

    should_capture = should_capture_lead(session_id, org_id, widget_id, db)
    return {"should_capture": should_capture}


@router.post("/email-conversation")
async def email_conversation(
    request: EmailConversationRequest,
    db: Session = Depends(get_db)
):
    """Send conversation transcript via email"""
    try:
        # Get conversation history
        query = db.query(Conversation).filter(
            Conversation.session_id == request.session_id
        )
        if request.widget_id:
            query = query.filter(Conversation.widget_id == request.widget_id)
        conversations = query.order_by(Conversation.created_at).all()
        
        if not conversations:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Format conversation data
        conversation_data = []
        for conv in conversations:
            if conv.role == "user":
                if conv.message:
                    conversation_data.append({
                        "role": "user",
                        "content": conv.message
                    })
                if conv.response:
                    conversation_data.append({
                        "role": "assistant",
                        "content": conv.response
                    })
            else:
                content = conv.response or conv.message
                if content:
                    conversation_data.append({
                        "role": conv.role,
                        "content": content
                    })
        
        # Send email
        success = send_conversation_email(request.email, conversation_data)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send email")
        
        return {"message": "Email sent successfully", "email": request.email}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending conversation email: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
