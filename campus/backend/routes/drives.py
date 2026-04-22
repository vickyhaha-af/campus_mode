"""
Drive CRUD with eligibility-rule validation.

Enforces the PRD Section 9 compliance rule:
if `gender_restriction` is set on a drive, `gender_restriction_justification`
MUST also be provided. This is where company-stated demographic rules become
auditable rather than silent.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..db import T_DRIVES, T_SHORTLISTS, T_STUDENTS, insert, select_one, select_many, update, delete
from ..models.drive import Drive, DriveCreate, DriveUpdate, EligibilityRules
from ..services.demo_store import is_demo, demo_drive_by_id, demo_student_by_id, DEMO_DRIVES
from ..services.campus_audit import safe_log


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


def _audit_gender_restriction(
    college_id: str, drive_id: Optional[str], rules: Optional[EligibilityRules], verb: str,
) -> None:
    """If a gender_restriction was set, log it as a distinct compliance event
    with the PC-supplied justification captured in `details`."""
    if rules is None:
        return
    gr = getattr(rules, "gender_restriction", None)
    if not gr:
        return
    safe_log(
        college_id=college_id,
        action="drive_gender_restriction",
        target_type="drive",
        target_id=drive_id,
        details={
            "verb": verb,  # "create" | "update"
            "gender_restriction": gr,
            "justification": getattr(rules, "gender_restriction_justification", None),
        },
    )


@router.post("")
async def create_drive(payload: DriveCreate):
    if is_demo(payload.college_id):
        raise HTTPException(status_code=403, detail="Demo college is read-only.")
    _validate_eligibility(payload.eligibility_rules)
    row = insert(T_DRIVES, _serialize(payload.model_dump(exclude_none=True)))
    safe_log(
        college_id=payload.college_id,
        action="drive_create",
        target_type="drive",
        target_id=row.get("id"),
        details={
            "role": payload.role,
            "company_id": payload.company_id,
            "status": row.get("status"),
        },
    )
    _audit_gender_restriction(payload.college_id, row.get("id"), payload.eligibility_rules, "create")
    return row


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
    row = update(T_DRIVES, drive_id, _serialize(payload.model_dump(exclude_none=True)))
    college_id = row.get("college_id")
    if college_id:
        safe_log(
            college_id=college_id,
            action="drive_update",
            target_type="drive",
            target_id=drive_id,
            details={k: v for k, v in payload.model_dump(exclude_none=True).items()
                     if k != "eligibility_rules"},
        )
        _audit_gender_restriction(college_id, drive_id, payload.eligibility_rules, "update")
    return row


@router.delete("/{drive_id}")
async def remove_drive(drive_id: str):
    if demo_drive_by_id(drive_id):
        raise HTTPException(status_code=403, detail="Demo drives are read-only.")
    existing = select_one(T_DRIVES, {"id": drive_id}) or {}
    delete(T_DRIVES, drive_id)
    college_id = existing.get("college_id")
    if college_id:
        safe_log(
            college_id=college_id,
            action="drive_delete",
            target_type="drive",
            target_id=drive_id,
            details={"role": existing.get("role"), "company_id": existing.get("company_id")},
        )
    return {"status": "deleted"}


# ---------- CSV export ----------

def _slugify(value: str) -> str:
    value = (value or "drive").lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:48] or "drive"


@router.get("/{drive_id}/shortlist.csv")
async def export_shortlist_csv(drive_id: str):
    """
    Stream a CSV of the drive's shortlist. Works for both real DB drives and
    demo drives (pulls from the in-memory demo shortlist store).

    Columns: name, email, branch, cgpa, stage, fit_score, rationale
    """
    demo = demo_drive_by_id(drive_id)

    rows_out: list[list[str]] = []

    if demo:
        # Pull from demo shortlist store.
        try:
            from .shortlists import _DEMO_SHORTLISTS  # type: ignore
            sl_rows = sorted(
                (r for r in _DEMO_SHORTLISTS.values() if r.get("drive_id") == drive_id),
                key=lambda r: r.get("rank") or 999,
            )
        except Exception:
            sl_rows = []
        for r in sl_rows:
            s = demo_student_by_id(r.get("student_id")) or {}
            rows_out.append([
                s.get("name", "") or "",
                s.get("email", "") or "",
                s.get("branch", "") or "",
                str(s.get("cgpa") if s.get("cgpa") is not None else ""),
                r.get("stage", "") or "",
                str(r.get("fit_score") if r.get("fit_score") is not None else ""),
                (r.get("fit_rationale") or "").replace("\n", " "),
            ])
        drive = demo
    else:
        drive = select_one(T_DRIVES, {"id": drive_id})
        if not drive:
            raise HTTPException(status_code=404, detail="Drive not found")
        sl_rows = select_many(T_SHORTLISTS, filters={"drive_id": drive_id}, order_by="rank") or []
        for r in sl_rows:
            sid = r.get("student_id")
            s = select_one(T_STUDENTS, {"id": sid}) if sid else None
            s = s or {}
            rows_out.append([
                s.get("name", "") or "",
                s.get("email", "") or "",
                s.get("branch", "") or "",
                str(s.get("cgpa") if s.get("cgpa") is not None else ""),
                r.get("stage", "") or "",
                str(r.get("fit_score") if r.get("fit_score") is not None else ""),
                (r.get("fit_rationale") or "").replace("\n", " "),
            ])

    # Build CSV in-memory and stream.
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "email", "branch", "cgpa", "stage", "fit_score", "rationale"])
    for row in rows_out:
        w.writerow(row)
    buf.seek(0)

    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    slug = _slugify(f"{drive.get('role', '')}-{drive_id[:8]}")
    filename = f"shortlist_{slug}_{today}.csv"

    def iter_bytes():
        yield buf.getvalue().encode("utf-8")

    return StreamingResponse(
        iter_bytes(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
