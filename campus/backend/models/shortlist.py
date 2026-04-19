from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict


Stage = Literal[
    "shortlisted", "interview_1", "interview_2", "interview_3",
    "offered", "accepted", "joined", "rejected", "withdrawn",
]


class ShortlistBase(BaseModel):
    drive_id: str
    student_id: str
    stage: Stage = "shortlisted"
    rank: Optional[int] = None
    fit_score: Optional[float] = None
    fit_rationale: Optional[str] = None


class ShortlistCreate(ShortlistBase):
    pass


class ShortlistUpdate(BaseModel):
    stage: Optional[Stage] = None
    rank: Optional[int] = None
    fit_score: Optional[float] = None
    fit_rationale: Optional[str] = None


class Shortlist(ShortlistBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None
