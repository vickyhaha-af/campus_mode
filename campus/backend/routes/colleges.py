"""College admin CRUD — supports the 'generic + admin-configurable' decision."""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..db import T_COLLEGES, insert, select_one, select_many, update, delete
from ..services.demo_store import is_demo, DEMO_COLLEGE


router = APIRouter(prefix="/api/campus/colleges", tags=["campus:colleges"])


class CollegeCreate(BaseModel):
    name: str
    slug: str
    logo_url: Optional[str] = None
    branches: List[str] = Field(default_factory=list)


class CollegeUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    branches: Optional[List[str]] = None


@router.post("")
async def create_college(payload: CollegeCreate):
    existing = select_one(T_COLLEGES, {"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=409, detail=f"slug '{payload.slug}' already in use")
    return insert(T_COLLEGES, payload.model_dump())


@router.get("")
async def list_colleges():
    return select_many(T_COLLEGES, order_by="created_at", desc=True)


@router.get("/{college_id}")
async def get_college(college_id: str):
    if is_demo(college_id):
        return DEMO_COLLEGE
    row = select_one(T_COLLEGES, {"id": college_id})
    if not row:
        raise HTTPException(status_code=404, detail="College not found")
    return row


@router.patch("/{college_id}")
async def update_college(college_id: str, payload: CollegeUpdate):
    return update(T_COLLEGES, college_id, payload.model_dump(exclude_none=True))


@router.delete("/{college_id}")
async def remove_college(college_id: str):
    delete(T_COLLEGES, college_id)
    return {"status": "deleted"}
