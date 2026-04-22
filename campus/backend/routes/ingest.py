"""
Bulk resume ingest endpoint — two-phase pipeline.

POST /api/campus/ingest           spawn Phase A (regex, parallel, ~10s for 150)
                                  → chains into Phase B (LLM, sequential,
                                  ~30-40 min for 150 at Groq 30 RPM).
                                  Returns 202 immediately with job_id.
GET  /api/campus/ingest/{job_id}  poll status/progress with phase counters.

Schema compromise: we don't add new DB columns. The existing integer columns
(`processed`, `succeeded`, `failed`) are reinterpreted as:
    processed  →  regex_completed  (Phase A done)
    succeeded  →  llm_enriched     (Phase B successes)
    failed     →  llm_failed + phase-A failures (additive)
The GET endpoint translates these back into explicit `regex_completed` and
`llm_enriched` keys so the frontend can display dual progress bars without
knowing about the mapping. Also adds a `phase` field so the UI can show the
right label ("Quick parsing…" vs "AI enriching…").
"""
from __future__ import annotations

from typing import List, Any, Dict
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
import asyncio

from ..db import T_INGEST, insert, select_one
from ..services.profile_enricher import ResumeFile, run_ingest_job
from ..services.demo_store import is_demo
from ..services.campus_audit import safe_log


router = APIRouter(prefix="/api/campus/ingest", tags=["campus:ingest"])


MAX_BATCH = 150


def _schedule(job_id: str, college_id: str, resumes: List[ResumeFile]) -> None:
    """Run the async two-phase ingest coroutine from a sync BackgroundTask.
    Emits an audit event at completion with the final job status."""
    try:
        asyncio.run(run_ingest_job(job_id, college_id, resumes))
    finally:
        try:
            row = select_one(T_INGEST, {"id": job_id}) or {}
            safe_log(
                college_id=college_id,
                action="ingest_complete",
                target_type="ingest_job",
                target_id=job_id,
                details={
                    "status": row.get("status"),
                    "succeeded": row.get("succeeded"),
                    "failed": row.get("failed"),
                    "total": row.get("total"),
                },
            )
        except Exception:
            pass


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
        "phase": "regex",  # frontend starts in Phase A mode
    }


def _derive_phase(row: Dict[str, Any]) -> str:
    """Infer which phase the job is currently in from its counters + status.

    Rules:
        - terminal status (completed/failed/cancelled) → "done"
        - regex_completed < total → "regex" (Phase A running)
        - regex_completed == total but llm_enriched < regex → "llm" (Phase B)
        - otherwise → "done"
    """
    status = row.get("status") or "queued"
    if status in ("completed", "failed", "cancelled"):
        return "done"
    total = int(row.get("total") or 0)
    regex_completed = int(row.get("processed") or 0)
    llm_enriched = int(row.get("succeeded") or 0)
    if regex_completed < total:
        return "regex"
    if llm_enriched < regex_completed:
        return "llm"
    return "done"


@router.get("/{job_id}")
async def get_job(job_id: str):
    row = select_one(T_INGEST, {"id": job_id})
    if not row:
        raise HTTPException(status_code=404, detail="Ingest job not found")

    # Re-interpret the existing columns for the frontend. We keep the raw
    # fields (processed/succeeded/failed) for backward-compat with any tools
    # that scrape this endpoint, but add explicit phase counters.
    regex_completed = int(row.get("processed") or 0)
    llm_enriched = int(row.get("succeeded") or 0)
    total = int(row.get("total") or 0)
    # `failed` column aggregates phase-A + phase-B failures — we can't cleanly
    # split them without a migration, so expose both the total and let the UI
    # label it "Failed" without specifying which phase.
    failed_total = int(row.get("failed") or 0)

    return {
        **row,
        "regex_completed": regex_completed,
        "llm_enriched": llm_enriched,
        "llm_pending": max(regex_completed - llm_enriched - max(failed_total - (total - regex_completed), 0), 0),
        "phase": _derive_phase(row),
    }
