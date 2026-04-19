"""
Drive CRUD with eligibility-rule validation.

Enforces the PRD Section 9 compliance rule:
if `gender_restriction` is set on a drive, `gender_restriction_justification`
MUST also be provided. This is where company-stated demographic rules become
auditable rather than silent.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ..db import T_DRIVES, insert, select_one, select_many, update, delete
from ..models.drive import Drive, DriveCreate, DriveUpdate, EligibilityRules
from ..services.demo_store import is_demo, demo_drive_by_id, DEMO_DRIVES


router = APIRouter(prefix="/api/campus/drives", tags=["campus:drives"])


def _validate_eligibility(rules: Optional[EligibilityRules]) -> None:
    if rules is None:
        return
    if rules.gender_restriction and not (rules.gender_restriction_justification or "").strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "gender_restriction requires gender_restriction_justification "
                "(company-stated reason). This is a compliance requirement."
            ),
        )


def _serialize(payload_dict: dict) -> dict:
    out = dict(payload_dict)
    v = out.get("eligibility_rules")
    if hasattr(v, "model_dump"):
        out["eligibility_rules"] = v.model_dump()
    return out


@router.post("")
async def create_drive(payload: DriveCreate):
    if is_demo(payload.college_id):
        raise HTTPException(status_code=403, detail="Demo college is read-only.")
    _validate_eligibility(payload.eligibility_rules)
    return insert(T_DRIVES, _serialize(payload.model_dump(exclude_none=True)))


@router.get("")
async def list_drives(
    college_id: Optional[str] = Query(None),
    company_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    if is_demo(college_id):
        out = list(DEMO_DRIVES)
        if company_id: out = [d for d in out if d.get("company_id") == company_id]
        if status: out = [d for d in out if d.get("status") == status]
        return out

    filters = {}
    if college_id: filters["college_id"] = college_id
    if company_id: filters["company_id"] = company_id
    if status: filters["status"] = status
    return select_many(T_DRIVES, filters=filters, order_by="scheduled_date", desc=False)


@router.get("/{drive_id}")
async def get_drive(drive_id: str):
    demo = demo_drive_by_id(drive_id)
    if demo:
        return demo
    row = select_one(T_DRIVES, {"id": drive_id})
    if not row:
        raise HTTPException(status_code=404, detail="Drive not found")
    return row


@router.patch("/{drive_id}")
async def update_drive(drive_id: str, payload: DriveUpdate):
    if demo_drive_by_id(drive_id):
        raise HTTPException(status_code=403, detail="Demo drives are read-only.")
    _validate_eligibility(payload.eligibility_rules)
    return update(T_DRIVES, drive_id, _serialize(payload.model_dump(exclude_none=True)))


@router.delete("/{drive_id}")
async def remove_drive(drive_id: str):
    if demo_drive_by_id(drive_id):
        raise HTTPException(status_code=403, detail="Demo drives are read-only.")
    delete(T_DRIVES, drive_id)
    return {"status": "deleted"}
