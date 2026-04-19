"""
Canned chat fallback — runs when Gemini is unavailable (429, missing key, etc.)

Strategy: keyword-based intent detection → deterministic tool plan →
formatted Markdown response. Less clever than the real agent, but always
produces a useful answer. Used to keep demo mode working in any state.

Events yielded match the real orchestrator's SSE vocabulary so the frontend
handles both paths identically.
"""
from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional

from .tools import (
    search_students, semantic_rank, fetch_drive,
    check_eligibility, get_student_profile, explain_fit,
)
from .demo_store import DEMO_DRIVES, DEMO_STUDENTS


def _event(type_: str, **kwargs) -> Dict[str, Any]:
    return {"type": type_, "ts": time.time(), **kwargs}


# ---------------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------------

def _find_referenced_drive(query: str) -> Optional[Dict[str, Any]]:
    """Match query against demo drive roles/companies by keyword."""
    q = query.lower()
    role_keywords = {
        "quant": "d2000000-0000-0000-0000-000000000001",
        "analyst": "d2000000-0000-0000-0000-000000000001",
        "goldman": "d2000000-0000-0000-0000-000000000001",
        "finance": "d2000000-0000-0000-0000-000000000001",
        "ib": "d2000000-0000-0000-0000-000000000001",
        "backend": "d2000000-0000-0000-0000-000000000002",
        "zomato": "d2000000-0000-0000-0000-000000000002",
        "gurgaon": "d2000000-0000-0000-0000-000000000002",
        "ml": "d2000000-0000-0000-0000-000000000003",
        "machine learning": "d2000000-0000-0000-0000-000000000003",
        "microsoft": "d2000000-0000-0000-0000-000000000003",
        "product": "d2000000-0000-0000-0000-000000000004",
        "cred": "d2000000-0000-0000-0000-000000000004",
    }
    for kw, drive_id in role_keywords.items():
        if kw in q:
            for d in DEMO_DRIVES:
                if d["id"] == drive_id:
                    return d
    return None


def _extract_filters(query: str) -> Dict[str, Any]:
    """Pull structured filters out of free text."""
    q = query.lower()
    out: Dict[str, Any] = {}

    # CGPA threshold
    m = re.search(r"cgpa\s*(?:>|above|>=|over|greater than)\s*(\d+\.?\d*)", q)
    if m: out["min_cgpa"] = float(m.group(1))

    # Branch
    for b in ["cse", "ece", "ee", "me", "civil", "it", "chem", "mba"]:
        if re.search(rf"\b{b}\b", q):
            out["branch"] = b.upper()
            break

    # Year
    m = re.search(r"\b(202[4-8])\b", query)
    if m: out["year"] = int(m.group(1))

    # Placed status
    if "unplaced" in q: out["placed_status"] = "unplaced"
    elif "placed" in q and "unplaced" not in q: out["placed_status"] = "placed"

    # Backlog constraints
    if re.search(r"no\s*(active)?\s*backlog", q): out["max_active_backlogs"] = 0

    # Gender (compliance-sensitive)
    if re.search(r"\b(male)\b", q) and "female" not in q: out["gender"] = "male"
    elif re.search(r"\bfemale\b", q): out["gender"] = "female"

    # City
    for city in ["gurgaon", "bengaluru", "mumbai", "delhi", "chennai", "hyderabad", "pune", "kolkata"]:
        if city in q:
            out["current_city"] = city.capitalize()
            break

    return out


def _extract_limit(query: str, default: int = 5) -> int:
    m = re.search(r"top\s*(\d+)", query.lower())
    if m: return min(int(m.group(1)), 20)
    m = re.search(r"(\d+)\s*(best|top|candidates|students)", query.lower())
    if m: return min(int(m.group(1)), 20)
    return default


# ---------------------------------------------------------------------------
# Response formatting
# ---------------------------------------------------------------------------

