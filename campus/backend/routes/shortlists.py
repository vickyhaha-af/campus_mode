"""
Shortlist CRUD + stage transitions.

Stages mirror the PRD lifecycle: shortlisted → interview_1/2/3 → offered →
accepted → joined, with rejected/withdrawn as terminal exits.

Demo-mode shortlists live in an in-process dict so demo users can move
candidates through the pipeline without any DB.
"""
from __future__ import annotations

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..db import T_SHORTLISTS, insert, select_one, select_many, update, delete
from ..models.shortlist import Shortlist, ShortlistCreate, ShortlistUpdate, Stage
from ..services.demo_store import is_demo, demo_drive_by_id, demo_student_by_id
from ..services.campus_audit import safe_log


router = APIRouter(prefix="/api/campus/shortlists", tags=["campus:shortlists"])


# In-memory store for demo mode (keyed by shortlist id).
_DEMO_SHORTLISTS: Dict[str, Dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _drive_is_demo(drive_id: str) -> bool:
    return demo_drive_by_id(drive_id) is not None


def _college_id_for_drive(drive_id: str) -> Optional[str]:
    """Resolve the owning college for a drive — demo first, then DB."""
    d = demo_drive_by_id(drive_id)
    if d:
        return d.get("college_id")
    try:
        from ..db import T_DRIVES  # local import: avoids shortlist-side cycle
        row = select_one(T_DRIVES, {"id": drive_id})
        return (row or {}).get("college_id")
    except Exception:
        return None


# ---------- CRUD ----------

class BulkCreate(BaseModel):
    drive_id: str
    student_ids: List[str]


@router.post("/bulk")
async def bulk_shortlist(payload: BulkCreate):
    """Create shortlist rows for a drive + list of students. Idempotent per pair."""
    if _drive_is_demo(payload.drive_id):
        created: List[Dict[str, Any]] = []
        for i, sid in enumerate(payload.student_ids):
            # Skip duplicates
            dup = any(r["drive_id"] == payload.drive_id and r["student_id"] == sid
                      for r in _DEMO_SHORTLISTS.values())
            if dup: continue
            row = {
                "id": str(uuid.uuid4()),
                "drive_id": payload.drive_id,
                "student_id": sid,
                "stage": "shortlisted",
                "rank": i + 1,
                "fit_score": None,
                "fit_rationale": None,
                "created_by": None,
                "created_at": _now(),
                "last_updated": _now(),
            }
            _DEMO_SHORTLISTS[row["id"]] = row
            created.append(row)
        # Audit: one entry per bulk_shortlist call (keeps the chain legible)
        college_id = _college_id_for_drive(payload.drive_id)
        if college_id:
            safe_log(
                college_id=college_id,
                action="bulk_shortlist",
                target_type="drive",
                target_id=payload.drive_id,
                details={
                    "student_ids": payload.student_ids,
                    "created": len(created),
                    "requested": len(payload.student_ids),
                },
            )
        return {"created": len(created), "shortlists": created}

    # Real persistence
    created = []
    for i, sid in enumerate(payload.student_ids):
        existing = select_many(T_SHORTLISTS, filters={"drive_id": payload.drive_id, "student_id": sid}, limit=1)
        if existing: continue
        row = insert(T_SHORTLISTS, {
            "drive_id": payload.drive_id,
            "student_id": sid,
            "stage": "shortlisted",
            "rank": i + 1,
        })
        created.append(row)
    college_id = _college_id_for_drive(payload.drive_id)
    if college_id:
        safe_log(
            college_id=college_id,
            action="bulk_shortlist",
            target_type="drive",
            target_id=payload.drive_id,
            details={
                "student_ids": payload.student_ids,
                "created": len(created),
                "requested": len(payload.student_ids),
            },
        )
    return {"created": len(created), "shortlists": created}


@router.post("")
async def create_shortlist(payload: ShortlistCreate):
    if _drive_is_demo(payload.drive_id):
        row = {
            "id": str(uuid.uuid4()),
            **payload.model_dump(),
            "created_by": None,
            "created_at": _now(),
            "last_updated": _now(),
        }
        _DEMO_SHORTLISTS[row["id"]] = row
        return row
    return insert(T_SHORTLISTS, payload.model_dump())


@router.get("")
async def list_shortlists(
    drive_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
):
    if drive_id and _drive_is_demo(drive_id):
        rows = [r for r in _DEMO_SHORTLISTS.values()
                if (not drive_id or r["drive_id"] == drive_id)
                and (not student_id or r["student_id"] == student_id)
                and (not stage or r["stage"] == stage)]
        # Hydrate with student name/branch/cgpa for the UI
        for r in rows:
            s = demo_student_by_id(r["student_id"])
            if s:
                r["_student"] = {"name": s["name"], "branch": s.get("branch"), "cgpa": s.get("cgpa")}
        return sorted(rows, key=lambda r: r.get("rank") or 999)

    filters = {}
    if drive_id: filters["drive_id"] = drive_id
    if student_id: filters["student_id"] = student_id
    if stage: filters["stage"] = stage
    return select_many(T_SHORTLISTS, filters=filters, order_by="rank")


@router.patch("/{shortlist_id}")
async def update_shortlist(shortlist_id: str, payload: ShortlistUpdate):
    if shortlist_id in _DEMO_SHORTLISTS:
        row = _DEMO_SHORTLISTS[shortlist_id]
        for k, v in payload.model_dump(exclude_none=True).items():
            row[k] = v
        row["last_updated"] = _now()
        return row
    return update(T_SHORTLISTS, shortlist_id, payload.model_dump(exclude_none=True))


@router.delete("/{shortlist_id}")
async def remove_shortlist(shortlist_id: str):
    if shortlist_id in _DEMO_SHORTLISTS:
        removed = _DEMO_SHORTLISTS.pop(shortlist_id)
        drive_id = removed.get("drive_id")
        college_id = _college_id_for_drive(drive_id) if drive_id else None
        if college_id:
            safe_log(
                college_id=college_id,
                action="shortlist_remove",
                target_type="shortlist",
                target_id=shortlist_id,
                details={
                    "drive_id": drive_id,
                    "student_id": removed.get("student_id"),
                    "stage": removed.get("stage"),
                },
            )
        return {"status": "deleted"}
    existing = select_one(T_SHORTLISTS, {"id": shortlist_id}) or {}
    delete(T_SHORTLISTS, shortlist_id)
    drive_id = existing.get("drive_id")
    college_id = _college_id_for_drive(drive_id) if drive_id else None
    if college_id:
        safe_log(
            college_id=college_id,
            action="shortlist_remove",
            target_type="shortlist",
            target_id=shortlist_id,
            details={
                "drive_id": drive_id,
                "student_id": existing.get("student_id"),
                "stage": existing.get("stage"),
            },
        )
    return {"status": "deleted"}


# ---------- stage transitions ----------

VALID_STAGES = [
    "shortlisted", "interview_1", "interview_2", "interview_3",
    "offered", "accepted", "joined", "rejected", "withdrawn",
]


class StageChange(BaseModel):
    stage: str


@router.post("/{shortlist_id}/stage")
async def change_stage(shortlist_id: str, payload: StageChange):
    if payload.stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail=f"Invalid stage. Must be one of {VALID_STAGES}")
    if shortlist_id in _DEMO_SHORTLISTS:
        prev_stage = _DEMO_SHORTLISTS[shortlist_id].get("stage")
        drive_id = _DEMO_SHORTLISTS[shortlist_id].get("drive_id")
        _DEMO_SHORTLISTS[shortlist_id]["stage"] = payload.stage
        _DEMO_SHORTLISTS[shortlist_id]["last_updated"] = _now()
        college_id = _college_id_for_drive(drive_id) if drive_id else None
        if college_id:
            safe_log(
                college_id=college_id,
                action="shortlist_stage_change",
                target_type="shortlist",
                target_id=shortlist_id,
                details={
                    "from": prev_stage,
                    "to": payload.stage,
                    "drive_id": drive_id,
                    "student_id": _DEMO_SHORTLISTS[shortlist_id].get("student_id"),
                },
            )
        return _DEMO_SHORTLISTS[shortlist_id]
    existing = select_one(T_SHORTLISTS, {"id": shortlist_id}) or {}
    row = update(T_SHORTLISTS, shortlist_id, {"stage": payload.stage})
    drive_id = row.get("drive_id") or existing.get("drive_id")
    college_id = _college_id_for_drive(drive_id) if drive_id else None
    if college_id:
        safe_log(
            college_id=college_id,
            action="shortlist_stage_change",
            target_type="shortlist",
            target_id=shortlist_id,
            details={
                "from": existing.get("stage"),
                "to": payload.stage,
                "drive_id": drive_id,
                "student_id": row.get("student_id"),
            },
        )
    return row
