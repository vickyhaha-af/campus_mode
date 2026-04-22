"""
Two-phase bulk resume ingest pipeline.

Problem: Groq free-tier is 30 RPM. Sequential LLM extraction of 150 resumes
takes ~40 min, which is a brutal UX ("upload, then wait 40 min to see
anything"). Gemini key is exhausted, and there's no budget for a paid tier.

Solution: Split ingest into TWO phases, with distinct latency budgets.

    PHASE A — Instant regex insert (parallel, ~10-15s for 150 resumes)
        1. extract_text (PDF/DOCX, ~200ms)
        2. _fallback_with_text (rich regex extractor in enricher_llm — already
           produces ~23 fields: name, email, phone, branch, CGPA, skills,
           projects, internships, achievements, certifications, domain_prefs)
        3. Upsert into campus_students with profile_enriched.enrichment_status
           = "regex" and enriched_at = null
        4. Increment regex_completed counter

        Concurrency: asyncio.gather with a semaphore of 10 for DB-write
        politeness. No LLM calls — so no rate-limit backpressure.

    PHASE B — Background LLM enrichment (sequential, ~30-40 min for 150)
        1. Load student row
        2. Call extract_rich_profile (Groq LLM, ~2s + rate-limit wait)
        3. Call embed_profile_texts
        4. Update row with profile_enriched.enrichment_status = "llm_enriched",
           enriched_at = <ISO>, merge richer fields (preserving any PC-made
           manual edits via a shallow per-field merge)
        5. Persist embeddings to vector columns
        6. Increment llm_enriched counter
        7. On LLM failure: mark enrichment_status = "failed", increment
           llm_failed, move on — never break the flow.

        Cadence: 2s gap between Groq calls to stay within 30 RPM free tier.

During Phase B the job stays in status="running". UI polls the progress
endpoint and shows BOTH counters (Phase A bar typically completes in
seconds, Phase B bar fills over ~30 min).

Schema compromise
-----------------
campus_ingest_jobs has columns {processed, succeeded, failed, errors} and no
dedicated phase-tracking column. Rather than add a migration, we reuse:
    processed  →  regex_completed  (Phase A count)
    succeeded  →  llm_enriched     (Phase B successes)
    failed     →  llm_failed + any phase-A failures
The GET endpoint surfaces explicit `regex_completed`, `llm_enriched`,
`llm_failed` keys derived from these columns so the frontend doesn't have
to know about the mapping.

Per-student enrichment state lives in campus_students.profile_enriched
(JSONB) under three keys:
    enrichment_status          "regex" | "llm_enriched" | "failed"
    enriched_at                ISO timestamp (null until Phase B completes)
    enrichment_attempted_count int (increments each Phase B attempt)

Legacy rows without enrichment_status are treated as "llm_enriched" in the
UI (they went through the old single-phase pipeline which was LLM-first).
"""
from __future__ import annotations

import asyncio
import re
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from services.file_handler import extract_text  # type: ignore  (parent backend)

from ..db import (
    T_STUDENTS, T_INGEST,
    insert, select_one, update, raw_client,
)
from .enricher_llm import extract_rich_profile, _fallback_with_text
from .campus_embedder import embed_profile_texts
from .rate_limiter import TokenBucket


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------
#
# Phase A: regex-only, no LLM. Bottleneck is DB writes → limit concurrency to
# 10 parallel workers so we don't hammer Supabase.
PHASE_A_CONCURRENCY = 10

# Phase B: Groq free-tier is 30 RPM = one call every 2s. We sleep 2s between
# resumes regardless of processing time to stay under the limit even if Groq
# responds in 500ms. Embedding call is unrelated (Gemini embed API, higher
# quota) and handled inside embed_profile_texts.
PHASE_B_MIN_GAP_SEC = 2.0

# Per-step timeouts — same spirit as before but Phase B has more slack since
# rate-limit waits are expected (not an error).
ENRICH_TIMEOUT_SEC = 10.0
EMBED_TIMEOUT_SEC = 8.0
EXTRACT_TIMEOUT_SEC = 10.0

# Rate limiter kept around for legacy callers & embed throttling.
EMBED_LIMITER = TokenBucket(rate_per_minute=120, capacity=120)


class ResumeFile:
    __slots__ = ("filename", "content")
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content


# ===========================================================================
# Job-state helpers
# ===========================================================================

