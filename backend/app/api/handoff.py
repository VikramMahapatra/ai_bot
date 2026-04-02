from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import decode_access_token, require_handoff_operator
from app.database import SessionLocal, get_db
from app.models import HandoffMessage, HandoffSession, User, HandoffAgentAssignment
from app.models.user import UserRole
from app.services.handoff_hub import handoff_hub


router = APIRouter(prefix="/api/admin/handoff", tags=["handoff"])


class AgentReplyRequest(BaseModel):
    message: str
class HandoffCallModeRequest(BaseModel):
    mode: str


def _serialize_session(session: HandoffSession) -> dict:
    return {
        "id": session.id,
        "chat_id": session.chat_id,
        "session_id": session.session_id,
        "widget_id": session.widget_id,
        "organization_id": session.organization_id,
        "status": session.status,
        "assigned_agent_id": session.assigned_agent_id,
        "handoff_reason": session.handoff_reason,
        "bot_suggested_answer": session.bot_suggested_answer,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "closed_at": session.closed_at,
        "call_room_id": session.call_room_id,
        "call_status": session.call_status,
        "call_mode": session.call_mode,
        "call_requested_at": session.call_requested_at,
        "call_started_at": session.call_started_at,
        "call_ended_at": session.call_ended_at,
    }


def _serialize_message(message: HandoffMessage) -> dict:
    return {
        "id": message.id,
        "handoff_session_id": message.handoff_session_id,
        "sender_type": message.sender_type,
        "sender_user_id": message.sender_user_id,
        "message": message.message,
        "created_at": message.created_at,
    }


