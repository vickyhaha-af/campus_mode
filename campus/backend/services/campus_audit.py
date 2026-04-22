"""
Campus audit writer — SHA-256 hash-chained, tamper-evident log.

Each entry's hash is computed as:
    entry_hash = sha256(prev_hash + action + target_id + timestamp + json(details))

This makes the log append-only in spirit: mutating any past entry invalidates
all subsequent hashes, which `verify_chain` detects.

Two storage modes:
  - Supabase (real):  writes to campus_audit_log table.
  - Demo / fallback:  in-memory list, keyed by college_id. Resets on restart.

The writer is thread-safe: a single module-level RLock serialises the
"fetch last prev_hash + compute + insert" critical section so two concurrent
writers cannot both read the same prev_hash and produce a fork.

Consumers MUST call `log_action(...)` inside a try/except so a logging failure
never breaks the actual action that triggered the log. Helper `safe_log`
does this for you.
"""
from __future__ import annotations

import hashlib
import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..db import T_AUDIT, raw_client
from .demo_store import is_demo


# ---------------------------------------------------------------------------
# Demo / in-memory store
# ---------------------------------------------------------------------------

# Keyed by college_id → ordered list of audit rows. Also used whenever
# Supabase is unavailable (so the page remains populated during the session).
_DEMO_LOG: Dict[str, List[Dict[str, Any]]] = {}

# Serialises the prev-hash fetch + write critical section.
_CHAIN_LOCK = threading.RLock()


# ---------------------------------------------------------------------------
# Hash helpers
# ---------------------------------------------------------------------------

