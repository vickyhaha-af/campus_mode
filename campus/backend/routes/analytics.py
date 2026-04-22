"""
Analytics for the PC Dashboard.

Five endpoints, each taking ``college_id`` and branching on ``is_demo``:

- ``GET /api/campus/analytics/funnel`` — stage-by-stage conversion counts.
- ``GET /api/campus/analytics/branch-breakdown`` — placed vs unplaced per branch.
- ``GET /api/campus/analytics/drives-performance`` — per-drive conversion heatmap.
- ``GET /api/campus/analytics/needs-attention`` — actionable alerts for today.
- ``GET /api/campus/drives/{drive_id}/bias-audit`` — shortlist vs pool skew check.

Demo mode computes over ``DEMO_STUDENTS`` / ``DEMO_DRIVES`` and the in-memory
``_DEMO_SHORTLISTS`` store from ``shortlists.py`` so a demo admin sees real
series derived from whatever they've staged in this session.

The bias audit uses percentage-point deltas instead of chi-square — it's the
same signal at the scale we care about (5-50 candidates per shortlist), and
avoids adding scipy as a hard dependency.
"""
from __future__ import annotations

from datetime import datetime, timezone, date
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query

from ..db import (
    T_DRIVES, T_STUDENTS, T_SHORTLISTS, T_COMPANIES,
    select_many, select_one,
)
from ..services.demo_store import (
    is_demo, DEMO_DRIVES, DEMO_STUDENTS, DEMO_COMPANIES,
    demo_drive_by_id, demo_student_by_id,
)


router = APIRouter(prefix="/api/campus", tags=["campus:analytics"])


# ---- funnel stages (must match shortlists.VALID_STAGES) ---------------------

FUNNEL_STAGES: List[Tuple[str, str]] = [
    ("shortlisted",  "Shortlisted"),
    ("interview_1",  "Interview R1"),
    ("interview_2",  "Interview R2"),
    ("offered",      "Offered"),
    ("accepted",     "Accepted"),
    ("joined",       "Joined"),
]

# Terminal, stage-ordered rank for "at least this stage".
_STAGE_RANK = {
    "shortlisted": 0, "interview_1": 1, "interview_2": 2, "interview_3": 3,
    "offered": 4, "accepted": 5, "joined": 6,
    # exit stages — count only toward their own rank floor
    "rejected": -1, "withdrawn": -1,
}


def _demo_shortlists_for_college(college_id: str) -> List[Dict[str, Any]]:
    """Join in-memory demo shortlists to demo drives for this college."""
    try:
        from .shortlists import _DEMO_SHORTLISTS  # type: ignore
    except Exception:
        return []
    drive_ids = {d["id"] for d in DEMO_DRIVES if d.get("college_id") == college_id}
    return [r for r in _DEMO_SHORTLISTS.values() if r.get("drive_id") in drive_ids]


def _conversion_pct(a: int, b: int) -> Optional[float]:
    if not b:
        return None
    return round(100.0 * a / b, 1)


# =============================================================================
# 1. FUNNEL
# =============================================================================

@router.get("/analytics/funnel")
async def analytics_funnel(college_id: str = Query(...)):
    """
    Return counts per funnel stage plus conversion % relative to the previous
    stage. The ``at_least`` count includes candidates who have progressed past
    the stage — the natural "pipeline reached" metric.
    """
    if is_demo(college_id):
        shortlists = _demo_shortlists_for_college(college_id)
    else:
        # Real mode — gather drives for this college, then shortlists for each.
        drives = select_many(T_DRIVES, filters={"college_id": college_id}, limit=1000)
        shortlists = []
        for d in drives:
            shortlists.extend(
                select_many(T_SHORTLISTS, filters={"drive_id": d["id"]}, limit=1000) or []
            )

    # Count candidates who have reached each stage (rank >= stage rank).
    ranks = [
        _STAGE_RANK.get(r.get("stage"), -1)
        for r in shortlists
        if _STAGE_RANK.get(r.get("stage"), -1) >= 0
    ]

    series = []
    prev_count: Optional[int] = None
    for key, label in FUNNEL_STAGES:
        target_rank = _STAGE_RANK[key]
        count = sum(1 for r in ranks if r >= target_rank)
        conversion = _conversion_pct(count, prev_count) if prev_count is not None else None
        series.append({
            "key": key,
            "label": label,
            "count": count,
            "conversion_from_prev": conversion,
        })
        prev_count = count

    total_shortlists = len(shortlists)
    return {
        "empty": total_shortlists == 0,
        "total_shortlists": total_shortlists,
        "series": series,
    }


