"""
Chat routes — session CRUD + SSE streaming endpoint.

Endpoints:
    POST /api/campus/chat/session      — create a new chat session
    GET  /api/campus/chat/session/{id} — load session with messages
    POST /api/campus/chat/stream       — SSE: send user message, stream agent events
"""
from __future__ import annotations

import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..db import T_CHAT, select_many
from ..services.chat_orchestrator import (
    create_session, get_session, run_agent_stream, _INPROC_SESSIONS,
)


router = APIRouter(prefix="/api/campus/chat", tags=["campus:chat"])


def _session_summary(row: Dict[str, Any]) -> Dict[str, Any]:
    """Compact summary used by the history sidebar."""
    msgs = row.get("messages") or []
    first_user = next((m.get("content") for m in msgs if m.get("role") == "user"), None)
    title = (first_user or "").strip().splitlines()[0] if first_user else "New chat"
    if len(title) > 80:
        title = title[:77] + "..."
    return {
        "id": row.get("id"),
        "college_id": row.get("college_id"),
        "context_drive_id": row.get("context_drive_id"),
        "title": title or "New chat",
        "message_count": len(msgs),
        "last_active": row.get("last_active") or row.get("created_at"),
        "created_at": row.get("created_at"),
    }


@router.get("/sessions")
async def list_chat_sessions(
    college_id: str = Query(...),
    limit: int = Query(50, le=200),
) -> List[Dict[str, Any]]:
    """Recent chat sessions for a college, newest first (for the history sidebar)."""
    rows: List[Dict[str, Any]] = []
    # Supabase path — best-effort; fall back to in-proc sessions if the DB
    # isn't configured (demo mode).
    try:
        rows = select_many(
            T_CHAT, filters={"college_id": college_id},
            order_by="last_active", desc=True, limit=limit,
        )
    except Exception:
        rows = []

    if not rows:
        # In-process fallback (demo mode / no Supabase).
        rows = [
            r for r in _INPROC_SESSIONS.values()
            if (r.get("college_id") == college_id)
        ]
        rows.sort(key=lambda r: r.get("last_active") or r.get("created_at") or "", reverse=True)
        rows = rows[:limit]

    return [_session_summary(r) for r in rows]


class SessionCreate(BaseModel):
    college_id: str
    context_drive_id: Optional[str] = None
    user_id: Optional[str] = None


@router.post("/session")
async def create_chat_session(payload: SessionCreate) -> Dict[str, Any]:
    session = create_session(
        user_id=payload.user_id,
        college_id=payload.college_id,
        context_drive_id=payload.context_drive_id,
    )
    return {
        "id": session["id"],
        "college_id": session.get("college_id"),
        "context_drive_id": session.get("context_drive_id"),
        "messages": session.get("messages") or [],
    }


@router.get("/session/{session_id}")
async def get_chat_session(session_id: str) -> Dict[str, Any]:
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="chat session not found")
    return {
        "id": session["id"],
        "college_id": session.get("college_id"),
        "context_drive_id": session.get("context_drive_id"),
        "messages": session.get("messages") or [],
    }


class StreamRequest(BaseModel):
    session_id: str
    message: str
    college_id: str
    drive_context_id: Optional[str] = None


@router.post("/stream")
async def stream_chat(payload: StreamRequest):
    """
    Stream agent events as Server-Sent Events.

    Events emitted (each as `data: {...}\\n\\n`):
        user_message        { content }
        thinking            { iteration }
        tool_call           { name, args }
        tool_result         { name, result }
        assistant_message   { content }
        error               { message }
        done                {}
    """
    async def event_source():
        async for ev in run_agent_stream(
            session_id=payload.session_id,
            user_message=payload.message,
            college_id=payload.college_id,
            drive_context_id=payload.drive_context_id,
        ):
            yield f"data: {json.dumps(ev)}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
            "Connection": "keep-alive",
        },
    )