async def _update_job(job_id: str, **fields: Any) -> None:
    try:
        await asyncio.to_thread(update, T_INGEST, job_id, fields)
    except Exception as e:
        print(f"[ingest {job_id[:8]}] job update failed: {e}")


async def _record_error(job_id: str, filename: str, message: str) -> None:
    try:
        job = await asyncio.to_thread(select_one, T_INGEST, {"id": job_id})
        existing = (job or {}).get("errors") or []
        # `errors` is a JSONB array per schema — append only dicts that look
        # like error records. We never stash counters here; those live in
        # the existing processed/succeeded/failed columns.
        existing.append({"filename": filename, "message": message[:500]})
        await asyncio.to_thread(update, T_INGEST, job_id, {"errors": existing})
    except Exception as e:
        print(f"[ingest {job_id[:8]}] error record failed: {e}")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ===========================================================================
# Row construction
# ===========================================================================

def _safe_email(rich: Dict[str, Any], filename: str) -> str:
    email = (rich.get("email") or "").strip().lower()
    if email and "@" in email:
        return email
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", filename.rsplit(".", 1)[0])[:60]
    return f"pending+{safe}@placeholder.local"


def _rich_to_enriched_blob(rich: Dict[str, Any]) -> Dict[str, Any]:
    """Map rich extractor output → the `profile_enriched` JSONB payload.

    Does NOT set enrichment_status / enriched_at — those belong to the caller
    because they differ between Phase A (regex) and Phase B (llm_enriched).
    """
    return {
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


def _rich_to_student_row(
    college_id: str,
    rich: Dict[str, Any],
    raw_text: str,
    filename: str,
    *,
    enrichment_status: str,
    enriched_at: Optional[str],
    attempt_count: int,
) -> Dict[str, Any]:
    """Map extractor output onto a campus_students row for insert/update."""
    enriched = _rich_to_enriched_blob(rich)
    enriched["enrichment_status"] = enrichment_status
    enriched["enriched_at"] = enriched_at
    enriched["enrichment_attempted_count"] = attempt_count

    row: Dict[str, Any] = {
        "college_id": college_id,
        "name": rich.get("name") or filename,
        "email": _safe_email(rich, filename),
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


# ===========================================================================
# PHASE A — Instant regex insert
# ===========================================================================

async def _phase_a_one(
    job_id: str,
    college_id: str,
    rf: ResumeFile,
    semaphore: asyncio.Semaphore,
    counters: Dict[str, int],
    lock: asyncio.Lock,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """Process a single resume through the regex-only fast path.

    Returns (ok, error_message, student_id). student_id is the DB row id so
    Phase B can pick up where we left off without re-scanning the table.
    """
    async with semaphore:
        short_jid = job_id[:8]

        # ---- 1. Extract text ----
        try:
            text = await asyncio.wait_for(
                asyncio.to_thread(extract_text, rf.content, rf.filename),
                timeout=EXTRACT_TIMEOUT_SEC,
            )
        except Exception as e:
            return False, f"extract_text: {e}", None

        # ---- 2. Regex extract (zero LLM calls) ----
        # _fallback_with_text is pure-python regex; no timeout needed, but wrap
        # in to_thread so we don't accidentally block the loop on big PDFs.
        try:
            rich = await asyncio.to_thread(_fallback_with_text, text)
        except Exception as e:
            return False, f"regex_extract: {e}", None

        # ---- 3. Build row & upsert ----
        row = _rich_to_student_row(
            college_id, rich, text, rf.filename,
            enrichment_status="regex",
            enriched_at=None,
            attempt_count=0,
        )

        try:
            existing = await asyncio.to_thread(
                select_one, T_STUDENTS,
                {"college_id": college_id, "email": row["email"]},
            )
            if existing:
                # Update path — preserve PC-made edits by merging instead of
                # replacing. For Phase A we're intentionally lossy on fields
                # we might have *weaker* data for: only overwrite resume_text
                # and profile_enriched; keep existing name/email/cgpa/branch
                # if they were already set by a previous enrichment.
                client = raw_client()
                merged_enriched = _merge_enriched(
                    existing.get("profile_enriched") or {},
                    row["profile_enriched"],
                    prefer_existing_llm=True,
                )
                update_payload: Dict[str, Any] = {
                    "resume_text": row["resume_text"],
                    "profile_enriched": merged_enriched,
                }
                # Only fill in missing scalars from the regex parse — don't
                # overwrite LLM-derived values or PC edits.
                for k in ("name", "roll_no", "branch", "year", "cgpa",
                          "phone", "hometown", "current_city"):
                    if k in row and not existing.get(k):
                        update_payload[k] = row[k]
                await asyncio.to_thread(
                    lambda: client.table(T_STUDENTS)
                    .update(update_payload).eq("id", existing["id"]).execute()
                )
                student_id = existing["id"]
            else:
                created = await asyncio.to_thread(insert, T_STUDENTS, row)
                student_id = created["id"]
        except Exception as e:
            return False, f"db_insert: {e}", None

        # ---- 4. Update counters (under lock to avoid races) ----
        async with lock:
            counters["regex_completed"] += 1
            completed = counters["regex_completed"]
            failed = counters["regex_failed"]
        # Write every N or on each resume? We commit on each resume for
        # liveness — 150 writes is cheap, and the UI needs the steady drip.
        await _update_job(
            job_id,
            processed=completed,
            failed=failed,  # Phase A failures count here too, additively
        )

        skills_n = len(rich.get("skills") or [])
        projects_n = len(rich.get("projects") or [])
        print(
            f"[ingest {short_jid}] phase-A {rf.filename}: "
            f"regex — {skills_n} skills, {projects_n} projects"
        )
        return True, None, student_id


def _merge_enriched(
    existing: Dict[str, Any],
    fresh: Dict[str, Any],
    *,
    prefer_existing_llm: bool,
) -> Dict[str, Any]:
    """Shallow merge two profile_enriched blobs.

    If `prefer_existing_llm` is True and the existing row has
    enrichment_status == "llm_enriched", we keep its list/dict fields and
    only take NEW fields from `fresh`. This protects manual PC edits.
    Otherwise `fresh` wins (the caller is upgrading a regex row).
    """
    if prefer_existing_llm and existing.get("enrichment_status") == "llm_enriched":
        merged = dict(existing)
        for k, v in fresh.items():
            if k not in merged or merged.get(k) in (None, "", [], {}):
                merged[k] = v
        # The newer attempt_count on fresh should still win so we track retries.
        if "enrichment_attempted_count" in fresh:
            merged["enrichment_attempted_count"] = fresh["enrichment_attempted_count"]
        return merged
    return {**existing, **fresh}


async def run_phase_a(
    job_id: str,
    college_id: str,
    resumes: List[ResumeFile],
) -> Tuple[List[str], int, int]:
    """Run Phase A over all resumes in parallel. Returns (student_ids, ok, fail)."""
    short_jid = job_id[:8]
    print(f"[ingest {short_jid}] phase A start — {len(resumes)} resumes")

    await _update_job(job_id, status="running")

    semaphore = asyncio.Semaphore(PHASE_A_CONCURRENCY)
    counters = {"regex_completed": 0, "regex_failed": 0}
    lock = asyncio.Lock()

    async def _wrapped(rf: ResumeFile):
        try:
            return await _phase_a_one(job_id, college_id, rf, semaphore, counters, lock)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            return False, f"unhandled: {e}", None

    results = await asyncio.gather(*[_wrapped(rf) for rf in resumes])

    student_ids: List[str] = []
    ok = 0
    fail = 0
    for (success, err, sid), rf in zip(results, resumes):
        if success and sid:
            student_ids.append(sid)
            ok += 1
        else:
            fail += 1
            if err:
                await _record_error(job_id, rf.filename, f"phase-A: {err}")
                # Account for phase-A failures in the shared counter.
                async with lock:
                    counters["regex_failed"] += 1

    await _update_job(
        job_id,
        processed=ok,
        failed=counters["regex_failed"],
    )
    print(
        f"[ingest {short_jid}] phase A done — {ok} regex-inserted, "
        f"{fail} failed (took ~parallel, {PHASE_A_CONCURRENCY}-wide)"
    )
    return student_ids, ok, fail


# ===========================================================================
# PHASE B — Background LLM enrichment (sequential, rate-limited)
# ===========================================================================

async def _phase_b_one(student_id: str) -> Tuple[bool, Optional[str]]:
    """Enrich a single student via Groq LLM + embeddings.

    Returns (ok, error_message). A failure here is non-fatal — we mark the
    student's enrichment_status='failed' and the caller moves on.
    """
    try:
        row = await asyncio.to_thread(select_one, T_STUDENTS, {"id": student_id})
    except Exception as e:
        return False, f"load: {e}"
    if not row:
        return False, "student row vanished"

    existing_enriched = row.get("profile_enriched") or {}
    attempt = int(existing_enriched.get("enrichment_attempted_count") or 0) + 1
    resume_text = row.get("resume_text") or ""
    if not resume_text.strip():
        # Nothing to enrich — mark as failed so we don't retry forever.
        existing_enriched["enrichment_status"] = "failed"
        existing_enriched["enrichment_attempted_count"] = attempt
        await asyncio.to_thread(
            update, T_STUDENTS, student_id,
            {"profile_enriched": existing_enriched},
        )
        return False, "empty resume_text"

    # ---- Call Groq (with timeout + built-in fallback to regex) ----
    try:
        rich = await asyncio.wait_for(
            asyncio.to_thread(extract_rich_profile, resume_text),
            timeout=ENRICH_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError:
        rich = None
    except Exception as e:  # noqa: BLE001
        return False, f"enrich: {e}"

    if not rich:
        # Timeout — leave the regex data in place and mark failed.
        existing_enriched["enrichment_status"] = "failed"
        existing_enriched["enrichment_attempted_count"] = attempt
        await asyncio.to_thread(
            update, T_STUDENTS, student_id,
            {"profile_enriched": existing_enriched},
        )
        return False, "llm timeout"

    # If extract_rich_profile fell back to regex (LLM unavailable), the dict
    # carries _fallback_reason. In that case don't promote the status to
    # llm_enriched — we want the UI to keep showing "Quick" until real LLM
    # data lands.
    fallback_reason = rich.pop("_fallback_reason", None)
    status = "llm_enriched" if not fallback_reason else "failed"

    # ---- Embeddings (best-effort — never block enrichment on an embed fail) ----
    try:
        await asyncio.wait_for(EMBED_LIMITER.acquire(n=3), timeout=2.0)
    except asyncio.TimeoutError:
        pass
    emb: Dict[str, Optional[List[float]]]
    try:
        emb = await asyncio.wait_for(
            asyncio.to_thread(
                embed_profile_texts,
                rich.get("skills_text") or ", ".join(rich.get("skills") or []),
                rich.get("projects_text") or "",
                rich.get("summary_text") or rich.get("summary") or "",
            ),
            timeout=EMBED_TIMEOUT_SEC,
        )
    except Exception:  # noqa: BLE001
        emb = {"skills": None, "projects": None, "summary": None}

    # ---- Build merged enriched blob, preserving any existing fields ----
    fresh_blob = _rich_to_enriched_blob(rich)
    fresh_blob["enrichment_status"] = status
    fresh_blob["enriched_at"] = _now_iso() if status == "llm_enriched" else existing_enriched.get("enriched_at")
    fresh_blob["enrichment_attempted_count"] = attempt

    merged = _merge_enriched(existing_enriched, fresh_blob, prefer_existing_llm=False)
    # For an LLM upgrade we intentionally OVERWRITE the enriched fields — the
    # regex data was a placeholder. But we still keep any enrichment_status
    # ordering and respect that this is now the authoritative data.
    merged["enrichment_status"] = status
    merged["enriched_at"] = fresh_blob["enriched_at"]
    merged["enrichment_attempted_count"] = attempt

    # ---- Scalar fields: fill in missing-only, never overwrite existing ----
    #
    # If the PC edited `branch` to "IPM" manually between phases, we must not
    # clobber it with whatever Groq produced. Merge strategy:
    #   - existing has value → keep existing
    #   - existing blank → take from rich
    update_payload: Dict[str, Any] = {"profile_enriched": merged}
    for k in ("name", "roll_no", "branch", "year", "cgpa",
              "backlogs_active", "backlogs_cleared",
              "phone", "hometown", "current_city"):
        fresh_val = rich.get(k)
        if fresh_val in (None, "", 0) and k not in ("backlogs_active", "backlogs_cleared"):
            continue
        if row.get(k) in (None, "", 0) and k not in ("backlogs_active", "backlogs_cleared"):
            update_payload[k] = fresh_val
        elif k in ("backlogs_active", "backlogs_cleared") and row.get(k) == 0:
            # Backlogs are meaningful as 0 only when confirmed — take the
            # fresh number if the row's current value is the default.
            update_payload[k] = int(fresh_val or 0)

    # Embeddings always overwrite — they're deterministic over resume_text.
    if emb.get("skills") is not None:
        update_payload["embedding_skills"] = emb["skills"]
    if emb.get("projects") is not None:
        update_payload["embedding_projects"] = emb["projects"]
    if emb.get("summary") is not None:
        update_payload["embedding_summary"] = emb["summary"]

    try:
        await asyncio.to_thread(update, T_STUDENTS, student_id, update_payload)
    except Exception as e:
        return False, f"db_update: {e}"

    if status != "llm_enriched":
        return False, f"llm fallback ({fallback_reason})"
    return True, None


async def run_phase_b(
    job_id: str,
    student_ids: List[str],
    *,
    phase_a_fail_count: int,
) -> None:
    """Walk every Phase-A student row and run the LLM enricher, sequentially.

    Respects Groq free tier: 2s minimum gap between calls (30 RPM).
    Each call sleeps enough wall-clock time to stay under the limit even
    when the LLM responds fast. Failures don't abort the loop.
    """
    short_jid = job_id[:8]
    print(f"[ingest {short_jid}] phase B start — {len(student_ids)} students")

    llm_enriched = 0
    llm_failed = 0
    last_call: float = 0.0

    try:
        for idx, sid in enumerate(student_ids, start=1):
            # Pace the loop to honour Groq's 30 RPM (2s between calls).
            now = asyncio.get_event_loop().time()
            gap = now - last_call
            if last_call > 0 and gap < PHASE_B_MIN_GAP_SEC:
                await asyncio.sleep(PHASE_B_MIN_GAP_SEC - gap)

            ok: bool
            err: Optional[str]
            try:
                ok, err = await _phase_b_one(sid)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                ok, err = False, f"unhandled: {e}"
                traceback.print_exc()

            last_call = asyncio.get_event_loop().time()

            if ok:
                llm_enriched += 1
            else:
                llm_failed += 1
                if err:
                    print(f"[ingest {short_jid}] phase-B {idx}/{len(student_ids)} FAIL — {err}")
                    # Don't flood the errors column for LLM issues — Phase B
                    # failures are expected on free-tier quotas. One summary
                    # error per distinct reason is enough for the UI.
                    if llm_failed <= 5:
                        await _record_error(job_id, f"student:{sid[:8]}", f"phase-B: {err}")

            # `succeeded` column now tracks Phase B successes; `failed`
            # aggregates Phase A + Phase B failures.
            await _update_job(
                job_id,
                succeeded=llm_enriched,
                failed=phase_a_fail_count + llm_failed,
            )

    except asyncio.CancelledError:
        await _update_job(
            job_id,
            status="cancelled",
            succeeded=llm_enriched,
            failed=phase_a_fail_count + llm_failed,
        )
        raise

    print(
        f"[ingest {short_jid}] phase B done — {llm_enriched} llm-enriched, "
        f"{llm_failed} failed"
    )


# ===========================================================================
# Orchestrator
# ===========================================================================

async def run_ingest_job(
    job_id: str,
    college_id: str,
    resumes: List[ResumeFile],
) -> None:
    """Top-level two-phase driver. Called from the ingest route as a task."""
    short_jid = job_id[:8]

    try:
        student_ids, _ok_a, fail_a = await run_phase_a(job_id, college_id, resumes)
    except asyncio.CancelledError:
        raise
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        await _record_error(job_id, "__driver_phase_a__", f"phase-A driver: {e}")
        await _update_job(job_id, status="failed")
        print(f"[ingest {short_jid}] phase A crashed: {e}")
        return

    if not student_ids:
        # Phase A produced zero rows — no point doing Phase B. Mark failed
        # so the job doesn't linger as "running" forever.
        final = "failed" if fail_a > 0 else "completed"
        await _update_job(job_id, status=final)
        print(f"[ingest {short_jid}] phase A produced no rows — status={final}")
        return

    try:
        await run_phase_b(job_id, student_ids, phase_a_fail_count=fail_a)
    except asyncio.CancelledError:
        raise
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        await _record_error(job_id, "__driver_phase_b__", f"phase-B driver: {e}")
        # Phase A did succeed — don't mark the whole job failed just because
        # Phase B crashed mid-way. The regex rows are usable.
        await _update_job(job_id, status="completed")
        print(f"[ingest {short_jid}] phase B crashed: {e}")
        return

    await _update_job(job_id, status="completed")
    print(f"[ingest {short_jid}] job complete")