# =============================================================================
# 2. BRANCH BREAKDOWN
# =============================================================================

@router.get("/analytics/branch-breakdown")
async def analytics_branch_breakdown(college_id: str = Query(...)):
    """Per-branch totals of placed vs unplaced students."""
    if is_demo(college_id):
        students = [s for s in DEMO_STUDENTS if s.get("college_id") == college_id]
        # In demo data all students start unplaced. Synthesise "placed"
        # from any shortlist that reached offered+ so the chart has signal.
        demo_sl = _demo_shortlists_for_college(college_id)
        placed_ids = {
            r["student_id"] for r in demo_sl
            if _STAGE_RANK.get(r.get("stage"), -1) >= _STAGE_RANK["offered"]
        }
    else:
        students = select_many(T_STUDENTS, filters={"college_id": college_id}, limit=5000) or []
        placed_ids = {
            s["id"] for s in students if (s.get("placed_status") or "").lower() == "placed"
        }

    by_branch: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "placed": 0})
    for s in students:
        br = s.get("branch") or "Unknown"
        by_branch[br]["total"] += 1
        if (s.get("placed_status") or "").lower() == "placed" or s.get("id") in placed_ids:
            by_branch[br]["placed"] += 1

    series = []
    for br, counts in sorted(by_branch.items()):
        placed = counts["placed"]
        total = counts["total"]
        series.append({
            "branch": br,
            "total": total,
            "placed": placed,
            "unplaced": max(0, total - placed),
            "placement_rate": _conversion_pct(placed, total),
        })

    return {"empty": not series, "series": series}


# =============================================================================
# 3. DRIVES PERFORMANCE HEATMAP
# =============================================================================

def _company_lookup(college_id: str) -> Dict[str, Dict[str, Any]]:
    if is_demo(college_id):
        return {c["id"]: c for c in DEMO_COMPANIES}
    rows = select_many(T_COMPANIES, filters={"college_id": college_id}, limit=1000) or []
    return {r["id"]: r for r in rows}


@router.get("/analytics/drives-performance")
async def analytics_drives_performance(college_id: str = Query(...)):
    """
    One row per drive: role, company, shortlisted, offered, conversion %, status.
    """
    if is_demo(college_id):
        drives = [d for d in DEMO_DRIVES if d.get("college_id") == college_id]
        all_sl = _demo_shortlists_for_college(college_id)
        sl_by_drive: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for r in all_sl:
            sl_by_drive[r["drive_id"]].append(r)
    else:
        drives = select_many(T_DRIVES, filters={"college_id": college_id}, limit=1000) or []
        sl_by_drive = {}
        for d in drives:
            sl_by_drive[d["id"]] = select_many(
                T_SHORTLISTS, filters={"drive_id": d["id"]}, limit=1000
            ) or []

    companies = _company_lookup(college_id)

    rows = []
    for d in drives:
        sl = sl_by_drive.get(d["id"], [])
        shortlisted = len(sl)
        offered = sum(
            1 for r in sl
            if _STAGE_RANK.get(r.get("stage"), -1) >= _STAGE_RANK["offered"]
        )
        conv = _conversion_pct(offered, shortlisted)
        comp = companies.get(d.get("company_id") or "") or {}
        rows.append({
            "drive_id": d["id"],
            "role": d.get("role"),
            "company_name": comp.get("name"),
            "company_tier": comp.get("tier"),
            "status": d.get("status"),
            "scheduled_date": d.get("scheduled_date"),
            "shortlisted": shortlisted,
            "offered": offered,
            "conversion_pct": conv,
        })

    # Sort: drives with data first, then by conversion desc, then by date.
    rows.sort(
        key=lambda r: (
            r["shortlisted"] == 0,
            -(r["conversion_pct"] or 0),
            str(r["scheduled_date"] or ""),
        )
    )
    return {"empty": not rows, "series": rows}


