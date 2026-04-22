"""
Agent tools — each callable by the chat orchestrator with JSON args.

Every tool branches on is_demo(college_id) so the agent works identically
whether the college is real (Supabase) or synthetic (demo store). This means
the full product experience is reachable with zero backend setup.

Tools return serialisable dicts. Errors are returned as {"error": "..."}
rather than raised, so the agent can see them and adapt.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from .demo_store import (
    is_demo, demo_students_filter, demo_student_by_id,
    demo_drive_by_id, DEMO_STUDENTS, DEMO_DRIVES, DEMO_COMPANIES,
)
from ..db import T_STUDENTS, T_DRIVES, T_COMPANIES, select_one, select_many, raw_client


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
    Rank students by semantic fit against a free-text query.

    - Demo mode: compute BOW-hashed cosine similarity in Python (uses the same
      hashing vectoriser that campus_embedder uses for its pseudo-fallback).
    - Real mode: embed the query (Gemini with BOW fallback) then match against
      `embedding_summary` via the `match_campus_students` RPC; if the RPC isn't
      present we pull raw embeddings and compute cosine client-side.

    Scores are returned on a 0–100 scale where 100 = perfect cosine alignment.
    """
    try:
        # Embed the query using the existing embedder so real + demo paths share
        # the same vector space conventions. `_embed_one` returns a pseudo
        # BOW-hash vector when Gemini is unavailable.
        try:
            from .campus_embedder import _embed_one, _pseudo as _bow_vector  # type: ignore
        except Exception as imp_err:  # noqa: BLE001
            return {"error": f"embedder import failed: {imp_err}"}

        if is_demo(college_id):
            pool = [s for s in DEMO_STUDENTS if not student_ids or s["id"] in student_ids]
            q_vec = _bow_vector(query_text)
            scored = []
            for s in pool:
                enriched = s.get("profile_enriched") or {}
                blob = " ".join([
                    " ".join(enriched.get("skills") or []),
                    " ".join(enriched.get("passions") or []),
                    " ".join(enriched.get("interests") or []),
                    " ".join(enriched.get("domain_preferences") or []),
                    enriched.get("summary") or "",
                    s.get("branch") or "",
                ])
                s_vec = _bow_vector(blob)
                sim = _cosine(q_vec, s_vec)
                scored.append({
                    "student": _compact_student(s),
                    "fit_score": round(sim * 100, 1),
                    "similarity": round(sim, 4),
                })
            scored.sort(key=lambda x: x["fit_score"], reverse=True)
            return {
                "count": len(scored),
                "ranked": scored[:limit],
                "method": "bow_cosine_demo",
            }

        # Real mode — hit pgvector (or client-side cosine fallback).
        from .vector_search import match_students_by_embedding
        q_emb = _embed_one(query_text) or _bow_vector(query_text)
        rows = match_students_by_embedding(
            college_id, q_emb, student_ids=student_ids, limit=limit,
        )
        scored = [
            {
                "student": _compact_student(r),
                "fit_score": round(float(r.get("similarity") or 0.0) * 100, 1),
                "similarity": round(float(r.get("similarity") or 0.0), 4),
            }
            for r in rows
        ]
        return {
            "count": len(scored),
            "ranked": scored[:limit],
            "method": "pgvector_cosine",
        }
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
                "institution_tier": enriched.get("institution_tier"),
                "summary": enriched.get("summary"),
            },
        }
    except Exception as e:
        return {"error": f"explain_fit failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: list_drives
# ---------------------------------------------------------------------------

def list_drives(college_id: str, status: str = "upcoming", limit: int = 50) -> Dict[str, Any]:
    """
    Compact drive list for the chat agent. Includes company tier so the agent
    can cross-reference with student institution_tier when recommending pushes.

    Use when the user asks "what drives do I have" or "which drives match X".
    Pass status="" (empty) or status=None to include all statuses.
    """
    try:
        status_norm = (status or "").strip().lower() or None

        drives: List[Dict[str, Any]] = []
        companies_by_id: Dict[str, Dict[str, Any]] = {}

        if is_demo(college_id):
            companies_by_id = {c["id"]: c for c in DEMO_COMPANIES}
            for d in DEMO_DRIVES:
                if status_norm and (d.get("status") or "").lower() != status_norm:
                    continue
                drives.append(d)
        else:
            q = raw_client().table(T_DRIVES).select(
                "id,role,company_id,location,ctc_offered,status,scheduled_date"
            ).eq("college_id", college_id)
            if status_norm:
                q = q.eq("status", status_norm)
            q = q.order("scheduled_date", desc=False).limit(limit)
            res = q.execute()
            drives = getattr(res, "data", None) or []

            company_ids = list({d.get("company_id") for d in drives if d.get("company_id")})
            if company_ids:
                cres = raw_client().table(T_COMPANIES).select(
                    "id,name,industry,tier"
                ).in_("id", company_ids).execute()
                companies_by_id = {c["id"]: c for c in (getattr(cres, "data", None) or [])}

        compact: List[Dict[str, Any]] = []
        for d in drives[:limit]:
            company = companies_by_id.get(d.get("company_id")) or {}
            compact.append({
                "id": d.get("id"),
                "role": d.get("role"),
                "company": company.get("name"),
                "company_id": d.get("company_id"),
                "industry": company.get("industry"),
                "tier": company.get("tier"),
                "location": d.get("location"),
                "ctc_offered": d.get("ctc_offered"),
                "scheduled_date": d.get("scheduled_date"),
                "status": d.get("status"),
            })
        return {"count": len(compact), "drives": compact}
    except Exception as e:
        return {"error": f"list_drives failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: compare_students
# ---------------------------------------------------------------------------

def compare_students(
    student_ids: List[str],
    drive_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Side-by-side comparison of students on key dimensions.

    If `drive_id` is set, also compute per-student fit_score + match_gaps
    against that drive.
    """
    try:
        if not student_ids:
            return {"error": "student_ids must be a non-empty list"}

        students: List[Dict[str, Any]] = []
        for sid in student_ids:
            s = demo_student_by_id(sid) or select_one(T_STUDENTS, {"id": sid})
            if s:
                students.append(s)
        if not students:
            return {"error": "no matching students found"}

        drive = None
        if drive_id:
            drive = demo_drive_by_id(drive_id) or select_one(T_DRIVES, {"id": drive_id})

        compacts = [_compact_student(s) for s in students]

        dims = ["cgpa", "branch", "top_skills", "top_role_fit",
                "achievement_weight", "institution_tier"]
        matrix: Dict[str, Dict[str, Any]] = {d: {} for d in dims}

        comparisons: List[Dict[str, Any]] = []
        for s in students:
            enriched = s.get("profile_enriched") or {}
            sid = s["id"]
            role_fit = enriched.get("role_fit_signals") or {}
            top_fit = max(role_fit.items(), key=lambda kv: kv[1]) if role_fit else ("—", 0.0)
            top_skills = (enriched.get("skills") or [])[:5]

            matrix["cgpa"][sid] = s.get("cgpa")
            matrix["branch"][sid] = s.get("branch")
            matrix["top_skills"][sid] = top_skills
            matrix["top_role_fit"][sid] = {"role": top_fit[0], "score": top_fit[1]}
            matrix["achievement_weight"][sid] = enriched.get("achievement_weight")
            matrix["institution_tier"][sid] = enriched.get("institution_tier")

            entry: Dict[str, Any] = {
                "id": sid,
                "name": s.get("name"),
                "summary_snippet": (enriched.get("summary") or "")[:180],
            }
            if drive:
                fit = explain_fit(sid, drive["id"])
                elig = check_eligibility(sid, drive["id"])
                entry["fit_score_signals"] = fit.get("signals") if "error" not in fit else None
                entry["match_gaps"] = elig.get("violations") if "error" not in elig else None
                entry["eligible"] = elig.get("eligible") if "error" not in elig else None
            comparisons.append(entry)

        return {
            "students": compacts,
            "comparisons": comparisons,
            "matrix": matrix,
            "drive": {"id": drive["id"], "role": drive.get("role")} if drive else None,
        }
    except Exception as e:
        return {"error": f"compare_students failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: match_drives_for_student
# ---------------------------------------------------------------------------

def match_drives_for_student(student_id: str, limit: int = 5) -> Dict[str, Any]:
    """Given a student, rank their college's open drives by semantic fit.

    Reverse direction of explain_fit. Uses the student's summary_text (or
    constructed blob) as the query and the drives' JD embeddings as targets.
    """
    try:
        student = demo_student_by_id(student_id) or select_one(T_STUDENTS, {"id": student_id})
        if not student:
            return {"error": "student not found"}

        college_id = student.get("college_id")
        enriched = student.get("profile_enriched") or {}
        query_blob = " ".join([
            enriched.get("summary") or "",
            " ".join(enriched.get("skills") or []),
            " ".join(enriched.get("passions") or []),
            " ".join(enriched.get("domain_preferences") or []),
        ]).strip() or (student.get("name") or "")

        try:
            from .campus_embedder import _embed_one, _pseudo as _bow_vector  # type: ignore
        except Exception as imp_err:  # noqa: BLE001
            return {"error": f"embedder import failed: {imp_err}"}

        if is_demo(college_id):
            q_vec = _bow_vector(query_blob)
            ranked: List[Dict[str, Any]] = []
            for d in DEMO_DRIVES:
                jd_blob = " ".join([
                    d.get("role") or "",
                    d.get("jd_text") or "",
                    d.get("location") or "",
                ])
                d_vec = _bow_vector(jd_blob)
                sim = _cosine(q_vec, d_vec)
                company = next((c for c in DEMO_COMPANIES if c["id"] == d.get("company_id")), None)
                ranked.append({
                    "drive": {
                        "id": d["id"],
                        "role": d.get("role"),
                        "company": (company or {}).get("name"),
                        "tier": (company or {}).get("tier"),
                        "location": d.get("location"),
                        "ctc_offered": d.get("ctc_offered"),
                        "scheduled_date": d.get("scheduled_date"),
                        "status": d.get("status"),
                    },
                    "fit_score": round(sim * 100, 1),
                    "similarity": round(sim, 4),
                })
            ranked.sort(key=lambda x: x["fit_score"], reverse=True)
            return {
                "student": {"id": student_id, "name": student.get("name")},
                "count": len(ranked),
                "ranked": ranked[:limit],
                "method": "bow_cosine_demo",
            }

        # Real mode — pgvector against jd_embedding.
        from .vector_search import match_drives_by_embedding
        q_emb = _embed_one(query_blob) or _bow_vector(query_blob)
        rows = match_drives_by_embedding(college_id, q_emb, limit=limit)

        company_ids = list({r.get("company_id") for r in rows if r.get("company_id")})
        companies_by_id: Dict[str, Dict[str, Any]] = {}
        if company_ids:
            try:
                cres = raw_client().table(T_COMPANIES).select(
                    "id,name,tier,industry"
                ).in_("id", company_ids).execute()
                companies_by_id = {c["id"]: c for c in (getattr(cres, "data", None) or [])}
            except Exception:
                companies_by_id = {}

        ranked = []
        for r in rows:
            company = companies_by_id.get(r.get("company_id")) or {}
            sim = float(r.get("similarity") or 0.0)
            ranked.append({
                "drive": {
                    "id": r.get("id"),
                    "role": r.get("role"),
                    "company": company.get("name"),
                    "tier": company.get("tier"),
                    "location": r.get("location"),
                    "ctc_offered": r.get("ctc_offered"),
                    "scheduled_date": r.get("scheduled_date"),
                    "status": r.get("status"),
                },
                "fit_score": round(sim * 100, 1),
                "similarity": round(sim, 4),
            })

        return {
            "student": {"id": student_id, "name": student.get("name")},
            "count": len(ranked),
            "ranked": ranked[:limit],
            "method": "pgvector_cosine",
        }
    except Exception as e:
        return {"error": f"match_drives_for_student failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: propose_shortlist  (WRITE — preview only; UI confirms the actual write)
# ---------------------------------------------------------------------------

def propose_shortlist(
    drive_id: str,
    student_ids: List[str],
) -> Dict[str, Any]:
    """
    Preview what a bulk_shortlist call would create, WITHOUT writing anything.

    Returns per-student eligibility + a compact fit signal so the PC admin can
    scan the preview, then the frontend's confirmation UI will call the real
    write endpoint (bulkShortlist) on approval.
    """
    try:
        if not drive_id:
            return {"error": "drive_id required"}
        if not student_ids:
            return {"error": "student_ids must be a non-empty list"}

        drive = demo_drive_by_id(drive_id) or select_one(T_DRIVES, {"id": drive_id})
        if not drive:
            return {"error": "drive not found"}

        preview: List[Dict[str, Any]] = []
        eligible_count = 0
        for sid in student_ids:
            student = demo_student_by_id(sid) or select_one(T_STUDENTS, {"id": sid})
            if not student:
                preview.append({
                    "student_id": sid,
                    "name": None,
                    "eligible": False,
                    "violations": ["student not found"],
                    "fit_score": None,
                })
                continue

            elig = check_eligibility(sid, drive_id)
            fit = explain_fit(sid, drive_id)
            enriched = student.get("profile_enriched") or {}
            top_role = None
            role_fit = enriched.get("role_fit_signals") or {}
            if role_fit:
                best = max(role_fit.items(), key=lambda kv: kv[1])
                top_role = {"role": best[0], "score": best[1]}

            eligible = bool(elig.get("eligible"))
            if eligible:
                eligible_count += 1

            preview.append({
                "student_id": sid,
                "name": student.get("name"),
                "branch": student.get("branch"),
                "year": student.get("year"),
                "cgpa": student.get("cgpa"),
                "eligible": eligible,
                "violations": elig.get("violations") or [],
                "top_role": top_role,
                "skill_overlap_with_jd": (fit.get("signals") or {}).get("skill_overlap_with_jd") or [],
                "summary_snippet": (enriched.get("summary") or "")[:180],
            })

        company = None
        if drive.get("company_id"):
            company = demo_company_by_id(drive.get("company_id")) or select_one(
                T_COMPANIES, {"id": drive.get("company_id")}
            )

        return {
            "action": "shortlist",
            "drive": {
                "id": drive["id"],
                "role": drive.get("role"),
                "company": (company or {}).get("name"),
                "location": drive.get("location"),
                "ctc_offered": drive.get("ctc_offered"),
            },
            "students": preview,
            "total": len(preview),
            "eligible_count": eligible_count,
            "ineligible_count": len(preview) - eligible_count,
            "requires_confirmation": True,
        }
    except Exception as e:
        return {"error": f"propose_shortlist failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: propose_interview_email  (WRITE draft — preview only; UI sends on confirm)
# ---------------------------------------------------------------------------

def propose_interview_email(
    drive_id: str,
    student_ids: List[str],
    slot_text: str = "",
    tone: str = "professional",
) -> Dict[str, Any]:
    """
    Draft an interview-invite email per student. Uses Groq (if available) to
    write the email; otherwise falls back to a deterministic template.

    Body contains the literal placeholder `{{meeting_link}}` which the PC
    fills in before sending. Does NOT persist anything.
    """
    try:
        if not drive_id:
            return {"error": "drive_id required"}
        if not student_ids:
            return {"error": "student_ids must be a non-empty list"}

        drive = demo_drive_by_id(drive_id) or select_one(T_DRIVES, {"id": drive_id})
        if not drive:
            return {"error": "drive not found"}

        company = None
        if drive.get("company_id"):
            company = demo_company_by_id(drive.get("company_id")) or select_one(
                T_COMPANIES, {"id": drive.get("company_id")}
            )
        company_name = (company or {}).get("name") or "the recruiting team"
        role = drive.get("role") or "the open role"

        drafts: List[Dict[str, Any]] = []
        for sid in student_ids:
            student = demo_student_by_id(sid) or select_one(T_STUDENTS, {"id": sid})
            if not student:
                drafts.append({
                    "student_id": sid,
                    "name": None,
                    "subject": None,
                    "body": None,
                    "error": "student not found",
                })
                continue

            name = student.get("name") or "Candidate"
            subject = f"Interview invitation — {role} @ {company_name}"
            body = _draft_email_with_llm(
                kind="interview",
                tone=tone,
                student_name=name,
                role=role,
                company_name=company_name,
                slot_text=slot_text,
                reason=None,
            )

            drafts.append({
                "student_id": sid,
                "name": name,
                "subject": subject,
                "body": body,
                "type": "interview_invite",
            })

        return {
            "action": "interview_email",
            "drive": {
                "id": drive["id"],
                "role": role,
                "company": company_name,
            },
            "slot_text": slot_text,
            "tone": tone,
            "drafts": drafts,
            "total": len(drafts),
            "requires_confirmation": True,
        }
    except Exception as e:
        return {"error": f"propose_interview_email failed: {e}"}


# ---------------------------------------------------------------------------
# TOOL: propose_rejection_email  (WRITE draft — preview only)
# ---------------------------------------------------------------------------

def propose_rejection_email(
    drive_id: str,
    student_ids: List[str],
    reason_text: str = "",
) -> Dict[str, Any]:
    """Polite rejection draft per student. Does NOT send."""
    try:
        if not drive_id:
            return {"error": "drive_id required"}
        if not student_ids:
            return {"error": "student_ids must be a non-empty list"}

        drive = demo_drive_by_id(drive_id) or select_one(T_DRIVES, {"id": drive_id})
        if not drive:
            return {"error": "drive not found"}

        company = None
        if drive.get("company_id"):
            company = demo_company_by_id(drive.get("company_id")) or select_one(
                T_COMPANIES, {"id": drive.get("company_id")}
            )
        company_name = (company or {}).get("name") or "the recruiting team"
        role = drive.get("role") or "the role"

        drafts: List[Dict[str, Any]] = []
        for sid in student_ids:
            student = demo_student_by_id(sid) or select_one(T_STUDENTS, {"id": sid})
            if not student:
                drafts.append({
                    "student_id": sid,
                    "name": None,
                    "subject": None,
                    "body": None,
                    "error": "student not found",
                })
                continue

            name = student.get("name") or "Candidate"
            subject = f"Update on your application — {role} @ {company_name}"
            body = _draft_email_with_llm(
                kind="rejection",
                tone="professional",
                student_name=name,
                role=role,
                company_name=company_name,
                slot_text=None,
                reason=reason_text,
            )

            drafts.append({
                "student_id": sid,
                "name": name,
                "subject": subject,
                "body": body,
                "type": "rejection",
            })

        return {
            "action": "rejection_email",
            "drive": {
                "id": drive["id"],
                "role": role,
                "company": company_name,
            },
            "reason_text": reason_text,
            "drafts": drafts,
            "total": len(drafts),
            "requires_confirmation": True,
        }
    except Exception as e:
        return {"error": f"propose_rejection_email failed: {e}"}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def demo_company_by_id(cid: Optional[str]) -> Optional[Dict[str, Any]]:
    if not cid:
        return None
    for c in DEMO_COMPANIES:
        if c.get("id") == cid:
            return c
    return None


def _fallback_interview_body(student_name: str, role: str, company_name: str, slot_text: str) -> str:
    slot_line = f"Proposed slot: {slot_text}." if slot_text else "We will share the slot details shortly."
    return (
        f"Hi {student_name},\n\n"
        f"Congratulations! Your profile has been shortlisted for the {role} role at {company_name}. "
        f"We would like to invite you to the next round of interviews.\n\n"
        f"{slot_line} Please join using the link below:\n"
        f"Meeting link: {{{{meeting_link}}}}\n\n"
        f"Kindly confirm your availability by replying to this email. If the proposed time "
        f"does not work, share 2–3 alternative slots and we will coordinate.\n\n"
        f"Best regards,\n"
        f"Placement Cell"
    )


def _fallback_rejection_body(student_name: str, role: str, company_name: str, reason: str) -> str:
    reason_line = f"Specifically: {reason}\n\n" if reason else ""
    return (
        f"Hi {student_name},\n\n"
        f"Thank you for your interest in the {role} role at {company_name} and for taking the "
        f"time to go through the selection process with us.\n\n"
        f"After careful review, we will not be moving forward with your application for this "
        f"particular role. {reason_line}This decision is specific to the requirements of this "
        f"drive and is not a reflection of your overall capability — we strongly encourage you "
        f"to apply to upcoming drives that align with your strengths.\n\n"
        f"Wishing you the very best for your placement season.\n\n"
        f"Warm regards,\n"
        f"Placement Cell"
    )


def _draft_email_with_llm(
    kind: str,
    tone: str,
    student_name: str,
    role: str,
    company_name: str,
    slot_text: Optional[str],
    reason: Optional[str],
) -> str:
    """
    Draft an email body via Groq; on any failure, use the deterministic template.

    Always returns a body containing the literal `{{meeting_link}}` placeholder
    for interview drafts, so the PC can substitute it on confirmation.
    """
    # Deterministic fallbacks (used when Groq unavailable or on any error).
    if kind == "interview":
        fallback = _fallback_interview_body(student_name, role, company_name, slot_text or "")
    else:
        fallback = _fallback_rejection_body(student_name, role, company_name, reason or "")

    try:
        from services.llm_client import groq_available, _get_groq_client, _groq_model  # type: ignore
        if not groq_available():
            return fallback

        if kind == "interview":
            system = (
                "You draft short, warm, professional interview invitation emails for Indian "
                "college placement cells. Keep it under 140 words. Use the placeholder "
                "{{meeting_link}} literally where a meeting URL should go. Tone: "
                f"{tone}. Do NOT include a subject line — just the body. Sign off as 'Placement Cell'."
            )
            slot_line = f"Proposed interview slot: {slot_text}." if slot_text else "Slot details will be shared shortly."
            user = (
                f"Write an interview invite for {student_name} for the {role} role at "
                f"{company_name}. {slot_line} The body must include the literal "
                f"placeholder {{{{meeting_link}}}}. Ask the candidate to confirm availability "
                f"or suggest 2-3 alternative slots. No subject line — body only."
            )
        else:
            system = (
                "You draft polite, empathetic rejection emails for Indian college placement "
                "cells. Keep it under 120 words. Do NOT include a subject line — just the body. "
                "Tone: professional, respectful, encouraging toward future drives. Sign off as "
                "'Placement Cell'. Never use harsh language."
            )
            reason_line = f"Optional reason to reference tactfully: {reason}." if reason else "No specific reason given."
            user = (
                f"Write a polite rejection to {student_name} for the {role} role at "
                f"{company_name}. {reason_line} Emphasise this is role-specific and encourage "
                f"them to apply to upcoming drives. No subject line — body only."
            )

        client = _get_groq_client()
        response = client.chat.completions.create(
            model=_groq_model(),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.4,
            max_tokens=420,
        )
        body = (response.choices[0].message.content or "").strip()
        if not body:
            return fallback
        # Safety: ensure interview drafts carry the placeholder.
        if kind == "interview" and "{{meeting_link}}" not in body:
            body = body.rstrip() + "\n\nMeeting link: {{meeting_link}}"
        return body
    except Exception:
        return fallback


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
        "institution_tier": enriched.get("institution_tier"),
        "achievement_weight": enriched.get("achievement_weight"),
        "summary_snippet": (enriched.get("summary") or "")[:180],
    }


def _cosine(a: List[float], b: List[float]) -> float:
    """Cosine similarity on two equal-length vectors, clamped to [0, 1]."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0 or nb == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (math.sqrt(na) * math.sqrt(nb))))


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
    "list_drives": list_drives,
    "compare_students": compare_students,
    "match_drives_for_student": match_drives_for_student,
    # Write-proposal tools — return previews only; UI gates actual execution.
    "propose_shortlist": propose_shortlist,
    "propose_interview_email": propose_interview_email,
    "propose_rejection_email": propose_rejection_email,
}


# Set of tool names that the frontend should render as ActionCards (confirmation
# UX) rather than generic tool-result badges. Surfaced here so orchestrator / UI
# stay in sync with one source of truth.
WRITE_PROPOSAL_TOOLS = {
    "propose_shortlist",
    "propose_interview_email",
    "propose_rejection_email",
}
