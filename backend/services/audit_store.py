"""
Supabase audit log store for Tech Vista.

Per spec, this stores ONLY aggregate / statistical metadata for each screening
session. Raw resume text and candidate-level PII beyond session linkage are
never written to the database.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from models.schemas import SessionData
from config import BIAS_P_VALUE_THRESHOLD

import os

try:
    from supabase import create_client  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    create_client = None  # type: ignore


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")


def _get_client():
    """
    Lazily construct a Supabase client if credentials and dependency are present.

    If Supabase is not configured, this returns None so that callers can
    gracefully skip persistence without failing the screening flow.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None
    if create_client is None:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    except Exception:
        return None


def _score_summary(scores) -> Dict[str, float]:
    """Compute simple score distribution summary for audit record."""
    import numpy as np

    if not scores:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}

    vals = [float(s.composite_score) for s in scores]
    arr = np.array(vals, dtype=float)

    return {
        "mean": round(float(arr.mean()), 2),
        "std": round(float(arr.std(ddof=1) if arr.size > 1 else 0.0), 2),
        "min": round(float(arr.min()), 2),
        "max": round(float(arr.max()), 2),
    }


def write_audit_log(session: SessionData) -> None:
    """
    Persist a single audit log row to Supabase.

    Shape follows the spec, with no raw resume text or candidate PII:
      - jd_summary is the first 200 chars of the JD text
      - categories_tested & test_results are drawn from BiasAuditResult
      - score_dist_summary stores only aggregate stats
    """
    client = _get_client()
    if client is None:
        # Supabase not configured — treat as best-effort and exit silently.
        return

    bias = session.bias_audit
    jd = session.jd

    jd_text_source = jd.raw_text if jd and jd.raw_text else (jd.skills_text if jd else "")
    jd_summary = (jd_text_source or "")[:200]

    categories_tested = list(bias.details.keys()) if bias and bias.details else []

    test_results: Dict[str, Any] = {}
    if bias and bias.details:
        for cat, detail in bias.details.items():
            test_results[cat] = {
                "test": detail.get("test_used"),
                "p_value": detail.get("p_value"),
                "flagged": bool(detail.get("bias_detected")),
            }

    payload: Dict[str, Any] = {
        "audit_id": str(session.session_id),
        "session_id": str(session.session_id),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "jd_summary": jd_summary,
        "resume_count": len(session.scores),
        "categories_tested": categories_tested,
        "test_results": test_results,
        "normalisation_applied": bool(bias.normalization_applied) if bias else False,
        "score_dist_summary": _score_summary(session.scores),
        "bias_p_value_threshold": BIAS_P_VALUE_THRESHOLD,
    }

    try:
        client.table("techvista_audit_logs").insert(payload).execute()  # type: ignore[union-attr]
    except Exception:
        # Audit persistence should never break the main flow.
        return

