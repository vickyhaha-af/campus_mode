from __future__ import annotations

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = None
    tier: Optional[str] = None
    website: Optional[str] = None
    first_visit_date: Optional[date] = None


class CompanyCreate(CompanyBase):
    college_id: str


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    tier: Optional[str] = None
    website: Optional[str] = None
    first_visit_date: Optional[date] = None


class Company(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    college_id: Optional[str] = None
    added_by: Optional[str] = None
    created_at: Optional[datetime] = None
