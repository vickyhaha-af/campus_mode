from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict


class CustomRule(BaseModel):
    """Company-specific eligibility rule with required justification."""
    type: str
    params: Dict[str, Any] = Field(default_factory=dict)
    justification: str


class EligibilityRules(BaseModel):
    """
    Structured eligibility filters applied at shortlist time.

    Demographic fields (`gender_restriction`) carry a compliance burden:
    if set, `gender_restriction_justification` is REQUIRED (validated at
    route level). See PRD Section 9 (Ethical & Compliance Design).
    """
    min_cgpa: Optional[float] = None
    max_active_backlogs: Optional[int] = None
    max_total_backlogs: Optional[int] = None
    allowed_branches: List[str] = Field(default_factory=list)
    allowed_years: List[int] = Field(default_factory=list)
    gender_restriction: Optional[str] = None
    gender_restriction_justification: Optional[str] = None
    location_flexibility_required: bool = False
    custom_rules: List[CustomRule] = Field(default_factory=list)


class DriveBase(BaseModel):
    role: str
    jd_text: Optional[str] = None
    ctc_offered: Optional[float] = None
    location: Optional[str] = None
    job_type: Optional[Literal["full_time", "internship", "ppi", "other"]] = "full_time"
    scheduled_date: Optional[date] = None


class DriveCreate(DriveBase):
    college_id: str
    company_id: str
    eligibility_rules: EligibilityRules = Field(default_factory=EligibilityRules)


class DriveUpdate(BaseModel):
    role: Optional[str] = None
    jd_text: Optional[str] = None
    ctc_offered: Optional[float] = None
    location: Optional[str] = None
    job_type: Optional[Literal["full_time", "internship", "ppi", "other"]] = None
    eligibility_rules: Optional[EligibilityRules] = None
    status: Optional[Literal["upcoming", "in_progress", "closed", "cancelled"]] = None
    scheduled_date: Optional[date] = None


class Drive(DriveBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    college_id: Optional[str] = None
    company_id: Optional[str] = None
    jd_parsed: Dict[str, Any] = Field(default_factory=dict)
    eligibility_rules: EligibilityRules = Field(default_factory=EligibilityRules)
    status: str = "upcoming"
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
