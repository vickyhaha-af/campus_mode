from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ProfileEnriched(BaseModel):
    """LLM-extracted enrichments stored as JSONB. All fields optional."""
    skills: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    internships: List[Dict[str, Any]] = Field(default_factory=list)
    passions: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    role_fit_signals: Dict[str, Any] = Field(default_factory=dict)
    domain_preferences: List[str] = Field(default_factory=list)
    personality_hints: Dict[str, Any] = Field(default_factory=dict)
    achievement_weight: float = 0.0
    summary: str = ""


class Preferences(BaseModel):
    """Student-stated placement preferences."""
    desired_roles: List[str] = Field(default_factory=list)
    desired_locations: List[str] = Field(default_factory=list)
    desired_company_types: List[str] = Field(default_factory=list)
    min_salary: Optional[float] = None
    willingness_to_relocate: bool = True
    work_mode: Optional[str] = None  # onsite | remote | hybrid


class StudentBase(BaseModel):
    name: str
    email: str
    roll_no: Optional[str] = None
    branch: Optional[str] = None
    year: Optional[int] = None
    cgpa: Optional[float] = None
    backlogs_active: int = 0
    backlogs_cleared: int = 0
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    hometown: Optional[str] = None
    current_city: Optional[str] = None
    phone: Optional[str] = None


class StudentCreate(StudentBase):
    college_id: str
    consent_given: bool = False
    resume_text: Optional[str] = None
    profile_enriched: Optional[ProfileEnriched] = None
    preferences: Optional[Preferences] = None


class StudentUpdate(BaseModel):
    """Any subset of fields; PC-scoped override allowed."""
    name: Optional[str] = None
    email: Optional[str] = None
    roll_no: Optional[str] = None
    branch: Optional[str] = None
    year: Optional[int] = None
    cgpa: Optional[float] = None
    backlogs_active: Optional[int] = None
    backlogs_cleared: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    hometown: Optional[str] = None
    current_city: Optional[str] = None
    phone: Optional[str] = None
    placed_status: Optional[str] = None
    placed_drive_id: Optional[str] = None
    consent_given: Optional[bool] = None
    profile_enriched: Optional[ProfileEnriched] = None
    preferences: Optional[Preferences] = None


class Student(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    college_id: Optional[str] = None
    user_id: Optional[str] = None
    placed_status: str = "unplaced"
    placed_drive_id: Optional[str] = None
    consent_given: bool = False
    consent_timestamp: Optional[datetime] = None
    profile_enriched: ProfileEnriched = Field(default_factory=ProfileEnriched)
    preferences: Preferences = Field(default_factory=Preferences)
    registered_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class StudentPublic(BaseModel):
    """Redacted view for recruiter-facing endpoints (no PII like phone/DOB)."""
    id: str
    name: str
    branch: Optional[str] = None
    year: Optional[int] = None
    cgpa: Optional[float] = None
    profile_enriched: ProfileEnriched = Field(default_factory=ProfileEnriched)
