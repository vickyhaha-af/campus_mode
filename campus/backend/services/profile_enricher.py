"""
Bulk resume ingest → student profile pipeline.

Flow per resume file:
    1. extract_text (local, PDF/DOCX)
    2. enricher_llm.extract_rich_profile — ONE Gemini Flash call extracts
       identity + academics + skills + projects + passions + personality +
       role_fit + summary + embedding-ready text surfaces.
    3. campus_embedder.embed_profile_texts — vectors for skills / projects / summary
    4. upsert into campus_students (full-replace semantics per PRD decision #4)
    5. update campus_ingest_jobs counters

Email handling: email is extracted from the resume by the LLM. If the LLM
can't find one, we synthesise a uniqueness-preserving placeholder of the
form `pending+<sanitised-filename>@placeholder.local`. PC sees these in the
dashboard and can fix them in v1.
"""
from __future__ import annotations

import asyncio
import re
import traceback
from typing import Any, Dict, List, Optional, Tuple

from services.file_handler import extract_text  # type: ignore  (parent backend)

from ..db import (
    T_STUDENTS, T_INGEST,
    insert, select_one, update, raw_client,
)
from .enricher_llm import extract_rich_profile
from .campus_embedder import embed_profile_texts
from .rate_limiter import TokenBucket


# Gemini free-tier: Flash is 15 RPM — one enrich call per resume. Leave 1 RPM headroom.
ENRICH_LIMITER = TokenBucket(rate_per_minute=14, capacity=14)
# Embedding API quota is much higher (150+ RPM). 3 embeds per resume.
EMBED_LIMITER = TokenBucket(rate_per_minute=120, capacity=120)


class ResumeFile:
    __slots__ = ("filename", "content")
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content


# ---------- job state helpers ----------

async def _update_job(job_id: str, **fields: Any) -> None:
    try:
        await asyncio.to_thread(update, T_INGEST, job_id, fields)
    except Exception as e:
        print(f"[ingest {job_id[:8]}] job update failed: {e}")


async def _record_error(job_id: str, filename: str, message: str) -> None:
    try:
        job = await asyncio.to_thread(select_one, T_INGEST, {"id": job_id})
        existing = (job or {}).get("errors") or []
        existing.append({"filename": filename, "message": message[:500]})
        await asyncio.to_thread(update, T_INGEST, job_id, {"errors": existing})
    except Exception as e:
        print(f"[ingest {job_id[:8]}] error record failed: {e}")


# ---------- payload construction ----------

def _rich_to_student_row(
    college_id: str,
    rich: Dict[str, Any],
    raw_text: str,
    filename: str,
) -> Dict[str, Any]:
    """Map the rich LLM output onto the campus_students row shape."""
    email = (rich.get("email") or "").strip().lower()
    if not email or "@" not in email:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", filename.rsplit(".", 1)[0])[:60]
        email = f"pending+{safe}@placeholder.local"

    enriched = {
        "skills": rich.get("skills") or [],
        "projects": rich.get("projects") or [],
        "internships": rich.get("internships") or [],
        "passions": rich.get("passions") or [],
        "interests": rich.get("interests") or [],
        "achievements": rich.get("achievements") or [],
        "certifications": rich.get("certifications") or [],
        "role_fit_signals": rich.get("role_fit_signals") or {},
        "domain_preferences": rich.get("domain_preferences") or [],
        "personality_hints": rich.get("personality_hints") or {},
        "achievement_weight": float(rich.get("achievement_weight") or 0.0),
        "summary": rich.get("summary") or "",
    }

    row: Dict[str, Any] = {
        "college_id": college_id,
        "name": rich.get("name") or filename,
        "email": email,
        "roll_no": rich.get("roll_no") or None,
        "branch": rich.get("branch") or None,
        "year": rich.get("year"),
        "cgpa": rich.get("cgpa"),
        "backlogs_active": int(rich.get("backlogs_active") or 0),
        "backlogs_cleared": int(rich.get("backlogs_cleared") or 0),
        "hometown": rich.get("hometown") or None,
        "current_city": rich.get("current_city") or None,
        "phone": rich.get("phone") or None,
        "resume_text": raw_text[:20000],
        "profile_enriched": enriched,
    }
    dob = (rich.get("date_of_birth") or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", dob):
        row["date_of_birth"] = dob
    return {k: v for k, v in row.items() if v is not None and v != ""}


# ---------- per-resume pipeline ----------

async def _process_one(
    job_id: str,
    college_id: str,
    rf: ResumeFile,
) -> Tuple[bool, Optional[str]]:
    try:
        text = await asyncio.to_thread(extract_text, rf.content, rf.filename)
    except Exception as e:
        return False, f"extract_text: {e}"

    try:
        await ENRICH_LIMITER.acquire()
        rich = await asyncio.to_thread(extract_rich_profile, text)
    except Exception as e:
        return False, f"enrich: {e}"

    try:
        await EMBED_LIMITER.acquire(n=3)
        emb = await asyncio.to_thread(
            embed_profile_texts,
            rich.get("skills_text") or ", ".join(rich.get("skills") or []),
            rich.get("projects_text") or "",
            rich.get("summary_text") or rich.get("summary") or "",
        )
    except Exception as e:
        emb = {"skills": None, "projects": None, "summary": None}
        print(f"[ingest {job_id[:8]}] embed fail on {rf.filename}: {e}")

    row = _rich_to_student_row(college_id, rich, text, rf.filename)
    row["embedding_skills"] = emb.get("skills")
    row["embedding_projects"] = emb.get("projects")
    row["embedding_summary"] = emb.get("summary")

    # Full-replace on (college_id, email) — PRD decision #4.
    try:
        existing = await asyncio.to_thread(
            select_one, T_STUDENTS,
            {"college_id": college_id, "email": row["email"]},
        )
        if existing:
            client = raw_client()
            await asyncio.to_thread(
                lambda: client.table(T_STUDENTS).delete().eq("id", existing["id"]).execute()
            )
        await asyncio.to_thread(insert, T_STUDENTS, row)
    except Exception as e:
        return False, f"db_insert: {e}"

    return True, None


async def run_ingest_job(
    job_id: str,
    college_id: str,
    resumes: List[ResumeFile],
) -> None:
    await _update_job(job_id, status="running")
    succeeded = 0
    failed = 0

    for rf in resumes:
        try:
            ok, err = await _process_one(job_id, college_id, rf)
        except Exception as e:
            ok, err = False, f"unhandled: {e}"
            traceback.print_exc()

        if ok:
            succeeded += 1
        else:
            failed += 1
            if err:
                await _record_error(job_id, rf.filename, err)

        await _update_job(
            job_id,
            processed=succeeded + failed,
            succeeded=succeeded,
            failed=failed,
        )

    if failed == 0:
        final = "completed"
    elif succeeded == 0:
        final = "failed"
    else:
        final = "completed"  # partial success still counts as completed; errors array tells the story
    await _update_job(job_id, status=final)
    print(f"[ingest {job_id[:8]}] done: {succeeded} ok, {failed} failed")
