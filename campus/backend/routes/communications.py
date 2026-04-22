"""
Communications routes — draft + send (mocked) per-student emails.

The chat's ActionCard for propose_interview_email / propose_rejection_email
calls POST /api/campus/communications/send on confirmation. This endpoint
writes a row into `campus_communications` with status='sent' — no actual SMTP
is wired; the row serves as the audit trail and future hook for a real
provider.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import T_COMMS, insert, select_many
from ..services.demo_store import is_demo, demo_drive_by_id


router = APIRouter(prefix="/api/campus/communications", tags=["campus:communications"])


# In-memory store for demo mode (keyed by id).
_DEMO_COMMS: Dict[str, Dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


VALID_TYPES = {"shortlist_notify", "interview_invite", "offer", "rejection", "custom"}


class SendCommunication(BaseModel):
    drive_id: str
    student_id: str
    type: str
    subject: Optional[str] = None
    body: str
    meeting_link: Optional[str] = None


@router.post("/send")
async def send_communication(payload: SendCommunication) -> Dict[str, Any]:
    """
    "Send" a communication — writes a row with status='sent'. Mocked: no SMTP.

    If the body contains the literal {{meeting_link}} placeholder and a
    meeting_link is supplied, we substitute it before persisting so the
    stored body matches what was conceptually sent.
    """
    if payload.type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid type. Must be one of {sorted(VALID_TYPES)}")

    body = payload.body or ""
    if payload.meeting_link and "{{meeting_link}}" in body:
        body = body.replace("{{meeting_link}}", payload.meeting_link)

    row_payload = {
        "drive_id": payload.drive_id,
        "student_id": payload.student_id,
        "type": payload.type,
        "channel": "email",
        "subject": payload.subject,
        "body": body,
        "meeting_link": payload.meeting_link,
        "status": "sent",
        "sent_at": _now(),
    }

    # Demo drives stay in-memory — a Supabase insert would fail FK checks
    # against a non-existent drive row.
    if demo_drive_by_id(payload.drive_id) is not None:
        row = {
            "id": str(uuid.uuid4()),
            **row_payload,
            "created_at": _now(),
        }
        _DEMO_COMMS[row["id"]] = row
        return row

    try:
        row = insert(T_COMMS, row_payload)
        return row
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to persist communication: {e}")


@router.get("")
async def list_communications(
    drive_id: Optional[str] = None,
    student_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    # Demo passthrough
    if drive_id and demo_drive_by_id(drive_id) is not None:
        return [
            r for r in _DEMO_COMMS.values()
            if (not drive_id or r["drive_id"] == drive_id)
            and (not student_id or r["student_id"] == student_id)
        ]
    filters: Dict[str, Any] = {}
    if drive_id:
        filters["drive_id"] = drive_id
    if student_id:
        filters["student_id"] = student_id
    return select_many(T_COMMS, filters=filters, order_by="created_at", desc=True)