def _fmt_student_row(s: Dict[str, Any], score: Optional[float] = None, rationale: Optional[str] = None) -> str:
    head = f"**{s.get('name', '?')}** · {s.get('branch', '?')} · CGPA {s.get('cgpa', '—')}"
    if score is not None:
        head += f" · fit {score}"
    if s.get("backlogs_active"):
        head += f" · {s['backlogs_active']} active backlog(s)"
    if rationale:
        return f"- {head}\n  {rationale}"
    return f"- {head}"


def _build_rationale_from_signals(signals: Dict[str, Any]) -> str:
    bits: List[str] = []
    if signals.get("skill_overlap_with_jd"):
        bits.append("Skills: " + ", ".join(signals["skill_overlap_with_jd"][:5]))
    if signals.get("top_role_fits"):
        top = signals["top_role_fits"][0]
        bits.append(f"Strong {top['role'].replace('_', ' ')} signal ({top['score']})")
    if signals.get("passion_alignment"):
        bits.append("Passion fit: " + ", ".join(signals["passion_alignment"][:2]))
    if not bits and signals.get("summary"):
        bits.append(signals["summary"][:140])
    return ". ".join(bits) + ("." if bits else "")


def _fmt_compliance_notice(warnings: List[str]) -> str:
    if not warnings:
        return ""
    return "\n\n> ⚠ **Compliance notice:** " + " ".join(warnings)


# ---------------------------------------------------------------------------
# Plan executors
# ---------------------------------------------------------------------------

async def run_fallback_stream(
    college_id: str,
    user_message: str,
    drive_context_id: Optional[str] = None,
):
    """Async generator yielding the same SSE event shape as the real orchestrator."""
    yield _event("thinking", iteration=1, fallback=True)

    # 1. Resolve drive context (explicit pin > inferred from query)
    drive = None
    if drive_context_id:
        drive_res = fetch_drive(drive_context_id)
        if "error" not in drive_res:
            drive = drive_res
            yield _event("tool_call", name="fetch_drive", args={"drive_id": drive_context_id})
            yield _event("tool_result", name="fetch_drive", result=drive)
    if drive is None:
        inferred = _find_referenced_drive(user_message)
        if inferred:
            yield _event("tool_call", name="fetch_drive", args={"drive_id": inferred["id"]})
            drive = fetch_drive(inferred["id"])
            yield _event("tool_result", name="fetch_drive", result=drive)

    # 2. Extract structured filters from the query
    filters = _extract_filters(user_message)
    limit = _extract_limit(user_message, default=5)

    # 3. Run the right tool chain based on whether we have drive context
    if drive and "error" not in drive:
        response_text, warning = await _drive_ranking_plan(college_id, drive, user_message, limit, filters, yield_event=None)
        async for ev in _drive_ranking_events(college_id, drive, user_message, filters, limit):
            yield ev
    else:
        # No drive — either filter-only or open-ended semantic query
        if filters:
            async for ev in _filter_plan(college_id, user_message, filters, limit):
                yield ev
        else:
            async for ev in _semantic_only_plan(college_id, user_message, limit):
                yield ev

    yield _event("done")


# ---------------------------------------------------------------------------
# Sub-plans (each is an async generator that yields SSE events)
# ---------------------------------------------------------------------------

