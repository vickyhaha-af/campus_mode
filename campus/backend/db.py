"""
Campus DB helpers — thin wrappers around the shared Supabase client.

All campus tables live in `public` with a `campus_` prefix to keep RLS
setup simple and avoid schema-qualifier gymnastics in supabase-py.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import HTTPException

# Imported from parent backend (already on sys.path via main.py entry).
from db.supabase_client import get_supabase  # type: ignore


# ---------- table name constants ----------
T_COLLEGES = "campus_colleges"
T_STUDENTS = "campus_students"
T_COMPANIES = "campus_companies"
T_DRIVES = "campus_drives"
T_SHORTLISTS = "campus_shortlists"
T_INGEST = "campus_ingest_jobs"
T_CHAT = "campus_chat_sessions"
T_COMMS = "campus_communications"
T_RECRUITER_TOKENS = "campus_recruiter_tokens"
T_AUDIT = "campus_audit_log"


class CampusDBUnavailable(HTTPException):
    """Supabase not configured — surfaces as 503 to API clients."""
    def __init__(self, detail: str = "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY."):
        super().__init__(status_code=503, detail=detail)


class CampusSchemaMissing(HTTPException):
    """Supabase connected but tables absent — schema needs to be applied."""
    def __init__(self, detail: str = "Campus tables not found. Run campus/schema.sql in Supabase SQL Editor."):
        super().__init__(status_code=503, detail=detail)


def _client():
    c = get_supabase()
    if c is None:
        raise CampusDBUnavailable()
    return c


def _wrap_postgrest_errors(fn):
    """Wrap any PGRST205 (schema missing) errors as a friendlier 503."""
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as e:
            msg = str(e)
            if "PGRST205" in msg or "schema cache" in msg:
                raise CampusSchemaMissing()
            raise
    return wrapper


# ---------- generic helpers ----------

@_wrap_postgrest_errors
def insert(table: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    res = _client().table(table).insert(payload).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise RuntimeError(f"Insert into {table} returned no row")
    return rows[0]


@_wrap_postgrest_errors
def select_one(table: str, filters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    q = _client().table(table).select("*")
    for k, v in filters.items():
        q = q.eq(k, v)
    res = q.limit(1).execute()
    rows = getattr(res, "data", None) or []
    return rows[0] if rows else None


@_wrap_postgrest_errors
def select_many(
    table: str,
    filters: Optional[Dict[str, Any]] = None,
    order_by: Optional[str] = None,
    desc: bool = False,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    q = _client().table(table).select("*")
    for k, v in (filters or {}).items():
        q = q.eq(k, v)
    if order_by:
        q = q.order(order_by, desc=desc)
    q = q.limit(limit)
    res = q.execute()
    return getattr(res, "data", None) or []


@_wrap_postgrest_errors
def update(table: str, row_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    # Pydantic-serialized payloads can include None; drop them so Postgres
    # keeps existing values rather than nulling out untouched fields.
    clean = {k: v for k, v in payload.items() if v is not None}
    if not clean:
        existing = select_one(table, {"id": row_id})
        if not existing:
            raise RuntimeError(f"{table} row {row_id} not found")
        return existing
    res = _client().table(table).update(clean).eq("id", row_id).execute()
    rows = getattr(res, "data", None) or []
    if not rows:
        raise RuntimeError(f"Update on {table} id={row_id} returned no row")
    return rows[0]


@_wrap_postgrest_errors
def delete(table: str, row_id: str) -> None:
    _client().table(table).delete().eq("id", row_id).execute()


def raw_client():
    """Escape hatch for callers that need advanced Supabase-py features (rpc, in_, etc.)."""
    return _client()