# =============================================================================
# 4. NEEDS ATTENTION
# =============================================================================

def _parse_date(v: Any) -> Optional[date]:
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    try:
        return datetime.fromisoformat(str(v).split("T")[0]).date()
    except Exception:
        return None


def _student_passes_rules(student: Dict[str, Any], rules: Dict[str, Any]) -> bool:
    if not rules:
        return True
    if rules.get("min_cgpa") is not None and (student.get("cgpa") or 0) < rules["min_cgpa"]:
        return False
    if rules.get("max_active_backlogs") is not None and \
            (student.get("backlogs_active") or 0) > rules["max_active_backlogs"]:
        return False
    if rules.get("allowed_branches") and \
            student.get("branch") not in rules["allowed_branches"]:
        return False
    if rules.get("allowed_years") and \
            student.get("year") not in rules["allowed_years"]:
        return False
    gr = rules.get("gender_restriction")
    if gr and (student.get("gender") or "").lower() != gr.lower():
        return False
    return True


@router.get("/analytics/needs-attention")
async def analytics_needs_attention(college_id: str = Query(...)):
    """
    Actionable alerts the admin should handle today. Returns a list of items
    each with ``kind``, ``icon`` (lucide name), ``headline``, ``detail``, and
    ``action`` (frontend-route + label).
    """
    today = datetime.now(timezone.utc).date()

    if is_demo(college_id):
        drives = [d for d in DEMO_DRIVES if d.get("college_id") == college_id]
        students = [s for s in DEMO_STUDENTS if s.get("college_id") == college_id]
        all_sl = _demo_shortlists_for_college(college_id)
    else:
        drives = select_many(T_DRIVES, filters={"college_id": college_id}, limit=1000) or []
        students = select_many(T_STUDENTS, filters={"college_id": college_id}, limit=5000) or []
        all_sl = []
        for d in drives:
            all_sl.extend(
                select_many(T_SHORTLISTS, filters={"drive_id": d["id"]}, limit=2000) or []
            )

    sl_by_drive: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    sl_by_student: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in all_sl:
        sl_by_drive[r.get("drive_id")].append(r)
        sl_by_student[r.get("student_id")].append(r)

    items: List[Dict[str, Any]] = []

    # (a) Drives past scheduled_date with zero shortlists.
    for d in drives:
        sched = _parse_date(d.get("scheduled_date"))
        if sched and sched < today and not sl_by_drive.get(d["id"]):
            items.append({
                "kind": "stale_drive",
                "icon": "AlertTriangle",
                "severity": "high",
                "headline": f"{d.get('role') or 'Drive'} has no shortlist yet",
                "detail": f"Scheduled {sched.isoformat()} — past date with zero shortlisted students.",
                "action": {"to": f"/campus/drives/{d['id']}", "label": "Open drive"},
            })

    # (b) Students with 2+ rejected/withdrawn shortlists and still unplaced.
    for s in students:
        if (s.get("placed_status") or "").lower() == "placed":
            continue
        fails = sum(
            1 for r in sl_by_student.get(s["id"], [])
            if r.get("stage") in ("rejected", "withdrawn")
        )
        if fails >= 2:
            items.append({
                "kind": "struggling_student",
                "icon": "UserX",
                "severity": "medium",
                "headline": f"{s.get('name')} — {fails} rejections, still unplaced",
                "detail": f"{s.get('branch') or '—'} · CGPA {s.get('cgpa') or '—'}. Consider targeted outreach.",
                "action": {"to": f"/campus/students", "label": "Browse students"},
            })

    # (c) Drives closing in <7 days with no offer/accept progress.
    for d in drives:
        sched = _parse_date(d.get("scheduled_date"))
        if not sched or sched < today:
            continue
        if (sched - today).days > 7:
            continue
        if (d.get("status") or "").lower() == "closed":
            continue
        sl = sl_by_drive.get(d["id"], [])
        n_shortlisted = len(sl)
        n_progressed = sum(
            1 for r in sl
            if _STAGE_RANK.get(r.get("stage"), -1) >= _STAGE_RANK["interview_1"]
        )
        if n_shortlisted < 5 or (n_shortlisted and n_progressed == 0):
            items.append({
                "kind": "closing_soon",
                "icon": "Clock",
                "severity": "high",
                "headline": f"{d.get('role') or 'Drive'} closes in {(sched - today).days} day(s)",
                "detail": (
                    f"Only {n_shortlisted} shortlisted, {n_progressed} progressed. "
                    "Tighten the pipeline before deadline."
                ),
                "action": {"to": f"/campus/drives/{d['id']}", "label": "Open drive"},
            })

    # (d) Eligible students not shortlisted for an upcoming drive.
    for d in drives:
        sched = _parse_date(d.get("scheduled_date"))
        if not sched or sched < today:
            continue
        if (d.get("status") or "").lower() == "closed":
            continue
        rules = d.get("eligibility_rules") or {}
        eligible = [s for s in students if _student_passes_rules(s, rules) and
                    (s.get("placed_status") or "").lower() != "placed"]
        shortlisted_ids = {r.get("student_id") for r in sl_by_drive.get(d["id"], [])}
        missed = [s for s in eligible if s["id"] not in shortlisted_ids]
        if missed and len(missed) >= max(3, int(0.2 * max(1, len(eligible)))):
            items.append({
                "kind": "eligible_not_shortlisted",
                "icon": "Users",
                "severity": "medium",
                "headline": (
                    f"{len(missed)} eligible students not shortlisted "
                    f"for {d.get('role')}"
                ),
                "detail": (
                    f"{len(eligible)} pass the eligibility rules. Review before the drive closes."
                ),
                "action": {"to": f"/campus/drives/{d['id']}", "label": "Review shortlist"},
            })

    # Stable ordering: severity high first, then insertion order.
    severity_rank = {"high": 0, "medium": 1, "low": 2}
    items.sort(key=lambda it: severity_rank.get(it.get("severity", "low"), 3))

    return {"empty": not items, "items": items[:20]}


