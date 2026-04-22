"""
Audit log API — read-only endpoints for the viewer UI.

GET /api/campus/audit           — paginated, filterable list
GET /api/campus/audit/verify    — chain-integrity check
GET /api/campus/audit/actions   — distinct action strings for filter dropdown
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..services.campus_audit import (
    list_entries,
    verify_chain,
    action_types,
)


router = APIRouter(prefix="/api/campus/audit", tags=["campus:audit"])


@router.get("")
async def get_audit_log(
    college_id: str = Query(..., description="College UUID to scope entries to"),
    action_type: Optional[str] = Query(None, description="Filter by exact action name"),
    from_: Optional[str] = Query(None, alias="from", description="ISO timestamp lower bound (inclusive)"),
    to: Optional[str] = Query(None, description="ISO timestamp upper bound (inclusive)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    if not college_id:
        raise HTTPException(status_code=422, detail="college_id is required")
    return list_entries(
        college_id=college_id,
        action_type=action_type,
        from_ts=from_,
        to_ts=to,
        limit=limit,
        offset=offset,
    )


@router.get("/verify")
async def verify(college_id: str = Query(...)):
    if not college_id:
        raise HTTPException(status_code=422, detail="college_id is required")
    return verify_chain(college_id)


@router.get("/actions")
async def list_actions(college_id: str = Query(...)):
    if not college_id:
        raise HTTPException(status_code=422, detail="college_id is required")
    return {"actions": action_types(college_id)}
