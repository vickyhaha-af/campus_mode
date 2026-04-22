"""
Resume Coach — student-facing coaching agent.

Given a student's profile (real or demo) plus the drives available at their
college, this endpoint asks a single Groq LLM call to produce opinionated,
actionable coaching:

  * `top_drive_recommendations` — top 3 best-fit drives with per-drive
    why_fit bullets and concrete gap bullets
  * `resume_quality` — score + strengths + weaknesses with specific
    example bullets to rewrite, plus verb-diversity and quantified-impact
    ratios computed deterministically from the resume text
  * `skills_to_acquire` — prioritised skills with effort + unlocked roles
  * `peer_ranking` — where this student sits in their branch cohort
  * `readiness_score` — composite of fit + achievement_weight + role_fit
  * `action_items` — the top 3-5 concrete things to do over the next month

Gracefully degrades if the LLM is unavailable — the endpoint still returns
the deterministic pieces (peer_ranking, readiness_score, verb stats) with
an `llm_error` marker so the frontend can show a "Coach unavailable" card
instead of crashing.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException

from ..db import T_STUDENTS, T_COMPANIES, select_one, raw_client
from ..services.demo_store import (
    DEMO_COMPANIES,
    DEMO_STUDENTS,
    demo_student_by_id,
    is_demo,
)
from ..services.tools import explain_fit, match_drives_for_student


router = APIRouter(prefix="/api/campus/coach", tags=["campus:coach"])


# ---------------------------------------------------------------------------
# The prompt — spend real effort here, this is the heart of the feature.
# ---------------------------------------------------------------------------

COACH_SYSTEM_PROMPT = (
    "You are Resume Coach, an opinionated career coach for Indian college "
    "students going through campus placement. Your job is to give this student "
    "specific, actionable, non-generic advice they can act on in the next 2-4 "
    "weeks. You have access to their resume text, their enriched profile, and "
    "the top 3 drives they best match against at their college.\n\n"
    "Your output must be a single JSON object matching the schema in the user "
    "prompt EXACTLY. No prose outside JSON, no markdown fences.\n\n"
    "Core rules:\n"
    "1. Be SPECIFIC. Never write 'improve communication skills' — write 'your "
    "bullet under Razorpay says \"Worked on onboarding\" — rewrite as \"Led "
    "redesign of onboarding flow, cutting drop-off by 18% across 12K users\".' "
    "Quote the student's actual words when criticising a bullet.\n"
    "2. Be OPINIONATED. Say what you'd change, not 'you might consider'. A "
    "good coach is direct.\n"
    "3. Ground EVERY recommendation in the drives they match. If you say "
    "'learn SQL', tie it to the specific drive that needs it.\n"
    "4. Be HONEST about weaknesses. If the resume has 2 quantified bullets "
    "out of 20, say so.\n"
    "5. Never invent facts not in the resume_text or profile. If a field is "
    "empty, reflect that reality in the gap.\n"
    "6. Action items are concrete and time-bound — 'Ship a public quant "
    "repo on GitHub' beats 'build a project'."
)


def _build_coach_prompt(
    student: Dict[str, Any],
    resume_text: str,
    top_drives: List[Dict[str, Any]],
    drive_signals: Dict[str, Dict[str, Any]],
    verb_stats: Dict[str, Any],
    quantified_ratio: float,
) -> str:
    """Compose the user prompt for the LLM."""
    enriched = student.get("profile_enriched") or {}

    # Compact drive packets — one per recommended drive.
    drive_packets: List[str] = []
    for d in top_drives:
        drv = d.get("drive") or {}
        sid = drv.get("id")
        sig = drive_signals.get(sid) or {}
        signals = sig.get("signals") or {}
        drive_packets.append(
            json.dumps(
                {
                    "drive_id": drv.get("id"),
                    "role": drv.get("role"),
                    "company": drv.get("company"),
                    "tier": drv.get("tier"),
                    "location": drv.get("location"),
                    "ctc_offered": drv.get("ctc_offered"),
                    "scheduled_date": drv.get("scheduled_date"),
                    "fit_score": d.get("fit_score"),
                    "eligible": d.get("eligible"),
                    "eligibility_violations": d.get("violations") or [],
                    "jd_text": (drv.get("jd_text") or "")[:1200],
                    "signals": {
                        "skill_overlap_with_jd": signals.get("skill_overlap_with_jd"),
                        "top_role_fits": signals.get("top_role_fits"),
                        "passion_alignment": signals.get("passion_alignment"),
                        "achievement_weight": signals.get("achievement_weight"),
                        "institution_tier": signals.get("institution_tier"),
                    },
                },
                ensure_ascii=False,
            )
        )

    profile_packet = json.dumps(
        {
            "name": student.get("name"),
            "branch": student.get("branch"),
            "year": student.get("year"),
            "cgpa": student.get("cgpa"),
            "backlogs_active": student.get("backlogs_active"),
            "current_city": student.get("current_city"),
            "skills": enriched.get("skills"),
            "projects": enriched.get("projects"),
            "internships": enriched.get("internships"),
            "achievements": enriched.get("achievements"),
            "passions": enriched.get("passions"),
            "interests": enriched.get("interests"),
            "certifications": enriched.get("certifications"),
            "domain_preferences": enriched.get("domain_preferences"),
            "role_fit_signals": enriched.get("role_fit_signals"),
            "personality_hints": enriched.get("personality_hints"),
            "achievement_weight": enriched.get("achievement_weight"),
            "institution_tier": enriched.get("institution_tier"),
            "summary": enriched.get("summary"),
        },
        ensure_ascii=False,
    )

    schema = """
{
  "top_drive_recommendations": [
    {
      "drive_id": "<exact drive_id from the input>",
      "why_fit": ["2-4 specific reasons this student fits — quote their skills/projects"],
      "gap": ["2-4 concrete gaps — what's missing, what signal is weak, what to add"]
    }
    // exactly one entry per drive in top_drives, in the same order
  ],
  "resume_quality": {
    "score": 0-100,
    "strengths": ["3-5 specific strengths — quote bullets or fields"],
    "weaknesses": [
      "3-5 specific weaknesses. Each MUST reference a specific bullet/field. Format: 'In <section>, bullet \\"<quoted text>\\" is weak — rewrite as \\"<improved version>\\"' when possible."
    ]
  },
  "skills_to_acquire": [
    {"skill": "<skill>", "for_roles": ["role from recommended drives"], "effort_weeks": 1-12, "priority": "high|medium|low"}
    // 3-5 skills
  ],
  "action_items": [
    {"title": "<short imperative>", "why": "<one-sentence rationale grounded in the drives>", "deadline_weeks": 1-8, "priority": "high|medium|low"}
    // exactly 3-5 items, ordered by priority
  ]
}
""".strip()

    verb_line = (
        f"Top overused verbs in resume bullets: "
        f"{verb_stats.get('top_overused_verbs') or []} "
        f"(diversity score {verb_stats.get('score')})."
    )
    quant_line = (
        f"Quantified-impact ratio: {quantified_ratio:.2f} "
        f"({int(quantified_ratio * 100)}% of bullets include numbers). "
        f"If this is below 0.4, call it out in resume_quality.weaknesses."
    )

    return (
        f"Student profile (JSON):\n{profile_packet}\n\n"
        f"Resume text (verbatim — use this to quote specific bullets):\n"
        f"---\n{resume_text[:6000]}\n---\n\n"
        f"Top {len(top_drives)} matched drives (one JSON object each):\n"
        + "\n".join(drive_packets)
        + "\n\n"
        f"Deterministic stats I already computed (use these, don't recompute):\n"
        f"- {verb_line}\n- {quant_line}\n\n"
        f"Return ONLY a JSON object matching this schema exactly:\n{schema}\n\n"
        "Remember: quote the student's actual resume text when calling out a weak bullet. "
        "No generic advice. No markdown fences."
    )


# ---------------------------------------------------------------------------
# Deterministic helpers — these work with or without an LLM.
# ---------------------------------------------------------------------------

_WEAK_VERBS = {
    "worked", "did", "helped", "assisted", "developed", "made", "created",
    "built", "used", "implemented", "participated", "handled", "managed",
}

_BULLET_RE = re.compile(r"(?:^|\n)\s*(?:[-*•●·]|\d+[\.)])\s+(.+?)(?=\n\s*(?:[-*•●·]|\d+[\.)])|\n\n|$)", re.DOTALL)
_NUMBER_RE = re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:%|x|k|K|M|B|L|lakh|crore|cr|hr|hrs|qps|mo|months?|weeks?|days?|users|orders|engineers|people)?\b")


def _synthesize_resume_text(student: Dict[str, Any]) -> str:
    """Build a plausible resume blob from profile_enriched — used when the
    student has no stored resume_text (e.g. all demo students)."""
    enriched = student.get("profile_enriched") or {}
    lines: List[str] = []
    lines.append(student.get("name") or "Student")
    if student.get("email"):
        lines.append(student["email"])
    if student.get("branch") or student.get("year"):
        bits = []
        if student.get("branch"):
            bits.append(student["branch"])
        if student.get("year"):
            bits.append(f"Class of {student['year']}")
        if student.get("cgpa") is not None:
            bits.append(f"CGPA {student['cgpa']}")
        lines.append(" · ".join(bits))

    if enriched.get("summary"):
        lines.append("")
        lines.append("Summary")
        lines.append(enriched["summary"])

    skills = enriched.get("skills") or []
    if skills:
        lines.append("")
        lines.append("Skills")
        lines.append(", ".join(skills))

    projects = enriched.get("projects") or []
    if projects:
        lines.append("")
        lines.append("Projects")
        for p in projects:
            name = p.get("name") or ""
            desc = p.get("description") or ""
            impact = p.get("impact") or ""
            tech = ", ".join(p.get("tech") or [])
            bullet = f"- {name}"
            if desc:
                bullet += f": {desc}"
            if tech:
                bullet += f" [{tech}]"
            if impact:
                bullet += f" — Impact: {impact}"
            lines.append(bullet)

    internships = enriched.get("internships") or []
    if internships:
        lines.append("")
        lines.append("Internships")
        for i in internships:
            role = i.get("role") or ""
            company = i.get("company") or ""
            duration = i.get("duration") or ""
            desc = i.get("description") or ""
            lines.append(f"- {role} at {company} ({duration})")
            if desc:
                lines.append(f"  {desc}")

    achievements = enriched.get("achievements") or []
    if achievements:
        lines.append("")
        lines.append("Achievements")
        for a in achievements:
            lines.append(f"- {a}")

    passions = enriched.get("passions") or []
    if passions:
        lines.append("")
        lines.append(f"Interests: {', '.join(passions)}")

    return "\n".join(lines)


def _extract_bullets(resume_text: str) -> List[str]:
    """Pull out bullet-like lines from the resume text."""
    if not resume_text:
        return []
    found = [m.group(1).strip() for m in _BULLET_RE.finditer(resume_text)]
    # Fallback: split by newline, keep lines between 20 and 300 chars.
    if not found:
        found = [
            ln.strip(" -*•●·\t")
            for ln in resume_text.splitlines()
            if 20 <= len(ln.strip()) <= 300
        ]
    # Dedupe preserving order.
    seen = set()
    out: List[str] = []
    for b in found:
        key = b.lower()[:120]
        if key in seen or not key:
            continue
        seen.add(key)
        out.append(b)
    return out


def _compute_verb_diversity(bullets: List[str]) -> Dict[str, Any]:
    """How many distinct leading verbs does the student use?"""
    verbs: List[str] = []
    for b in bullets:
        first = re.match(r"\s*([A-Za-z]+)", b)
        if first:
            v = first.group(1).lower()
            if 3 <= len(v) <= 20:
                verbs.append(v)
    if not verbs:
        return {"score": 0.0, "top_overused_verbs": []}
    counts = Counter(verbs)
    unique = len(counts)
    score = round(unique / len(verbs), 2)
    overused = [v for v, c in counts.most_common(3) if c >= 2 or v in _WEAK_VERBS][:3]
    return {"score": score, "top_overused_verbs": overused}


def _compute_quantified_ratio(bullets: List[str]) -> float:
    if not bullets:
        return 0.0
    hits = sum(1 for b in bullets if _NUMBER_RE.search(b))
    return round(hits / len(bullets), 2)


def _check_eligibility(student: Dict[str, Any], drive_full: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Inline eligibility check (avoid an extra DB hit for demo mode)."""
    rules = (drive_full or {}).get("eligibility_rules") or {}
    violations: List[str] = []
    if rules.get("min_cgpa") is not None and (student.get("cgpa") or 0) < rules["min_cgpa"]:
        violations.append(f"CGPA {student.get('cgpa')} < required {rules['min_cgpa']}")
    if rules.get("max_active_backlogs") is not None and (student.get("backlogs_active") or 0) > rules["max_active_backlogs"]:
        violations.append(f"{student.get('backlogs_active')} active backlogs (max {rules['max_active_backlogs']})")
    allowed_branches = rules.get("allowed_branches") or []
    if allowed_branches and student.get("branch") not in allowed_branches:
        violations.append(f"Branch {student.get('branch')} not in {allowed_branches}")
    allowed_years = rules.get("allowed_years") or []
    if allowed_years and student.get("year") not in allowed_years:
        violations.append(f"Year {student.get('year')} not in {allowed_years}")
    return (len(violations) == 0, violations)