# =============================================================================
# 5. BIAS AUDIT  (per drive)
# =============================================================================

def _pct_map(values: List[str]) -> Dict[str, float]:
    total = len(values)
    if total == 0:
        return {}
    c = Counter(v or "unknown" for v in values)
    return {k: round(100.0 * n / total, 1) for k, n in c.items()}


def _infer_tier(student: Dict[str, Any]) -> str:
    """Best-effort institution tier — falls back to profile_enriched.institution_tier."""
    pe = student.get("profile_enriched") or {}
    t = pe.get("institution_tier") or student.get("institution_tier")
    return (t or "unknown").lower()


def _delta_dimension(shortlist_vals: List[str], pool_vals: List[str]) -> Dict[str, Any]:
    """Percentages side-by-side + biggest absolute delta (percentage points)."""
    sl_pct = _pct_map(shortlist_vals)
    pool_pct = _pct_map(pool_vals)
    keys = set(sl_pct) | set(pool_pct)
    rows = []
    max_delta = 0.0
    max_key = None
    for k in sorted(keys):
        a = sl_pct.get(k, 0.0)
        b = pool_pct.get(k, 0.0)
        delta = round(a - b, 1)
        rows.append({"key": k, "shortlist_pct": a, "pool_pct": b, "delta": delta})
        if abs(delta) > abs(max_delta):
            max_delta = delta
            max_key = k
    return {
        "rows": rows,
        "max_delta": max_delta,
        "max_delta_key": max_key,
        "skewed": abs(max_delta) > 15.0,
    }