def _get_session_for_org(db: Session, chat_id: str, organization_id: int) -> HandoffSession:
    session = db.query(HandoffSession).filter(
        HandoffSession.chat_id == chat_id,
        HandoffSession.organization_id == organization_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Handoff session not found")
    return session


def _assert_session_access(db: Session, current_user: User, session: HandoffSession) -> None:
    if current_user.role == UserRole.ADMIN:
        return

    allowed = db.query(HandoffAgentAssignment.id).filter(
        HandoffAgentAssignment.user_id == current_user.id,
        HandoffAgentAssignment.widget_id == session.widget_id,
    ).first()
    if not allowed:
        raise HTTPException(status_code=403, detail="You are not assigned to this agent/widget")


@router.get("/requests")
async def list_handoff_requests(
    status: Optional[str] = Query(default=None),
    widget_id: Optional[str] = Query(default=None),
    mine_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    query = db.query(HandoffSession).filter(HandoffSession.organization_id == current_user.organization_id)

    if current_user.role == UserRole.USER_HANDOFF:
        assigned_rows = db.query(HandoffAgentAssignment.widget_id).filter(
            HandoffAgentAssignment.user_id == current_user.id
        ).all()
        assigned_widget_ids = [row[0] for row in assigned_rows]
        if not assigned_widget_ids:
            return {"items": []}
        query = query.filter(HandoffSession.widget_id.in_(assigned_widget_ids))

    if status:
        query = query.filter(HandoffSession.status == status)
    else:
        query = query.filter(HandoffSession.status.in_(["waiting_for_agent", "assigned"]))

    if widget_id:
        query = query.filter(HandoffSession.widget_id == widget_id)

    if mine_only:
        query = query.filter(HandoffSession.assigned_agent_id == current_user.id)

    rows = query.order_by(HandoffSession.updated_at.desc().nullslast(), HandoffSession.created_at.desc()).all()
    return {"items": [_serialize_session(row) for row in rows]}


@router.get("/{chat_id}/messages")
async def list_handoff_messages(
    chat_id: str,
    after_id: int = Query(default=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    session = _get_session_for_org(db, chat_id, current_user.organization_id)
    _assert_session_access(db, current_user, session)
    rows = db.query(HandoffMessage).filter(
        HandoffMessage.handoff_session_id == session.id,
        HandoffMessage.id > max(0, int(after_id or 0)),
    ).order_by(HandoffMessage.id.asc()).all()

    return {
        "chat_id": session.chat_id,
        "status": session.status,
        "assigned_agent_id": session.assigned_agent_id,
        "items": [_serialize_message(row) for row in rows],
    }


@router.post("/{chat_id}/accept")
async def accept_handoff_request(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    session = _get_session_for_org(db, chat_id, current_user.organization_id)
    _assert_session_access(db, current_user, session)

    if session.status == "assigned" and session.assigned_agent_id == current_user.id:
        return _serialize_session(session)

    if session.status != "waiting_for_agent":
        raise HTTPException(status_code=409, detail="This chat is not waiting for agent assignment")

    if session.assigned_agent_id and session.assigned_agent_id != current_user.id:
        raise HTTPException(status_code=409, detail="This chat is already assigned")

    updated = db.query(HandoffSession).filter(
        HandoffSession.id == session.id,
        HandoffSession.status == "waiting_for_agent",
        HandoffSession.assigned_agent_id.is_(None),
    ).update(
        {
            HandoffSession.status: "assigned",
            HandoffSession.assigned_agent_id: current_user.id,
            HandoffSession.updated_at: datetime.utcnow(),
        },
        synchronize_session=False,
    )

    if not updated:
        db.rollback()
        latest = _get_session_for_org(db, chat_id, current_user.organization_id)
        if latest.assigned_agent_id and latest.assigned_agent_id != current_user.id:
            raise HTTPException(status_code=409, detail="This chat was assigned to another admin")
        raise HTTPException(status_code=409, detail="Unable to assign this chat")

    db.add(HandoffMessage(
        handoff_session_id=session.id,
        sender_type="system",
        sender_user_id=current_user.id,
        message=f"Assigned to admin {current_user.username}",
    ))
    db.commit()
    db.refresh(session)

    await handoff_hub.broadcast(current_user.organization_id, {
        "type": "handoff_assigned",
        "chat_id": session.chat_id,
        "assigned_agent_id": current_user.id,
        "status": session.status,
    })

    return _serialize_session(session)


@router.post("/{chat_id}/return-to-bot")
async def return_handoff_to_bot(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    session = _get_session_for_org(db, chat_id, current_user.organization_id)
    _assert_session_access(db, current_user, session)

    if session.status not in {"assigned", "waiting_for_agent"}:
        raise HTTPException(status_code=409, detail="Chat is not active for handoff")

    if session.assigned_agent_id and session.assigned_agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned admin can return this chat to bot")

    session.status = "bot_active"
    session.assigned_agent_id = None
    session.updated_at = datetime.utcnow()
    session.closed_at = datetime.utcnow()

    db.add(HandoffMessage(
        handoff_session_id=session.id,
        sender_type="system",
        sender_user_id=current_user.id,
        message="Chat returned to bot",
    ))
    db.commit()
    db.refresh(session)

    await handoff_hub.broadcast(current_user.organization_id, {
        "type": "handoff_returned_to_bot",
        "chat_id": session.chat_id,
        "status": session.status,
    })

    return _serialize_session(session)


@router.post("/{chat_id}/close")
async def close_handoff_chat(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    session = _get_session_for_org(db, chat_id, current_user.organization_id)
    _assert_session_access(db, current_user, session)

    if session.assigned_agent_id and session.assigned_agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned admin can close this chat")

    session.status = "closed"
    session.updated_at = datetime.utcnow()
    session.closed_at = datetime.utcnow()

    db.add(HandoffMessage(
        handoff_session_id=session.id,
        sender_type="system",
        sender_user_id=current_user.id,
        message="Chat closed by admin",
    ))
    db.commit()
    db.refresh(session)

    await handoff_hub.broadcast(current_user.organization_id, {
        "type": "handoff_closed",
        "chat_id": session.chat_id,
        "status": session.status,
    })

    return _serialize_session(session)


@router.post("/{chat_id}/messages")
async def send_handoff_agent_message(
    chat_id: str,
    payload: AgentReplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    text = (payload.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="message is required")

    session = _get_session_for_org(db, chat_id, current_user.organization_id)
    _assert_session_access(db, current_user, session)

    if session.status != "assigned" or session.assigned_agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned admin can reply to this chat")

    message = HandoffMessage(
        handoff_session_id=session.id,
        sender_type="agent",
        sender_user_id=current_user.id,
        message=text,
    )
    db.add(message)
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(message)

    await handoff_hub.broadcast(current_user.organization_id, {
        "type": "handoff_agent_message",
        "chat_id": session.chat_id,
        "message": _serialize_message(message),
    })

    return _serialize_message(message)

@router.post("/{chat_id}/call/start")
async def start_handoff_call(
    chat_id: str,
    payload: Optional[HandoffCallModeRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    session = _get_session_for_org(db, chat_id, current_user.organization_id)
    _assert_session_access(db, current_user, session)

    if session.status == "waiting_for_agent":
        raise HTTPException(status_code=409, detail="Accept the handoff request before starting a call")

    if session.status != "assigned" or session.assigned_agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned admin can start the call")

    requested_mode = ((payload.mode if payload else "video") or "video").strip().lower()
    if requested_mode not in {"video", "audio"}:
        raise HTTPException(status_code=400, detail="mode must be video or audio")

    now = datetime.utcnow()
    if not (session.call_room_id or "").strip():
        session.call_room_id = f"ai-bot-{session.organization_id}-{session.id}-{int(now.timestamp())}"

    session.call_mode = requested_mode
    session.call_status = "active"
    if not session.call_requested_at:
        session.call_requested_at = now
    session.call_started_at = now
    session.call_ended_at = None
    session.updated_at = now

    db.add(HandoffMessage(
        handoff_session_id=session.id,
        sender_type="system",
        sender_user_id=current_user.id,
        message=f"Live {requested_mode} call started.",
    ))
    db.commit()
    db.refresh(session)

    await handoff_hub.broadcast(current_user.organization_id, {
        "type": "handoff_call_started",
        "chat_id": session.chat_id,
        "call_status": session.call_status,
        "call_mode": session.call_mode,
        "call_room_id": session.call_room_id,
    })

    return _serialize_session(session)

@router.post("/{chat_id}/call/mode")
async def update_handoff_call_mode(
    chat_id: str,
    payload: HandoffCallModeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    session = _get_session_for_org(db, chat_id, current_user.organization_id)
    _assert_session_access(db, current_user, session)

    if session.status != "assigned" or session.assigned_agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned admin can change call mode")

    if session.call_status not in {"requested", "active"}:
        raise HTTPException(status_code=409, detail="No active/requested call to update")

    requested_mode = (payload.mode or "").strip().lower()
    if requested_mode not in {"video", "audio"}:
        raise HTTPException(status_code=400, detail="mode must be video or audio")

    session.call_mode = requested_mode
    session.updated_at = datetime.utcnow()

    db.add(HandoffMessage(
        handoff_session_id=session.id,
        sender_type="system",
        sender_user_id=current_user.id,
        message=f"Call switched to {requested_mode} mode.",
    ))
    db.commit()
    db.refresh(session)

    await handoff_hub.broadcast(current_user.organization_id, {
        "type": "handoff_call_mode_changed",
        "chat_id": session.chat_id,
        "call_status": session.call_status,
        "call_mode": session.call_mode,
        "call_room_id": session.call_room_id,
    })

    return _serialize_session(session)

@router.post("/{chat_id}/call/end")
async def end_handoff_call(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_handoff_operator),
):
    session = _get_session_for_org(db, chat_id, current_user.organization_id)
    _assert_session_access(db, current_user, session)

    if session.status != "assigned" or session.assigned_agent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned admin can end the call")

    session.call_status = "ended"
    session.call_ended_at = datetime.utcnow()
    session.updated_at = datetime.utcnow()

    db.add(HandoffMessage(
        handoff_session_id=session.id,
        sender_type="system",
        sender_user_id=current_user.id,
        message="Live call ended.",
    ))
    db.commit()
    db.refresh(session)

    await handoff_hub.broadcast(current_user.organization_id, {
        "type": "handoff_call_ended",
        "chat_id": session.chat_id,
        "call_status": session.call_status,
        "call_mode": session.call_mode,
        "call_room_id": session.call_room_id,
    })

    return _serialize_session(session)


@router.websocket("/ws")
async def handoff_notifications_ws(websocket: WebSocket, token: str = Query(default="")):
    db = SessionLocal()
    user: Optional[User] = None
    organization_id: Optional[int] = None
    try:
        if not token:
            await websocket.close(code=1008, reason="Missing token")
            return

        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            await websocket.close(code=1008, reason="Invalid token")
            return

        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user or not user.is_active or user.role not in {UserRole.ADMIN, UserRole.USER_HANDOFF}:
            await websocket.close(code=1008, reason="Unauthorized")
            return

        organization_id = user.organization_id
        await handoff_hub.connect(organization_id, websocket)
        await websocket.send_json({"type": "connected", "organization_id": organization_id})

        while True:
            data = await websocket.receive_text()
            if data.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        if organization_id is not None:
            await handoff_hub.disconnect(organization_id, websocket)
        db.close()
