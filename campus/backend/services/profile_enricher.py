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

Robustness guarantees:
    * Each resume finishes (success OR fallback) within ~5s of enrichment +
      ~5s of embedding even under worst-case Gemini outage (circuit-breaker
      open → direct regex/pseudo paths).
    * Progress is committed after every resume so the UI can show liveness.
    * Job terminates in {completed, failed, cancelled} — never stays "running".
    * Every resume that produces *any* row counts as succeeded; a job is only
      "failed" if literally zero resumes made it through.
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

# Per-step timeouts in seconds. Generous enough for a fast Gemini response but
# short enough that a hung call never blocks the pipeline for more than ~5s.
ENRICH_TIMEOUT_SEC = 6.0     # 5s Gemini budget + 1s slack for JSON parse / limiter
EMBED_TIMEOUT_SEC = 6.0      # same idea, 3 embed calls fan out to pseudo if slow
EXTRACT_TIMEOUT_SEC = 10.0   # PDF extraction can legitimately take a few seconds


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

async def _enrich_with_fallback(text: str) -> Dict[str, Any]:
    """Run the rich enricher with a hard timeout; on timeout, synthesise a
    regex-only fallback directly (bypassing Gemini entirely)."""
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(extract_rich_profile, text),
            timeout=ENRICH_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError:
        # Import here to avoid a top-level import cycle risk; also keeps the
        # "normal path" clean from the fallback helper.
        from .enricher_llm import _fallback_with_text
        rich = _fallback_with_text(text)
        rich["_fallback_reason"] = "enrich_timeout"
        return rich


async def _embed_with_fallback(
    skills_text: str,
    projects_text: str,
    summary_text: str,
) -> Dict[str, Optional[List[float]]]:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(embed_profile_texts, skills_text, projects_text, summary_text),
            timeout=EMBED_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError:
        from .campus_embedder import _pseudo
        return {
            "skills": _pseudo(skills_text) if skills_text else None,
            "projects": _pseudo(projects_text) if projects_text else None,
            "summary": _pseudo(summary_text) if summary_text else None,
        }


async def _process_one(
    job_id: str,
    college_id: str,
    rf: ResumeFile,
    resume_idx: int,
) -> Tuple[bool, Optional[str]]:
    short_jid = job_id[:8]

    # ---- 1. Extract text ----
    try:
        text = await asyncio.wait_for(
            asyncio.to_thread(extract_text, rf.content, rf.filename),
            timeout=EXTRACT_TIMEOUT_SEC,
        )
    except Exception as e:
        return False, f"extract_text: {e}"

    # ---- 2. Enrich (Gemini or regex fallback) ----
    try:
        await asyncio.wait_for(ENRICH_LIMITER.acquire(), timeout=2.0)
    except asyncio.TimeoutError:
        # Limiter backpressure too long — skip the wait and go direct.
        pass
    rich = await _enrich_with_fallback(text)
    fallback_reason = rich.pop("_fallback_reason", None)

    # ---- 3. Embed (Gemini or pseudo fallback) ----
    try:
        await asyncio.wait_for(EMBED_LIMITER.acquire(n=3), timeout=2.0)
    except asyncio.TimeoutError:
        pass
    try:
        emb = await _embed_with_fallback(
            rich.get("skills_text") or ", ".join(rich.get("skills") or []),
            rich.get("projects_text") or "",
            rich.get("summary_text") or rich.get("summary") or "",
        )
    except Exception as e:  # noqa: BLE001
        emb = {"skills": None, "projects": None, "summary": None}
        print(f"[ingest {short_jid}] embed fail on {rf.filename}: {e}")

    # ---- 4. Build row and upsert ----
    row = _rich_to_student_row(college_id, rich, text, rf.filename)
    row["embedding_skills"] = emb.get("skills")
    row["embedding_projects"] = emb.get("projects")
    row["embedding_summary"] = emb.get("summary")

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

    # ---- 5. Per-resume log line ----
    mode = "llm" if not fallback_reason else "regex-fallback"
    skills_n = len(rich.get("skills") or [])
    projects_n = len(rich.get("projects") or [])
    reason_str = f" (reason: {fallback_reason})" if fallback_reason else ""
    print(
        f"[ingest {short_jid}] resume {resume_idx}: {mode}{reason_str} "
        f"— extracted {skills_n} skills, {projects_n} projects"
    )
    return True, None


async def run_ingest_job(
    job_id: str,
    college_id: str,
    resumes: List[ResumeFile],
) -> None:
    await _update_job(job_id, status="running")
    succeeded = 0
    failed = 0
    short_jid = job_id[:8]

    try:
        for idx, rf in enumerate(resumes, start=1):
            ok: bool
            err: Optional[str]
            try:
                ok, err = await _process_one(job_id, college_id, rf, idx)
            except Exception as e:  # noqa: BLE001
                ok, err = False, f"unhandled: {e}"
                traceback.print_exc()

            if ok:
                succeeded += 1
            else:
                failed += 1
                if err:
                    await _record_error(job_id, rf.filename, err)
                    print(f"[ingest {short_jid}] resume {idx}: FAILED — {err}")

            # Commit progress after every resume so the UI polls see liveness,
            # even under partial failure. Exceptions here are swallowed inside
            # _update_job so they can never stall the loop.
            await _update_job(
                job_id,
                processed=succeeded + failed,
                succeeded=succeeded,
                failed=failed,
            )

        # Terminal status: partial success still counts as completed; a job is
        # only "failed" if every single resume was lost.
        if succeeded == 0 and failed > 0:
            final = "failed"
        else:
            final = "completed"
    except asyncio.CancelledError:
        await _update_job(
            job_id,
            status="cancelled",
            processed=succeeded + failed,
            succeeded=succeeded,
            failed=failed,
        )
        raise
    except Exception as e:  # noqa: BLE001
        # Unexpected driver failure — mark failed so the job row never lingers
        # in "running" forever.
        traceback.print_exc()
        await _record_error(job_id, "__driver__", f"driver: {e}")
        await _update_job(
            job_id,
            status="failed",
            processed=succeeded + failed,
            succeeded=succeeded,
            failed=failed,
        )
        print(f"[ingest {short_jid}] driver crashed: {e}")
        return

    await _update_job(job_id, status=final)
    print(f"[ingest {short_jid}] done: {succeeded} ok, {failed} failed (status={final})")