@router.get("/drives/{drive_id}/bias-audit")
async def drive_bias_audit(drive_id: str):
    """
    Compare shortlist composition against the eligible-pool composition for
    a drive. Flags dimensions where any single category differs by more than
    15 percentage points.
    """
    # Resolve drive + shortlists + pool.
    demo = demo_drive_by_id(drive_id)
    if demo:
        drive = demo
        college_id = drive.get("college_id")
        try:
            from .shortlists import _DEMO_SHORTLISTS  # type: ignore
            sl_rows = [r for r in _DEMO_SHORTLISTS.values() if r.get("drive_id") == drive_id]
        except Exception:
            sl_rows = []
        sl_students = [demo_student_by_id(r["student_id"]) for r in sl_rows]
        sl_students = [s for s in sl_students if s]
        all_students = [s for s in DEMO_STUDENTS if s.get("college_id") == college_id]
    else:
        drive = select_one(T_DRIVES, {"id": drive_id})
        if not drive:
            raise HTTPException(status_code=404, detail="Drive not found")
        college_id = drive.get("college_id")
        sl_rows = select_many(T_SHORTLISTS, filters={"drive_id": drive_id}, limit=1000) or []
        sl_students = []
        for r in sl_rows:
            s = select_one(T_STUDENTS, {"id": r["student_id"]}) if r.get("student_id") else None
            if s: sl_students.append(s)
        all_students = select_many(
            T_STUDENTS, filters={"college_id": college_id}, limit=5000
        ) or []

    rules = drive.get("eligibility_rules") or {}
    pool = [s for s in all_students if _student_passes_rules(s, rules)]

    if len(sl_students) < 5:
        return {
            "eligible": False,
            "reason": "Need at least 5 shortlisted students for a meaningful audit.",
            "shortlist_size": len(sl_students),
            "pool_size": len(pool),
        }

    dims: Dict[str, Any] = {}

    # Branch
    dims["branch"] = _delta_dimension(
        [s.get("branch") or "unknown" for s in sl_students],
        [s.get("branch") or "unknown" for s in pool],
    )

    # Gender — only if pool has any gender info.
    pool_genders = [s.get("gender") for s in pool if s.get("gender")]
    if pool_genders:
        dims["gender"] = _delta_dimension(
            [s.get("gender") or "unknown" for s in sl_students],
            [s.get("gender") or "unknown" for s in pool],
        )

    # Institution tier
    pool_tiers = [_infer_tier(s) for s in pool if _infer_tier(s) != "unknown"]
    if pool_tiers:
        dims["institution_tier"] = _delta_dimension(
            [_infer_tier(s) for s in sl_students],
            [_infer_tier(s) for s in pool],
        )

    # Pick skew level based on max delta across dimensions.
    flagged = [k for k, d in dims.items() if d["skewed"]]
    monitor = [
        k for k, d in dims.items()
        if not d["skewed"] and abs(d["max_delta"]) > 8.0
    ]
    if flagged:
        skew_level = "flag"
    elif monitor:
        skew_level = "monitor"
    else:
        skew_level = "none"

    recommendations: List[str] = []
    for k in flagged:
        d = dims[k]
        direction = "over" if d["max_delta"] > 0 else "under"
        recommendations.append(
            f"Skew detected on {k} — shortlist is {d['max_delta_key']} "
            f"{direction}-represented by {abs(d['max_delta']):.1f} percentage points "
            "vs the eligible pool. Consider reviewing."
        )
    if not recommendations and monitor:
        recommendations.append(
            "Composition is close to the eligible pool. Keep an eye on "
            + ", ".join(monitor) + "."
        )

    return {
        "eligible": True,
        "drive_id": drive_id,
        "shortlist_size": len(sl_students),
        "pool_size": len(pool),
        "skew_level": skew_level,
        "dimensions": dims,
        "recommendations": recommendations,
    }