def _composite_score(student: Dict[str, Any]) -> float:
    """Blend achievement_weight + top role_fit + CGPA into a sortable score."""
    enriched = student.get("profile_enriched") or {}
    ach = float(enriched.get("achievement_weight") or 0.0)
    role_fit = enriched.get("role_fit_signals") or {}
    top_rf = 0.0
    if role_fit:
        top_rf = max(float(v) for v in role_fit.values() if isinstance(v, (int, float))) if role_fit else 0.0
    cgpa = float(student.get("cgpa") or 0.0) / 10.0
    return round(0.5 * ach + 0.3 * top_rf + 0.2 * cgpa, 4)


def _compute_peer_ranking(student: Dict[str, Any]) -> Dict[str, Any]:
    """Rank this student within their branch cohort."""
    branch = student.get("branch")
    college_id = student.get("college_id")
    if not branch:
        return {"branch": None, "rank": None, "total": 0, "percentile": None}

    cohort: List[Dict[str, Any]] = []
    if is_demo(college_id):
        cohort = [s for s in DEMO_STUDENTS if s.get("branch") == branch]
    else:
        try:
            q = raw_client().table(T_STUDENTS).select(
                "id,name,branch,cgpa,profile_enriched"
            ).eq("college_id", college_id).eq("branch", branch).limit(1000)
            res = q.execute()
            cohort = getattr(res, "data", None) or []
        except Exception:
            cohort = []

    total = len(cohort)
    if total <= 1:
        return {"branch": branch, "rank": 1, "total": total, "percentile": 100}

    me_score = _composite_score(student)
    better = sum(1 for s in cohort if s.get("id") != student.get("id") and _composite_score(s) > me_score)
    rank = better + 1
    # percentile = share of cohort ranked AT or BELOW me.
    percentile = round(100 * (total - rank + 1) / total)
    return {"branch": branch, "rank": rank, "total": total, "percentile": percentile}