def _canonical_details(details: Optional[Dict[str, Any]]) -> str:
    """
    Stable JSON serialisation for hashing. Sort keys so equivalent dicts
    produce identical hashes regardless of insertion order.
    """
    try:
        return json.dumps(details or {}, sort_keys=True, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        # Fall back to repr if there's something exotic in details; still deterministic.
        return repr(details)


def _compute_hash(prev_hash: str, action: str, target_id: str,
                  timestamp: str, details: Optional[Dict[str, Any]]) -> str:
    h = hashlib.sha256()
    h.update((prev_hash or "").encode("utf-8"))
    h.update((action or "").encode("utf-8"))
    h.update((target_id or "").encode("utf-8"))
    h.update((timestamp or "").encode("utf-8"))
    h.update(_canonical_details(details).encode("utf-8"))
    return h.hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Storage — prev hash fetch + insert
# ---------------------------------------------------------------------------

def _fetch_last_hash_demo(college_id: str) -> str:
    rows = _DEMO_LOG.get(college_id) or []
    return rows[-1]["entry_hash"] if rows else ""


def _fetch_last_hash_db(college_id: str) -> str:
    """
    Fetch the most recent entry_hash for this college from Supabase.
    Returns "" for an empty chain. Raises on real DB failures so the caller
    can fall through to demo mode.
    """
    client = raw_client()
    res = (
        client.table(T_AUDIT)
        .select("entry_hash, timestamp")
        .eq("college_id", college_id)
        .order("timestamp", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    return (rows[0].get("entry_hash") if rows else "") or ""


def _insert_demo(row: Dict[str, Any]) -> Dict[str, Any]:
    _DEMO_LOG.setdefault(row["college_id"], []).append(row)
    return row


def _insert_db(row: Dict[str, Any]) -> Dict[str, Any]:
    client = raw_client()
    res = client.table(T_AUDIT).insert(row).execute()
    data = getattr(res, "data", None) or []
    if not data:
        raise RuntimeError("audit insert returned no row")
    return data[0]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def log_action(
    college_id: str,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Write one audit row with SHA-256 hash chaining.

    - Demo college (is_demo) always uses in-memory store.
    - Real college tries Supabase; on failure, falls back to in-memory store
      so the demo UI still shows the entry.
    """
    if not college_id:
        raise ValueError("college_id is required for audit logging")

    timestamp = _now_iso()
    target_id_str = str(target_id) if target_id is not None else ""

    # Serialise the critical section: fetch prev_hash → compute → insert.
    with _CHAIN_LOCK:
        use_demo = is_demo(college_id)
        prev_hash = ""
        if use_demo:
            prev_hash = _fetch_last_hash_demo(college_id)
        else:
            try:
                prev_hash = _fetch_last_hash_db(college_id)
            except Exception:
                # Supabase unavailable — degrade to in-memory but stay consistent
                # per-college by sharing the demo store.
                use_demo = True
                prev_hash = _fetch_last_hash_demo(college_id)

        entry_hash = _compute_hash(prev_hash, action, target_id_str, timestamp, details)

        row = {
            "id": str(uuid.uuid4()),
            "timestamp": timestamp,
            "college_id": college_id,
            "user_id": user_id,
            "action": action,
            "target_type": target_type,
            "target_id": target_id if target_id else None,
            "details": details or {},
            "entry_hash": entry_hash,
            "prev_hash": prev_hash,
        }

        if use_demo:
            return _insert_demo(row)

        try:
            return _insert_db(row)
        except Exception:
            # Last-resort fallback so a DB hiccup never loses the trail.
            return _insert_demo(row)


def safe_log(*args, **kwargs) -> None:
    """
    Fire-and-forget wrapper: logs exceptions to stderr but never raises.
    Use this from route handlers so an audit failure cannot break the action.
    """
    try:
        log_action(*args, **kwargs)
    except Exception as e:  # noqa: BLE001
        try:
            import sys
            print(f"[audit] log_action failed: {e}", file=sys.stderr)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Verification + listing
# ---------------------------------------------------------------------------

def _all_rows(college_id: str) -> List[Dict[str, Any]]:
    """
    Return every audit row for the college, oldest first, merging demo +
    DB sources. DB is queried best-effort; failure falls through to demo only.
    """
    out: List[Dict[str, Any]] = []
    if not is_demo(college_id):
        try:
            client = raw_client()
            res = (
                client.table(T_AUDIT)
                .select("*")
                .eq("college_id", college_id)
                .order("timestamp", desc=False)
                .limit(10000)
                .execute()
            )
            out = list(getattr(res, "data", None) or [])
        except Exception:
            out = []
    # Demo / in-memory trail (also used as fallback when DB is down).
    demo_rows = _DEMO_LOG.get(college_id) or []
    if demo_rows and not out:
        out = list(demo_rows)
    elif demo_rows:
        # Merge — dedupe by id, then sort by timestamp.
        seen = {r.get("id") for r in out}
        for r in demo_rows:
            if r.get("id") not in seen:
                out.append(r)
        out.sort(key=lambda r: r.get("timestamp") or "")
    return out


def verify_chain(college_id: str) -> Dict[str, Any]:
    """
    Walk all rows for a college, recompute hashes, return:
        {valid: bool, broken_at: Optional[int], total_entries: int}

    `broken_at` is the 1-indexed position of the first row whose recomputed
    hash disagrees with its stored entry_hash (or whose prev_hash doesn't
    match the previous row's entry_hash).
    """
    rows = _all_rows(college_id)
    prev_hash = ""
    for i, r in enumerate(rows, start=1):
        target_id_str = str(r.get("target_id") or "")
        expected = _compute_hash(
            prev_hash,
            r.get("action") or "",
            target_id_str,
            r.get("timestamp") or "",
            r.get("details") or {},
        )
        stored = r.get("entry_hash") or ""
        stored_prev = r.get("prev_hash") or ""
        if stored != expected or stored_prev != prev_hash:
            return {"valid": False, "broken_at": i, "total_entries": len(rows)}
        prev_hash = stored
    return {"valid": True, "broken_at": None, "total_entries": len(rows)}


def list_entries(
    college_id: str,
    action_type: Optional[str] = None,
    from_ts: Optional[str] = None,
    to_ts: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Dict[str, Any]:
    """
    Paginated, filterable list of audit entries for a college. Newest first.
    Returns {entries, total, limit, offset}.
    """
    rows = _all_rows(college_id)
    rows.sort(key=lambda r: r.get("timestamp") or "", reverse=True)

    def keep(r: Dict[str, Any]) -> bool:
        if action_type and r.get("action") != action_type:
            return False
        ts = r.get("timestamp") or ""
        if from_ts and ts < from_ts:
            return False
        if to_ts and ts > to_ts:
            return False
        return True

    filtered = [r for r in rows if keep(r)]
    total = len(filtered)
    page = filtered[offset : offset + limit]
    return {"entries": page, "total": total, "limit": limit, "offset": offset}


def action_types(college_id: str) -> List[str]:
    """Distinct action strings seen for the college (for filter dropdown)."""
    rows = _all_rows(college_id)
    return sorted({r.get("action") for r in rows if r.get("action")})


# ---------------------------------------------------------------------------
# Test hook — only for internal use / tests
# ---------------------------------------------------------------------------

def _reset_demo_log_for_tests() -> None:
    _DEMO_LOG.clear()
