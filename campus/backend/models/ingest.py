from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict


IngestJobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class IngestError(BaseModel):
    filename: str
    message: str


class IngestJob(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    college_id: Optional[str] = None
    created_by: Optional[str] = None
    total: int
    processed: int = 0
    succeeded: int = 0
    failed: int = 0
    status: IngestJobStatus = "queued"
    errors: List[IngestError] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
