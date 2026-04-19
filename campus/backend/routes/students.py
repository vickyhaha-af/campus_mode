"""Student CRUD. PC-is-king: any authenticated admin call can mutate."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ..db import T_STUDENTS, insert, select_one, select_many, update, delete
from ..models.student import Student, StudentCreate, StudentUpdate
from ..services.demo_store import is_demo, demo_students_filter, demo_student_by_id


router = APIRouter(prefix="/api/campus/students", tags=["campus:students"])


def _serialize(payload_dict: dict) -> dict:
    out = dict(payload_dict)
    for k in ("profile_enriched", "preferences"):
        v = out.get(k)
        if hasattr(v, "model_dump"):
            out[k] = v.model_dump()
    return out


@router.post("")
async def create_student(payload: StudentCreate):
    if is_demo(payload.college_id):
        raise HTTPException(status_code=403, detail="Demo college is read-only.")
    row = insert(T_STUDENTS, _serialize(payload.model_dump(exclude_none=True)))
    return row


@router.get("")
async def list_students(
    college_id: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    placed_status: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
):
    if is_demo(college_id):
        return demo_students_filter(branch=branch, year=year, placed_status=placed_status)[:limit]

    filters = {}
    if college_id: filters["college_id"] = college_id
    if branch: filters["branch"] = branch
    if year is not None: filters["year"] = year
    if placed_status: filters["placed_status"] = placed_status
    return select_many(T_STUDENTS, filters=filters, order_by="registered_at", desc=True, limit=limit)


@router.get("/{student_id}")
async def get_student(student_id: str):
    demo_row = demo_student_by_id(student_id)
    if demo_row:
        return demo_row
    row = select_one(T_STUDENTS, {"id": student_id})
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    return row


@router.patch("/{student_id}")
async def update_student(student_id: str, payload: StudentUpdate):
    if demo_student_by_id(student_id):
        raise HTTPException(status_code=403, detail="Demo students are read-only.")
    return update(T_STUDENTS, student_id, _serialize(payload.model_dump(exclude_none=True)))


@router.delete("/{student_id}")
async def remove_student(student_id: str):
    if demo_student_by_id(student_id):
        raise HTTPException(status_code=403, detail="Demo students are read-only.")
    delete(T_STUDENTS, student_id)
    return {"status": "deleted"}
