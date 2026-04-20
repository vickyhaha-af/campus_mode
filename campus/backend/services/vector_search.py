"""
pgvector-backed similarity search helpers.

Two entry points:
  • match_students_by_embedding(college_id, query_emb, student_ids=None, limit=20)
  • match_drives_by_embedding(college_id, query_emb, limit=20)

Both prefer a Postgres RPC (match_campus_students / match_campus_drives) that
wraps `embedding <=> query` with an efficient ivfflat index. If the RPC isn't
present, we gracefully fall back to fetching the raw embedding column and
computing cosine similarity in Python — slow on big pools, but keeps the
agent functional without requiring an SQL migration.

Cosine similarity is returned in the range [0.0, 1.0] (we map the pgvector
distance `d` via `similarity = 1 - d`, then clamp).
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from ..db import T_STUDENTS, T_DRIVES, raw_client


def _looks_like_missing_rpc(err: BaseException) -> bool:
    msg = str(err).lower()
    return (
        "does not exist" in msg
        or "pgrst202" in msg
        or "could not find the function" in msg
        or "function public." in msg
        or "no function matches" in msg
        or "42883" in msg  # undefined_function
    )


def _cosine(a: List[float], b: List[float]) -> float:
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


def _parse_embedding(value: Any) -> Optional[List[float]]:
    """Supabase returns vector columns as JSON arrays or strings — handle both."""
    if value is None:
        return None
    if isinstance(value, list):
        return [float(x) for x in value]
    if isinstance(value, str):
        s = value.strip()
        if s.startswith("[") and s.endswith("]"):
            try:
                parts = [p.strip() for p in s[1:-1].split(",") if p.strip()]
                return [float(p) for p in parts]
            except ValueError:
                return None
    return None


# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

def match_students_by_embedding(
    college_id: str,
    query_embedding: List[float],
    student_ids: Optional[List[str]] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Return [{id, name, branch, year, cgpa, profile_enriched, similarity}, …]."""
    client = raw_client()

    # Preferred: RPC that does the math server-side.
    try:
        payload = {
            "p_college_id": college_id,
            "p_query": query_embedding,
            "p_limit": limit,
        }
        if student_ids:
            payload["p_student_ids"] = student_ids
        res = client.rpc("match_campus_students", payload).execute()
        rows = getattr(res, "data", None) or []
        if rows:
            return [
                {**r, "similarity": float(r.get("similarity") or r.get("score") or 0.0)}
                for r in rows
            ]
    except Exception as e:  # noqa: BLE001
        if not _looks_like_missing_rpc(e):
            # Surface non-"missing" errors so we don't silently hide real bugs
            # like a bad embedding dim. But still fall back — the agent must
            # get SOME answer.
            print(f"[vector_search] students RPC error, falling back: {e}")

    # Fallback: client-side cosine over the pool.
    q = client.table(T_STUDENTS).select(
        "id,name,branch,year,cgpa,backlogs_active,placed_status,profile_enriched,embedding_summary"
    ).eq("college_id", college_id)
    if student_ids:
        q = q.in_("id", student_ids)
    res = q.limit(500).execute()
    rows = getattr(res, "data", None) or []

    scored: List[Dict[str, Any]] = []
    for r in rows:
        emb = _parse_embedding(r.get("embedding_summary"))
        sim = _cosine(query_embedding, emb) if emb else 0.0
        out = {k: v for k, v in r.items() if k != "embedding_summary"}
        out["similarity"] = sim
        scored.append(out)
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:limit]


# ---------------------------------------------------------------------------
# Drives
# ---------------------------------------------------------------------------

def match_drives_by_embedding(
    college_id: str,
    query_embedding: List[float],
    limit: int = 20,
) -> List[Dict[str, Any]]:
    client = raw_client()
    try:
        res = client.rpc(
            "match_campus_drives",
            {"p_college_id": college_id, "p_query": query_embedding, "p_limit": limit},
        ).execute()
        rows = getattr(res, "data", None) or []
        if rows:
            return [
                {**r, "similarity": float(r.get("similarity") or r.get("score") or 0.0)}
                for r in rows
            ]
    except Exception as e:  # noqa: BLE001
        if not _looks_like_missing_rpc(e):
            print(f"[vector_search] drives RPC error, falling back: {e}")

    q = client.table(T_DRIVES).select(
        "id,role,company_id,location,ctc_offered,status,scheduled_date,jd_text,jd_embedding"
    ).eq("college_id", college_id)
    res = q.limit(500).execute()
    rows = getattr(res, "data", None) or []

    scored: List[Dict[str, Any]] = []
    for r in rows:
        emb = _parse_embedding(r.get("jd_embedding"))
        sim = _cosine(query_embedding, emb) if emb else 0.0
        out = {k: v for k, v in r.items() if k != "jd_embedding"}
        out["similarity"] = sim
        scored.append(out)
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:limit]
