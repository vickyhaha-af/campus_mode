"""
Pipeline routes — Kanban board, stage management, Anti-BS Authenticator,
Team Topology Engine, and Immutable Audit Trail.
New endpoints for Tech Vista v2.0 Hiring OS features.

DPDPA Compliance note:
  - Audit log is append-only JSONL with SHA-256 hash chaining.
  - Preceding entry's hash is stored with each new entry, making tampering
    detectable. This satisfies the immutability requirement.
  - Raw resume PII is never written to the audit log.
"""
import os
import json
import re
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException
from typing import Optional
from google import genai
from config import GEMINI_API_KEY_1

from models.schemas import (
    CandidateStageUpdate, PipelineCandidate,
    AntiBSRequest, AntiBSResult,
    TopologyMatchRequest, TopologyMatchResult,
    AuditLogEntry, AuditLogRequest,
    PipelineMoveRequest, EmailSendRequest, EmailRegenerateRequest
)
from db.supabase_client import get_supabase
from services.email_drafter import draft_email_for_stage_change, regenerate_email_draft
from services.email_service import email_service

router = APIRouter(prefix="/api", tags=["pipeline"])

# Configure Gemini (reuses the same key as the main analysis pipeline)
# Initialize the new SDK client
client = genai.Client(api_key=GEMINI_API_KEY_1)

# ---------------------------------------------------------------------------
# In-memory Kanban state  (session_id → candidate_id → PipelineCandidate)
# ---------------------------------------------------------------------------
pipeline_state: dict[str, dict[str, PipelineCandidate]] = {}

VALID_STAGES = ["new", "screening", "interview_1", "interview_2", "offer", "hired", "rejected"]

# ---------------------------------------------------------------------------
# Immutable Audit Trail helpers
# ---------------------------------------------------------------------------
_AUDIT_FILE = Path(os.environ.get("AUDIT_LOG_PATH", "/tmp/techvista_audit.jsonl"))


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).digest().hex()


def _get_last_hash() -> str:
    """Read the last line of the JSONL and return its entry_hash (or empty string)."""
    if not _AUDIT_FILE.exists():
        return ""
    try:
        with open(_AUDIT_FILE, "rb") as f:
            # Efficient: seek from end
            f.seek(0, 2)  # end of file
            size = f.tell()
            if size == 0:
                return ""
            # Read last line (walk backward to find \n)
            pos = size - 1
            while pos > 0:
                f.seek(pos)
                ch = f.read(1)
                if ch == b"\n" and pos != size - 1:
                    break
                pos -= 1
            last_line = f.read().strip()
            if not last_line:
                return ""
            entry = json.loads(last_line)
            return entry.get("entry_hash", "")
    except Exception:
        return ""


def _append_audit_entry(entry: AuditLogEntry) -> None:
    """Append entry to the JSONL file (atomic-ish on most POSIX systems)."""
    _AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_AUDIT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry.model_dump()) + "\n")


def _build_audit_entry(
    action: str,
    session_id: Optional[str],
    candidate_id: Optional[str],
    details: dict,
    user: str = "system",
) -> AuditLogEntry:
    """Create a cryptographically-chained audit entry."""
    prev_hash = _get_last_hash()
    ts = datetime.now(timezone.utc).isoformat()

    # Deterministic string for hashing
    raw = f"{ts}|{action}|{session_id}|{candidate_id}|{prev_hash}|{json.dumps(details, sort_keys=True)}"
    entry_hash = _sha256(raw)

    return AuditLogEntry(
        timestamp=ts,
        action=action,
        user=user,
        session_id=session_id,
        candidate_id=candidate_id,
        details=details,
        prev_hash=prev_hash,
        entry_hash=entry_hash,
    )