def _readiness_score(top_drive_fit: float, student: Dict[str, Any]) -> int:
    """Composite 0-100 readiness. Weighted blend of fit + achievement + role_fit."""
    enriched = student.get("profile_enriched") or {}
    ach = float(enriched.get("achievement_weight") or 0.0)
    role_fit = enriched.get("role_fit_signals") or {}
    top_rf = 0.0
    if role_fit:
        top_rf = max((float(v) for v in role_fit.values() if isinstance(v, (int, float))), default=0.0)
    raw = 0.4 * (top_drive_fit / 100.0) + 0.3 * ach + 0.3 * top_rf
    return max(0, min(100, round(raw * 100)))


def _well_positioned_roles(student: Dict[str, Any]) -> List[str]:
    """Top role_fit labels, formatted for hero text."""
    enriched = student.get("profile_enriched") or {}
    rf = enriched.get("role_fit_signals") or {}
    pairs = [(k, float(v)) for k, v in rf.items() if isinstance(v, (int, float)) and v >= 0.7]
    pairs.sort(key=lambda kv: kv[1], reverse=True)
    return [k.replace("_", " ") for k, _ in pairs[:3]]


def _company_map_demo() -> Dict[str, Dict[str, Any]]:
    return {c["id"]: c for c in DEMO_COMPANIES}


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.get("/{student_id}")
async def coach_student(student_id: str) -> Dict[str, Any]:
    # 1. Resolve student (demo OR real)
    student = demo_student_by_id(student_id) or select_one(T_STUDENTS, {"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    college_id = student.get("college_id")
    resume_text = (student.get("resume_text") or "").strip()
    synthetic_resume = False
    if not resume_text:
        # For demo students (and incomplete profiles), synthesize from enriched.
        resume_text = _synthesize_resume_text(student)
        synthetic_resume = True

    enriched = student.get("profile_enriched") or {}
    # If the profile has effectively no content, render the empty-state signal.
    has_signal = bool(
        enriched.get("skills") or enriched.get("projects") or enriched.get("summary")
    )
    if not has_signal and synthetic_resume:
        return {
            "student": _student_compact(student),
            "empty_profile": True,
            "readiness_score": 0,
            "top_drive_recommendations": [],
            "resume_quality": None,
            "skills_to_acquire": [],
            "peer_ranking": _compute_peer_ranking(student),
            "action_items": [],
            "message": "Complete your profile to unlock Career Coach.",
        }

    # 2. Rank drives for this student
    match_res = match_drives_for_student(student_id, limit=3)
    if match_res.get("error"):
        raise HTTPException(status_code=500, detail=match_res["error"])
    ranked = match_res.get("ranked") or []
    top_drives = ranked[:3]
    top_drive_fit = float(top_drives[0]["fit_score"]) if top_drives else 0.0

    # 3. Resolve full drive records (for jd_text + eligibility_rules) and signals
    drive_full_map: Dict[str, Dict[str, Any]] = {}
    drive_signals: Dict[str, Dict[str, Any]] = {}
    for d in top_drives:
        drv = d.get("drive") or {}
        drive_id = drv.get("id")
        if not drive_id:
            continue
        # Get the full drive row (jd_text + eligibility_rules).
        full = _fetch_drive_full(drive_id, college_id)
        if full:
            drive_full_map[drive_id] = full
            drv["jd_text"] = full.get("jd_text") or drv.get("jd_text")
            eligible, violations = _check_eligibility(student, full)
            d["eligible"] = eligible
            d["violations"] = violations
        sig = explain_fit(student_id, drive_id)
        if "error" not in sig:
            drive_signals[drive_id] = sig

    # 4. Deterministic resume stats
    bullets = _extract_bullets(resume_text)
    verb_stats = _compute_verb_diversity(bullets)
    quantified_ratio = _compute_quantified_ratio(bullets)

    # 5. Single LLM call for all the coaching prose
    llm_output: Optional[Dict[str, Any]] = None
    llm_error: Optional[str] = None
    try:
        from services.llm_client import generate_json, primary_backend  # type: ignore
        if primary_backend() == "none":
            raise RuntimeError("No LLM backend configured (need GROQ_API_KEY)")
        prompt = _build_coach_prompt(
            student=student,
            resume_text=resume_text,
            top_drives=top_drives,
            drive_signals=drive_signals,
            verb_stats=verb_stats,
            quantified_ratio=quantified_ratio,
        )
        llm_output = generate_json(
            prompt,
            system=COACH_SYSTEM_PROMPT,
            max_tokens=2800,
        )
    except Exception as e:
        llm_error = f"{type(e).__name__}: {str(e)[:200]}"
        print(f"[coach] LLM failed, degrading gracefully: {llm_error}")

    # 6. Build response. If LLM failed, we still return drives/stats with empty
    # prose so the frontend can show "Coach unavailable" banner.
    companies_by_id = _company_map_demo() if is_demo(college_id) else {}
    top_drive_payload = _build_drive_recommendations(
        top_drives=top_drives,
        drive_full_map=drive_full_map,
        companies_by_id=companies_by_id,
        llm_output=llm_output or {},
    )

    resume_quality = _build_resume_quality(
        llm_output=llm_output,
        verb_stats=verb_stats,
        quantified_ratio=quantified_ratio,
    )

    skills_to_acquire = (llm_output or {}).get("skills_to_acquire") or []
    action_items = (llm_output or {}).get("action_items") or []

    readiness = _readiness_score(top_drive_fit, student)
    peer_ranking = _compute_peer_ranking(student)
    positioned_roles = _well_positioned_roles(student)

    return {
        "student": _student_compact(student),
        "readiness_score": readiness,
        "drives_analysed": len(ranked),
        "positioned_roles": positioned_roles,
        "top_drive_recommendations": top_drive_payload,
        "resume_quality": resume_quality,
        "skills_to_acquire": skills_to_acquire,
        "peer_ranking": peer_ranking,
        "action_items": action_items,
        "llm_error": llm_error,
        "synthetic_resume": synthetic_resume,
    }


# ---------------------------------------------------------------------------
# Response-shaping helpers
# ---------------------------------------------------------------------------

def _student_compact(student: Dict[str, Any]) -> Dict[str, Any]:
    enriched = student.get("profile_enriched") or {}
    return {
        "id": student.get("id"),
        "name": student.get("name"),
        "email": student.get("email"),
        "branch": student.get("branch"),
        "year": student.get("year"),
        "cgpa": student.get("cgpa"),
        "backlogs_active": student.get("backlogs_active"),
        "institution_tier": enriched.get("institution_tier"),
        "achievement_weight": enriched.get("achievement_weight"),
    }


def _fetch_drive_full(drive_id: str, college_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if is_demo(college_id):
        from ..services.demo_store import demo_drive_by_id
        return demo_drive_by_id(drive_id)
    try:
        return select_one("campus_drives", {"id": drive_id})
    except Exception:
        return None


def _build_drive_recommendations(
    top_drives: List[Dict[str, Any]],
    drive_full_map: Dict[str, Dict[str, Any]],
    companies_by_id: Dict[str, Dict[str, Any]],
    llm_output: Dict[str, Any],
) -> List[Dict[str, Any]]:
    # Index LLM per-drive output by drive_id
    llm_recs_raw = llm_output.get("top_drive_recommendations") or []
    llm_by_drive: Dict[str, Dict[str, Any]] = {}
    for idx, rec in enumerate(llm_recs_raw):
        if not isinstance(rec, dict):
            continue
        key = rec.get("drive_id") or (top_drives[idx]["drive"]["id"] if idx < len(top_drives) else None)
        if key:
            llm_by_drive[key] = rec

    out: List[Dict[str, Any]] = []
    for d in top_drives:
        drv = d.get("drive") or {}
        drive_id = drv.get("id")
        rec = llm_by_drive.get(drive_id) or {}
        company_id = None
        # Try to extract company_id from the full drive row (not in the match result).
        full = drive_full_map.get(drive_id) or {}
        company_id = full.get("company_id") or drv.get("company_id")
        company_blob = companies_by_id.get(company_id) if company_id else None
        company_name = drv.get("company") or (company_blob or {}).get("name")
        tier = drv.get("tier") or (company_blob or {}).get("tier")
        out.append(
            {
                "drive": {
                    "id": drive_id,
                    "role": drv.get("role"),
                    "company": company_name,
                    "tier": tier,
                    "location": drv.get("location"),
                    "ctc_offered": drv.get("ctc_offered"),
                    "scheduled_date": drv.get("scheduled_date"),
                },
                "fit_score": d.get("fit_score"),
                "eligible": d.get("eligible"),
                "violations": d.get("violations") or [],
                "why_fit": rec.get("why_fit") or [],
                "gap": rec.get("gap") or [],
            }
        )
    return out


def _build_resume_quality(
    llm_output: Optional[Dict[str, Any]],
    verb_stats: Dict[str, Any],
    quantified_ratio: float,
) -> Dict[str, Any]:
    rq = (llm_output or {}).get("resume_quality") or {}
    # Clamp score; if LLM failed, infer a baseline from quant ratio + diversity.
    if "score" in rq:
        try:
            score = int(max(0, min(100, int(rq["score"]))))
        except (TypeError, ValueError):
            score = None
    else:
        score = None
    if score is None:
        # Fallback baseline.
        score = round(40 + 40 * quantified_ratio + 20 * min(1.0, verb_stats.get("score", 0.0)))
        score = max(0, min(100, score))

    return {
        "score": score,
        "strengths": rq.get("strengths") or [],
        "weaknesses": rq.get("weaknesses") or [],
        "verb_diversity": verb_stats,
        "quantified_impact_ratio": quantified_ratio,
    }
