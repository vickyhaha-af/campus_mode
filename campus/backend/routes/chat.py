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
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.chat_orchestrator import (
    create_session, get_session, run_agent_stream,
)


router = APIRouter(prefix="/api/campus/chat", tags=["campus:chat"])


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
