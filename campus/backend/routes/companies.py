from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ..db import T_COMPANIES, insert, select_one, select_many, update, delete
from ..models.company import Company, CompanyCreate, CompanyUpdate
from ..services.demo_store import is_demo, DEMO_COMPANIES


router = APIRouter(prefix="/api/campus/companies", tags=["campus:companies"])


@router.post("", response_model=Company)
async def create_company(payload: CompanyCreate):
    return insert(T_COMPANIES, payload.model_dump(exclude_none=True))


@router.get("")
async def list_companies(college_id: Optional[str] = Query(None)):
    if is_demo(college_id):
        return list(DEMO_COMPANIES)
    filters = {"college_id": college_id} if college_id else {}
    return select_many(T_COMPANIES, filters=filters, order_by="created_at", desc=True)


@router.get("/{company_id}", response_model=Company)
async def get_company(company_id: str):
    row = select_one(T_COMPANIES, {"id": company_id})
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    return row


@router.patch("/{company_id}", response_model=Company)
async def update_company(company_id: str, payload: CompanyUpdate):
    return update(T_COMPANIES, company_id, payload.model_dump(exclude_none=True))


@router.delete("/{company_id}")
async def remove_company(company_id: str):
    delete(T_COMPANIES, company_id)
    return {"status": "deleted"}
