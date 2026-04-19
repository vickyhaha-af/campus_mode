"""
Agent tools — each callable by the chat orchestrator with JSON args.

Every tool branches on is_demo(college_id) so the agent works identically
whether the college is real (Supabase) or synthetic (demo store). This means
the full product experience is reachable with zero backend setup.

Tools return serialisable dicts. Errors are returned as {"error": "..."}
rather than raised, so the agent can see them and adapt.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .demo_store import (
    is_demo, demo_students_filter, demo_student_by_id,
    demo_drive_by_id, DEMO_STUDENTS,
)
from ..db import T_STUDENTS, T_DRIVES, select_one, select_many, raw_client


# ---------------------------------------------------------------------------
# TOOL: search_students
# ---------------------------------------------------------------------------

def search_students(
    college_id: str,
    branch: Optional[str] = None,
    year: Optional[int] = None,
    placed_status: Optional[str] = None,
    min_cgpa: Optional[float] = None,
    max_active_backlogs: Optional[int] = None,
    gender: Optional[str] = None,
    current_city: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Structured filter over the student pool. Returns a list of compact student
    summaries (id, name, branch, year, cgpa, top signal) — NOT the full rows,
    to keep the agent's context window small.

    Compliance note: if `gender` is set, the caller should also supply a
    drive context (or will receive a compliance flag in the response).
    """
    try:
        if is_demo(college_id):
            rows = demo_students_filter(
                branch=branch, year=year, placed_status=placed_status,
                min_cgpa=min_cgpa, max_active_backlogs=max_active_backlogs,
                gender=gender, current_city=current_city,
            )
        else:
            q = raw_client().table(T_STUDENTS).select(
                "id,name,branch,year,cgpa,backlogs_active,placed_status,gender,current_city,profile_enriched"
            ).eq("college_id", college_id)
            if branch: q = q.eq("branch", branch)
            if year is not None: q = q.eq("year", year)
            if placed_status: q = q.eq("placed_status", placed_status)
            if min_cgpa is not None: q = q.gte("cgpa", min_cgpa)
            if max_active_backlogs is not None: q = q.lte("backlogs_active", max_active_backlogs)
            if gender: q = q.eq("gender", gender)
            if current_city: q = q.eq("current_city", current_city)
            q = q.limit(limit)
            res = q.execute()
            rows = getattr(res, "data", None) or []

        compact = [_compact_student(s) for s in rows[:limit]]
        warnings: List[str] = []
        if gender:
            warnings.append(
                "Demographic filter applied (gender). If this is not driven by a drive's "
                "stated eligibility rule, the query will be logged for compliance review."
            )
        return {"count": len(compact), "students": compact, "warnings": warnings}
    except Exception as e:
        return {"error": f"search_students failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: semantic_rank
# ---------------------------------------------------------------------------

def semantic_rank(
    college_id: str,
    query_text: str,
    student_ids: Optional[List[str]] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Rank students by fit against a free-text query (e.g. pasted JD or ad-hoc
    description). If student_ids is provided, rank within that subset; else
    rank across the whole college.

    In demo mode: simple keyword-overlap scoring over skills + passions + summary.
    In real mode: should use pgvector cosine similarity — Phase 2 MVP falls
    back to keyword overlap here too (pgvector RPC wiring deferred to Phase 3).
    """
    try:
        if is_demo(college_id):
            pool = [s for s in DEMO_STUDENTS if not student_ids or s["id"] in student_ids]
        else:
            q = raw_client().table(T_STUDENTS).select(
                "id,name,branch,year,cgpa,profile_enriched"
            ).eq("college_id", college_id)
            if student_ids:
                q = q.in_("id", student_ids)
            res = q.limit(500).execute()
            pool = getattr(res, "data", None) or []

        scored = [
            {"student": _compact_student(s), "fit_score": round(_keyword_score(query_text, s) * 100, 1)}
            for s in pool
        ]
        scored.sort(key=lambda x: x["fit_score"], reverse=True)
        return {"count": len(scored), "ranked": scored[:limit], "method": "keyword_overlap_mvp"}
    except Exception as e:
        return {"error": f"semantic_rank failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: fetch_drive
# ---------------------------------------------------------------------------

def fetch_drive(drive_id: str) -> Dict[str, Any]:
    try:
        d = demo_drive_by_id(drive_id)
        if d is None:
            d = select_one(T_DRIVES, {"id": drive_id})
        if not d:
            return {"error": "drive not found"}
        return {
            "id": d["id"], "role": d.get("role"), "company_id": d.get("company_id"),
            "location": d.get("location"), "ctc_offered": d.get("ctc_offered"),
            "job_type": d.get("job_type"), "status": d.get("status"),
            "scheduled_date": d.get("scheduled_date"),
            "jd_text": d.get("jd_text"),
            "eligibility_rules": d.get("eligibility_rules") or {},
        }
    except Exception as e:
        return {"error": f"fetch_drive failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: check_eligibility
# ---------------------------------------------------------------------------

def check_eligibility(student_id: str, drive_id: str) -> Dict[str, Any]:
    try:
        student = demo_student_by_id(student_id) or select_one(T_STUDENTS, {"id": student_id})
        drive = demo_drive_by_id(drive_id) or select_one(T_DRIVES, {"id": drive_id})
        if not student: return {"error": "student not found"}
        if not drive: return {"error": "drive not found"}
        rules = drive.get("eligibility_rules") or {}
        violations: List[str] = []

        min_cgpa = rules.get("min_cgpa")
        if min_cgpa is not None and (student.get("cgpa") or 0) < min_cgpa:
            violations.append(f"CGPA {student.get('cgpa')} < required {min_cgpa}")

        max_backs = rules.get("max_active_backlogs")
        if max_backs is not None and (student.get("backlogs_active") or 0) > max_backs:
            violations.append(f"Active backlogs {student.get('backlogs_active')} > allowed {max_backs}")

        branches = rules.get("allowed_branches") or []
        if branches and student.get("branch") not in branches:
            violations.append(f"Branch {student.get('branch')} not in {branches}")

        years = rules.get("allowed_years") or []
        if years and student.get("year") not in years:
            violations.append(f"Year {student.get('year')} not in {years}")

        gender_req = rules.get("gender_restriction")
        if gender_req and (student.get("gender") or "").lower() != gender_req.lower():
            violations.append(f"Gender restriction: requires {gender_req}")

        return {
            "eligible": len(violations) == 0,
            "violations": violations,
            "student": {"id": student["id"], "name": student["name"]},
            "drive": {"id": drive["id"], "role": drive.get("role")},
        }
    except Exception as e:
        return {"error": f"check_eligibility failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: get_student_profile
# ---------------------------------------------------------------------------

def get_student_profile(student_id: str) -> Dict[str, Any]:
    try:
        s = demo_student_by_id(student_id) or select_one(T_STUDENTS, {"id": student_id})
        if not s:
            return {"error": "student not found"}
        # Strip vectors from the payload — agent doesn't need raw embeddings.
        out = {k: v for k, v in s.items() if not k.startswith("embedding_")}
        return out
    except Exception as e:
        return {"error": f"get_student_profile failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: explain_fit
# ---------------------------------------------------------------------------

def explain_fit(student_id: str, drive_id: str) -> Dict[str, Any]:
    """
    Generate a plain-language rationale for a student-drive match.

    For MVP this is a deterministic, evidence-based rationale built from the
    student's profile_enriched vs the drive's JD + eligibility rules. The
    agent itself writes the final user-facing narrative — this tool surfaces
    the factual signals. No extra LLM call (rate-limit friendly).
    """
    try:
        student = demo_student_by_id(student_id) or select_one(T_STUDENTS, {"id": student_id})
        drive = demo_drive_by_id(drive_id) or select_one(T_DRIVES, {"id": drive_id})
        if not student or not drive:
            return {"error": "student or drive not found"}

        enriched = student.get("profile_enriched") or {}
        role = (drive.get("role") or "").lower()
        jd = (drive.get("jd_text") or "").lower()

        role_fit = enriched.get("role_fit_signals") or {}
        top_roles = sorted(role_fit.items(), key=lambda kv: kv[1], reverse=True)[:3]

        skill_overlap = [
            s for s in (enriched.get("skills") or [])
            if s.lower() in jd
        ][:8]

        passions = enriched.get("passions") or []
        passion_hits = [p for p in passions if any(w in jd for w in p.lower().split())][:3]

        personality = enriched.get("personality_hints") or {}

        return {
            "student": {"id": student["id"], "name": student["name"], "cgpa": student.get("cgpa"), "branch": student.get("branch")},
            "drive": {"id": drive["id"], "role": drive.get("role")},
            "signals": {
                "top_role_fits": [{"role": r, "score": score} for r, score in top_roles],
                "skill_overlap_with_jd": skill_overlap,
                "passion_alignment": passion_hits,
                "personality_hints": personality,
                "achievement_weight": enriched.get("achievement_weight"),
                "summary": enriched.get("summary"),
            },
        }
    except Exception as e:
        return {"error": f"explain_fit failed: {e}"}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _compact_student(s: Dict[str, Any]) -> Dict[str, Any]:
    enriched = s.get("profile_enriched") or {}
    role_fit = enriched.get("role_fit_signals") or {}
    top_fit = max(role_fit.items(), key=lambda kv: kv[1]) if role_fit else ("—", 0.0)
    return {
        "id": s.get("id"),
        "name": s.get("name"),
        "branch": s.get("branch"),
        "year": s.get("year"),
        "cgpa": s.get("cgpa"),
        "backlogs_active": s.get("backlogs_active"),
        "placed_status": s.get("placed_status"),
        "top_role_fit": {"role": top_fit[0], "score": top_fit[1]},
        "passions": (enriched.get("passions") or [])[:3],
        "summary_snippet": (enriched.get("summary") or "")[:180],
    }


def _keyword_score(query_text: str, student: Dict[str, Any]) -> float:
    """MVP similarity — token overlap between query and student signals."""
    qtokens = set(_tokenize(query_text))
    enriched = student.get("profile_enriched") or {}
    blob = " ".join([
        " ".join(enriched.get("skills") or []),
        " ".join(enriched.get("passions") or []),
        " ".join(enriched.get("interests") or []),
        " ".join(enriched.get("domain_preferences") or []),
        enriched.get("summary") or "",
        student.get("branch") or "",
    ])
    stokens = set(_tokenize(blob))
    if not qtokens or not stokens:
        return 0.0
    overlap = len(qtokens & stokens)
    # normalise by sqrt of query length so short queries don't dominate
    denom = (len(qtokens) ** 0.5) * 4  # scale so meaningful queries land 0-1
    return min(overlap / denom, 1.0) if denom else 0.0


def _tokenize(text: str) -> List[str]:
    import re
    return [t for t in re.split(r"[^A-Za-z0-9+]+", (text or "").lower()) if len(t) > 2]


# ---------------------------------------------------------------------------
# registry — used by the orchestrator for dispatch
# ---------------------------------------------------------------------------

TOOL_REGISTRY = {
    "search_students": search_students,
    "semantic_rank": semantic_rank,
    "fetch_drive": fetch_drive,
    "check_eligibility": check_eligibility,
    "get_student_profile": get_student_profile,
    "explain_fit": explain_fit,
}
