"""
Bulk resume ingest endpoint.

POST /api/campus/ingest          — uploads resumes, returns job_id (202 Accepted)
GET  /api/campus/ingest/{job_id} — polls status/progress

Pipeline runs as FastAPI BackgroundTask (safe for 60–100 resumes, ~5 min).
"""
from __future__ import annotations

from typing import List
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
import asyncio

from ..db import T_INGEST, insert, select_one
from ..services.profile_enricher import ResumeFile, run_ingest_job
from ..services.demo_store import is_demo


router = APIRouter(prefix="/api/campus/ingest", tags=["campus:ingest"])


MAX_BATCH = 150


def _schedule(job_id: str, college_id: str, resumes: List[ResumeFile]) -> None:
    """Run the async ingest coroutine from a sync BackgroundTask context."""
    asyncio.run(run_ingest_job(job_id, college_id, resumes))


@router.post("", status_code=202)
async def ingest_resumes(
    background: BackgroundTasks,
    college_id: str = Form(...),
    files: List[UploadFile] = File(...),
):
    # Demo mode has 20 pre-loaded students — ingest would 500 on FK violation
    # since the demo college only exists in-memory, not in Supabase.
    if is_demo(college_id):
        raise HTTPException(
            status_code=403,
            detail="Demo mode is read-only. 20 students are already pre-loaded. To ingest real resumes, create a college via /campus/setup first.",
        )

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > MAX_BATCH:
        raise HTTPException(status_code=413, detail=f"Max {MAX_BATCH} files per batch")

    resumes: List[ResumeFile] = []
    for f in files:
        content = await f.read()
        resumes.append(ResumeFile(filename=f.filename or "unnamed.pdf", content=content))

    job_row = insert(T_INGEST, {
        "college_id": college_id,
        "total": len(resumes),
        "status": "queued",
    })

    background.add_task(_schedule, job_row["id"], college_id, resumes)
    return {
        "job_id": job_row["id"],
        "total": len(resumes),
        "status": "queued",
    }


@router.get("/{job_id}")
async def get_job(job_id: str):
    row = select_one(T_INGEST, {"id": job_id})
    if not row:
        raise HTTPException(status_code=404, detail="Ingest job not found")
    return row