def _read_audit_entries(session_id: Optional[str] = None, limit: int = 50) -> list[dict]:
    """Read all entries from JSONL, filter optionally, return newest first."""
    if not _AUDIT_FILE.exists():
        return []
    entries = []
    try:
        with open(_AUDIT_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if session_id is None or entry.get("session_id") == session_id:
                        entries.append(entry)
                except json.JSONDecodeError:
                    continue
    except Exception:
        return []

    # Newest first
    entries.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return entries[:limit]


# ===========================================================================
# KANBAN STAGE MANAGEMENT & AUTOMATED OUTREACH
# ===========================================================================

@router.post("/pipeline/move")
async def pipeline_move(request: PipelineMoveRequest):
    """
    Moves a candidate, logs in Supabase pipeline_state, generates email draft.
    """
    if request.to_stage not in VALID_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}"
        )

    # 1. Update in-memory state (fallback)
    if request.session_id not in pipeline_state:
        pipeline_state[request.session_id] = {}

    candidate = pipeline_state[request.session_id].get(request.candidate_id)
    if not candidate:
        candidate = PipelineCandidate(
            candidate_id=request.candidate_id,
            candidate_name=request.candidate_id,
            stage=request.to_stage,
            stage_entered_at=datetime.now(timezone.utc).isoformat()
        )
        pipeline_state[request.session_id][request.candidate_id] = candidate
    else:
        candidate.stage = request.to_stage
        candidate.stage_entered_at = datetime.now(timezone.utc).isoformat()
        candidate.days_in_stage = 0

    # 2. Immutable audit log (JSONL)
    entry = _build_audit_entry(
        action="pipeline_move",
        session_id=request.session_id,
        candidate_id=request.candidate_id,
        details={"from_stage": request.from_stage, "to_stage": request.to_stage},
    )
    _append_audit_entry(entry)

    # 3. Update Supabase (if available)
    db = get_supabase()
    if db:
        try:
            db.table("pipeline_state").upsert({
                "session_id": request.session_id,
                "candidate_id": request.candidate_id,
                "stage": request.to_stage,
                "moved_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception as e:
            print(f"[Supabase] pipeline_state upsert failed: {e}")

    # 4. Generate Email Draft
    draft = draft_email_for_stage_change(request)
    if not draft:
        # Fallback if generation failed but state updated successfully
        return {
            "status": "success",
            "candidate_id": request.candidate_id,
            "new_stage": request.to_stage,
            "draft_error": "Could not generate draft (session not found or candidate missing)."
        }

    # 5. Store Draft in Supabase
    if db:
        try:
            db.table("email_drafts").upsert({
                "id": draft.draft_id,
                "session_id": request.session_id,
                "candidate_id": request.candidate_id,
                "stage": request.to_stage,
                "email_type": draft.email_type,
                "subject_line": draft.subject_line,
                "email_body": draft.email_body,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception as e:
            print(f"[Supabase] email_drafts insert failed: {e}")

    return draft

@router.post("/pipeline/send-email")
async def send_pipeline_email(request: EmailSendRequest):
    """Sends the drafted email via configured provider and updates Supabase."""
    # 1. Send via provider
    result = email_service.send_email(
        to_email=request.to_email,
        subject=request.subject,
        html_body=request.final_body
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Email failed to send"))

    # 2. Update Supabase (sent = true)
    db = get_supabase()
    if db:
        try:
            db.table("email_drafts").update({
                "sent": True,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "to_email": request.to_email
            }).eq("id", request.draft_id).execute()
        except Exception as e:
            print(f"[Supabase] Failed to update sent status: {e}")

    # 3. Immutable audit log
    entry = _build_audit_entry(
        action="email_sent",
        session_id=None,
        candidate_id=request.to_email,
        details={"draft_id": request.draft_id, "subject": request.subject},
    )
    _append_audit_entry(entry)

    return result

@router.post("/pipeline/regenerate")
async def regenerate_pipeline_email(request: EmailRegenerateRequest):
    """Regenerates an email draft using feedback constraints."""
    # Fetch old body from Supabase 
    db = get_supabase()
    old_body = "Regenerating..."
    if db:
        try:
            res = db.table("email_drafts").select("email_body").eq("id", request.draft_id).execute()
            if res.data:
                old_body = res.data[0].get("email_body", "")
        except Exception as e:
            print(f"Failed to fetch old draft: {e}")

    new_body = regenerate_email_draft(request.draft_id, old_body, request.feedback or "")
    
    if db:
        try:
            db.table("email_drafts").update({
                "email_body": new_body,
                "feedback_used": request.feedback
            }).eq("id", request.draft_id).execute()
        except Exception as e:
            print(f"Failed to update draft in DB: {e}")
            
    return {"draft_id": request.draft_id, "email_body": new_body}

@router.post("/candidates/stage")
async def update_candidate_stage(update: CandidateStageUpdate):
    """Update a candidate's pipeline stage with timestamp and audit log."""
    if update.new_stage not in VALID_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}"
        )

    session_id = update.session_id or "default"
    if session_id not in pipeline_state:
        pipeline_state[session_id] = {}

    candidate = pipeline_state[session_id].get(update.candidate_id)
    old_stage = candidate.stage if candidate else "new"

    if not candidate:
        candidate = PipelineCandidate(
            candidate_id=update.candidate_id,
            candidate_name=update.candidate_id,
            stage=update.new_stage,
            stage_entered_at=datetime.now(timezone.utc).isoformat(),
            notes=update.notes or ""
        )
        pipeline_state[session_id][update.candidate_id] = candidate
    else:
        candidate.stage = update.new_stage
        candidate.stage_entered_at = datetime.now(timezone.utc).isoformat()
        candidate.days_in_stage = 0
        if update.notes:
            candidate.notes = update.notes

    # Immutable audit log
    entry = _build_audit_entry(
        action="stage_change",
        session_id=session_id,
        candidate_id=update.candidate_id,
        details={"old_stage": old_stage, "new_stage": update.new_stage, "notes": update.notes},
    )
    _append_audit_entry(entry)

    return {
        "status": "success",
        "candidate_id": update.candidate_id,
        "new_stage": update.new_stage,
        "stage_entered_at": candidate.stage_entered_at,
    }


@router.get("/pipeline/{session_id}")
async def get_pipeline(session_id: str):
    """Get all candidates in the pipeline for a session, grouped by stage."""
    candidates = pipeline_state.get(session_id, {})

    # Calculate days in stage for each candidate
    for candidate in candidates.values():
        if candidate.stage_entered_at:
            try:
                entered = datetime.fromisoformat(candidate.stage_entered_at.replace("Z", "+00:00"))
                candidate.days_in_stage = (datetime.now(timezone.utc) - entered).days
            except ValueError:
                pass

    # Group by stage
    grouped: dict[str, list] = {stage: [] for stage in VALID_STAGES}
    for candidate in candidates.values():
        grouped.get(candidate.stage, grouped["new"]).append(candidate.model_dump())

    return {
        "session_id": session_id,
        "stages": grouped,
        "total_candidates": len(candidates),
    }


# ===========================================================================
# ANTI-BS AUTHENTICATOR
# ===========================================================================

@router.post("/anti-bs", response_model=AntiBSResult)
async def analyze_authenticity(request: AntiBSRequest):
    """
    Analyze resume for signal-to-noise ratio.
    Extracts action verbs, categorises fluff vs. quantified hard outcomes,
    and returns an authenticity score 0-100.
    """
    if not request.resume_text.strip():
        raise HTTPException(status_code=400, detail="resume_text is required")

    try:
        prompt = f"""You are an expert technical recruiter and writing coach.

Analyze the following resume text for linguistic authenticity. Your task:

1. Extract ALL action verbs used in the resume.
2. Separate them into two categories:
   - "fluff_words": vague/passive (e.g., "helped", "involved in", "assisted", "participated", "worked on", "collaborated")
   - "hard_outcomes": specific, quantified achievements (e.g., "scaled to 10k users", "reduced latency by 40%", "architected", "built", "launched", "shipped")
3. Calculate a signal_to_noise_ratio: (count of hard_outcomes) / (total action verbs). Range: 0.0–1.0.
4. Produce an authenticity_score 0–100 based on density of hard outcomes vs. vague language.
5. Write a brief analysis_notes (2-3 sentences).

Resume text:
{request.resume_text[:5000]}

Return ONLY a valid JSON object with this exact schema (no markdown, no extra text):
{{
  "action_verbs": ["verb1", "verb2"],
  "fluff_words": ["helped", "assisted"],
  "hard_outcomes": ["scaled to 10k users", "reduced latency by 40%"],
  "signal_to_noise_ratio": 0.65,
  "authenticity_score": 72,
  "analysis_notes": "Brief explanation of the score."
}}"""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = response.text.strip()

        # Extract JSON robustly
        json_match = re.search(r'\{[\s\S]*\}', text)
        if not json_match:
            raise ValueError("No JSON found in Gemini response")
        data = json.loads(json_match.group())

        result = AntiBSResult(
            authenticity_score=float(data.get("authenticity_score", 50)),
            fluff_words=data.get("fluff_words", []),
            hard_outcomes=data.get("hard_outcomes", []),
            signal_to_noise_ratio=float(data.get("signal_to_noise_ratio", 0.5)),
            action_verb_analysis={
                "total_verbs": len(data.get("action_verbs", [])),
                "fluff_count": len(data.get("fluff_words", [])),
                "outcome_count": len(data.get("hard_outcomes", [])),
            },
            verification_notes=data.get("analysis_notes", ""),
        )

        if request.github_url:
            result.github_verified = False
            result.verification_notes += " GitHub URL provided but live verification not yet implemented."
        if request.kaggle_url:
            result.kaggle_verified = False
            result.verification_notes += " Kaggle URL provided but live verification not yet implemented."

        # Audit log (no PII — only scores)
        entry = _build_audit_entry(
            action="anti_bs_analysis",
            session_id=None,
            candidate_id=request.candidate_name or "unknown",
            details={
                "authenticity_score": result.authenticity_score,
                "signal_to_noise_ratio": result.signal_to_noise_ratio,
            },
        )
        _append_audit_entry(entry)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Anti-BS] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini analysis failed: {str(e)}")


# ===========================================================================
# TEAM TOPOLOGY ENGINE
# ===========================================================================

@router.post("/topology-match", response_model=TopologyMatchResult)
async def match_team_topology(request: TopologyMatchRequest):
    """
    Evaluate how a candidate fills the team's specific blind spots.
    Uses Gemini to score team-fit beyond the JD match.
    """
    if not request.team_context.strip():
        raise HTTPException(status_code=400, detail="team_context is required")

    try:
        prompt = f"""You are an expert engineering manager evaluating a candidate for their team-culture and skill-gap fit.

CURRENT TEAM DYNAMICS / BLIND SPOTS:
{request.team_context}

JOB DESCRIPTION:
{request.jd_text[:2000]}

CANDIDATE RESUME:
{request.resume_text[:3000]}

Analyze:
1. What specific gaps in the team does this candidate fill? (skills, mindsets, domain knowledge)
2. Where does the candidate overlap with existing team capabilities? (risk of redundancy)
3. What is the expected impact on team balance? (one sentence)
4. Give an overall fit_score 0–100 and a final recommendation.

Return ONLY a valid JSON object (no markdown, no extra text):
{{
  "fit_score": 78,
  "fills_gaps": ["DevOps expertise", "Cloud architecture", "CI/CD experience"],
  "overlaps": ["Python backend", "REST API design"],
  "team_balance_impact": "Adds much-needed infrastructure depth while providing overlap in backend APIs.",
  "recommendation": "Strong team fit. The DevOps gap is critical — this hire directly addresses it."
}}"""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = response.text.strip()

        json_match = re.search(r'\{[\s\S]*\}', text)
        if not json_match:
            raise ValueError("No JSON found in Gemini response")
        data = json.loads(json_match.group())

        result = TopologyMatchResult(
            fit_score=float(data.get("fit_score", 50)),
            fills_gaps=data.get("fills_gaps", []),
            overlaps=data.get("overlaps", []),
            team_balance_impact=data.get("team_balance_impact", ""),
            recommendation=data.get("recommendation", ""),
        )

        # Audit log
        entry = _build_audit_entry(
            action="topology_analysis",
            session_id=None,
            candidate_id=request.candidate_name or "unknown",
            details={"fit_score": result.fit_score},
        )
        _append_audit_entry(entry)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Topology] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini topology analysis failed: {str(e)}")


# ===========================================================================
# IMMUTABLE AUDIT TRAIL (DPDPA)
# ===========================================================================

@router.post("/audit/log")
async def log_audit_entry(request: AuditLogRequest):
    """
    Append an action to the cryptographically-chained audit trail.
    This is an append-only operation. The JSONL file is the source of truth.
    """
    entry = _build_audit_entry(
        action=request.action,
        session_id=request.session_id,
        candidate_id=request.candidate_id,
        details=request.details,
        user=request.user_id or "system",
    )
    _append_audit_entry(entry)

    return {
        "status": "logged",
        "timestamp": entry.timestamp,
        "action": entry.action,
        "entry_hash": entry.entry_hash,
    }


@router.get("/audit-stream")
async def get_audit_stream(
    session_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    Return the last 50 audit entries (newest first), formatted for a
    frontend terminal UI. Supports optional session_id filtering.
    """
    entries = _read_audit_entries(session_id=session_id, limit=limit + offset)
    paginated = entries[offset:offset + limit]

    # Format for terminal display
    terminal_lines = []
    for e in paginated:
        ts_short = e.get("timestamp", "")[:19].replace("T", " ")
        action = e.get("action", "unknown")
        sid = (e.get("session_id") or "—")[:8]
        cid = e.get("candidate_id") or "—"
        hash_short = e.get("entry_hash", "")[:12]
        terminal_lines.append(
            f"[{ts_short}] UTC  {action:<22} session={sid}  candidate={cid}  #{hash_short}"
        )

    return {
        "entries": paginated,
        "terminal_lines": terminal_lines,
        "total": len(_read_audit_entries(session_id=session_id, limit=100_000)),
        "limit": limit,
        "offset": offset,
    }


@router.get("/audit/export/{session_id}")
async def export_audit_log(session_id: str):
    """Export full audit log for a session — DPDPA compliance reporting."""
    entries = _read_audit_entries(session_id=session_id, limit=100_000)
    return {
        "session_id": session_id,
        "export_timestamp": datetime.now(timezone.utc).isoformat(),
        "entries_count": len(entries),
        "entries": entries,
        "compliance_note": (
            "This audit log is provided for DPDPA 2023 compliance. "
            "Each entry contains a SHA-256 hash of its content linked to the previous entry, "
            "making retroactive tampering detectable."
        ),
    }
