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

from ..db import T_COMMS, T_DRIVES, T_STUDENTS, insert, select_many, select_one
from ..services.demo_store import (
    is_demo, demo_drive_by_id, demo_student_by_id,
)


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


class DraftRequest(BaseModel):
    drive_id: str
    student_id: str
    type: str  # interview_invite | offer | rejection | shortlist_notify | custom
    tone: str = "professional"  # professional | warm | formal
    custom_instructions: Optional[str] = None
    slot_text: Optional[str] = None  # e.g. "Friday 2pm IST"


@router.post("/draft")
async def draft_communication(payload: DraftRequest) -> Dict[str, Any]:
    """
    LLM-draft an email for a single student-drive pair. Returns subject + body
    + suggested meeting_link placeholder. Does NOT send — the client then
    reviews and POSTs to /send.
    """
    if payload.type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid type. Must be one of {sorted(VALID_TYPES)}")

    drive = demo_drive_by_id(payload.drive_id) or select_one(T_DRIVES, {"id": payload.drive_id})
    if not drive:
        raise HTTPException(status_code=404, detail="drive not found")

    student = demo_student_by_id(payload.student_id) or select_one(T_STUDENTS, {"id": payload.student_id})
    if not student:
        raise HTTPException(status_code=404, detail="student not found")

    try:
        from services.llm_client import generate_json  # type: ignore

        system = (
            "You draft emails from a college Placement Committee to students. "
            "Be warm but professional. Keep subject ≤ 10 words. Keep body ≤ 180 words. "
            "Include the {{meeting_link}} placeholder ONLY when relevant (interview invites). "
            "Return ONLY JSON: {\"subject\": str, \"body\": str}."
        )
        enriched = student.get("profile_enriched") or {}
        student_summary = enriched.get("summary") or ""
        prompt = f"""Draft a {payload.type.replace('_', ' ')} email.

Student: {student.get('name')} ({student.get('branch') or 'student'}, CGPA {student.get('cgpa') or '—'})
Student background: {student_summary[:300]}

Drive: {drive.get('role')} at (company id {drive.get('company_id')})
Location: {drive.get('location') or '—'}  ·  CTC: {drive.get('ctc_offered') or '—'}

Tone: {payload.tone}
{f"Interview slot: {payload.slot_text}" if payload.slot_text else ""}
{f"Extra instruction from PC: {payload.custom_instructions}" if payload.custom_instructions else ""}

Reply JSON: {{"subject": "...", "body": "...Hi {student.get('name', 'there').split()[0]}...}}."""

        draft = generate_json(prompt, system=system, max_tokens=600)
        subject = str(draft.get("subject") or "").strip()
        body = str(draft.get("body") or "").strip()
        if not subject or not body:
            raise RuntimeError("LLM returned empty draft")
    except Exception as e:
        # Deterministic fallback template so the PC can always review something.
        name = student.get("name") or "there"
        first = name.split()[0] if name else "there"
        role = drive.get("role") or "the role"
        if payload.type == "interview_invite":
            subject = f"Interview invite — {role}"
            body = (
                f"Hi {first},\n\n"
                f"You've been shortlisted for the {role} role. Please join the interview "
                f"{'on ' + payload.slot_text if payload.slot_text else 'at the scheduled time'}.\n\n"
                f"Meeting link: {{{{meeting_link}}}}\n\n"
                f"Best,\nPlacement Cell"
            )
        elif payload.type == "rejection":
            subject = f"Update on your {role} application"
            body = (
                f"Hi {first},\n\n"
                f"Thank you for interviewing for {role}. Unfortunately your profile wasn't selected "
                f"to move forward this time. We'll keep you in mind for future drives that match your profile.\n\n"
                f"Best,\nPlacement Cell"
            )
        elif payload.type == "offer":
            subject = f"Offer — {role}"
            body = f"Hi {first},\n\nCongratulations! You've been selected for {role}. We'll share the offer letter shortly.\n\nBest,\nPlacement Cell"
        else:
            subject = f"Update — {role}"
            body = f"Hi {first},\n\n[draft unavailable — LLM error: {str(e)[:120]}. Please edit before sending.]\n\nBest,\nPlacement Cell"

    return {
        "subject": subject,
        "body": body,
        "student": {"id": student["id"], "name": student.get("name"), "email": student.get("email")},
        "drive": {"id": drive["id"], "role": drive.get("role")},
    }


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