async def _drive_ranking_events(college_id: str, drive: Dict[str, Any], query: str, filters: Dict[str, Any], limit: int):
    """Plan: filter eligible students → semantic rank by JD → explain top N."""
    # Narrow pool by drive's eligibility rules + any query-stated filters
    rules = drive.get("eligibility_rules") or {}
    merged_filters = {
        "branch": filters.get("branch"),
        "year": filters.get("year") or (rules.get("allowed_years") or [None])[0],
        "min_cgpa": filters.get("min_cgpa") or rules.get("min_cgpa"),
        "max_active_backlogs": filters.get("max_active_backlogs") or rules.get("max_active_backlogs"),
        "gender": filters.get("gender") or rules.get("gender_restriction"),
        "current_city": filters.get("current_city"),
        "placed_status": filters.get("placed_status") or "unplaced",
    }
    # Drop empty filters
    search_args = {k: v for k, v in merged_filters.items() if v is not None}
    search_args["college_id"] = college_id

    yield _event("tool_call", name="search_students", args={k: v for k, v in search_args.items() if k != "college_id"})
    search_res = search_students(**search_args)
    yield _event("tool_result", name="search_students", result=search_res)

    if "error" in search_res or not search_res.get("students"):
        yield _event("assistant_message", content=f"No eligible students found for **{drive.get('role')}** with those filters.")
        return

    student_ids = [s["id"] for s in search_res["students"]]
    rank_query = (drive.get("jd_text") or "") + "\n" + query
    yield _event("tool_call", name="semantic_rank", args={"query_text": rank_query[:200] + "...", "student_ids": f"[{len(student_ids)} ids]", "limit": limit})
    rank_res = semantic_rank(college_id=college_id, query_text=rank_query, student_ids=student_ids, limit=limit)
    yield _event("tool_result", name="semantic_rank", result=rank_res)

    if "error" in rank_res or not rank_res.get("ranked"):
        yield _event("assistant_message", content="Couldn't rank candidates. Try rephrasing the query.")
        return

    # 3. explain_fit on the top 3 for juicy rationale
    lines: List[str] = []
    for entry in rank_res["ranked"][:3]:
        sid = entry["student"]["id"]
        yield _event("tool_call", name="explain_fit", args={"student_id": sid, "drive_id": drive["id"]})
        fit = explain_fit(sid, drive["id"])
        yield _event("tool_result", name="explain_fit", result=fit)
        rationale = _build_rationale_from_signals(fit.get("signals") or {})
        lines.append(_fmt_student_row(entry["student"], score=entry["fit_score"], rationale=rationale))

    # Remaining rows without deep rationale
    for entry in rank_res["ranked"][3:limit]:
        lines.append(_fmt_student_row(entry["student"], score=entry["fit_score"]))

    header = f"### Top {len(lines)} fits for **{drive.get('role')}**"
    body = "\n".join(lines)
    warning_text = _fmt_compliance_notice(search_res.get("warnings") or [])
    yield _event("assistant_message", content=f"{header}\n\n{body}{warning_text}")


async def _filter_plan(college_id: str, query: str, filters: Dict[str, Any], limit: int):
    """Plan: search_students with parsed filters, no drive context."""
    args = {**filters, "college_id": college_id, "limit": limit}
    yield _event("tool_call", name="search_students", args={k: v for k, v in args.items() if k != "college_id"})
    res = search_students(**args)
    yield _event("tool_result", name="search_students", result=res)

    if "error" in res or not res.get("students"):
        yield _event("assistant_message", content="No matching students.")
        return

    lines = [_fmt_student_row(s) for s in res["students"][:limit]]
    header = f"### {res['count']} match{'es' if res['count'] != 1 else ''}"
    warning_text = _fmt_compliance_notice(res.get("warnings") or [])
    yield _event("assistant_message", content=f"{header}\n\n" + "\n".join(lines) + warning_text)


async def _semantic_only_plan(college_id: str, query: str, limit: int):
    """Plan: semantic rank across the whole college, no filters."""
    yield _event("tool_call", name="semantic_rank", args={"query_text": query[:100] + "...", "limit": limit})
    res = semantic_rank(college_id=college_id, query_text=query, limit=limit)
    yield _event("tool_result", name="semantic_rank", result=res)

    if "error" in res or not res.get("ranked"):
        yield _event("assistant_message", content="No matches. Try adding filters like branch or CGPA.")
        return

    lines = [_fmt_student_row(e["student"], score=e["fit_score"]) for e in res["ranked"][:limit]]
    yield _event("assistant_message", content=f"### Top {len(lines)} by fit\n\n" + "\n".join(lines))


async def _drive_ranking_plan(*args, **kwargs):
    """Deprecated — use _drive_ranking_events directly."""
    return "", None
