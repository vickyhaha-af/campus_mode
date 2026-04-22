"""
Recruiter view — signed-token, public (token-gated) read-only view of a drive's
shortlist. PC admins generate a shareable link; recruiters open it without auth.

Token format: url-safe base64 of "{drive_id}:{email}:{expires_at_iso}:{hmac}"
HMAC is computed over "{drive_id}:{email}:{expires_at_iso}" with SUPABASE_JWT_SECRET.
"""
from __future__ import annotations

import os
import hmac
import hashlib
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..db import (
    T_RECRUITER_TOKENS, T_DRIVES, T_SHORTLISTS, T_COMPANIES, T_STUDENTS,
    insert, select_one, select_many, update,
)
from ..services.demo_store import (
    demo_drive_by_id, demo_student_by_id, DEMO_COMPANIES,
)
from ..services.campus_audit import safe_log


router = APIRouter(prefix="/api/campus/recruiter", tags=["campus:recruiter"])


SIGNING_SECRET = os.getenv("SUPABASE_JWT_SECRET", "") or "campus-recruiter-dev-fallback-secret"
TOKEN_TTL_DAYS = 30


# ---------- helpers ----------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _b64u_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64u_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + pad).encode("ascii"))


def _sign(payload: str) -> str:
    mac = hmac.new(SIGNING_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256)
    return mac.hexdigest()


def _mint_token(drive_id: str, email: str, expires_at_iso: str) -> str:
    payload = f"{drive_id}:{email}:{expires_at_iso}"
    sig = _sign(payload)
    raw = f"{payload}:{sig}".encode("utf-8")
    return _b64u_encode(raw)


def _verify_token(token: str) -> Dict[str, Any]:
    """Return {drive_id, email, expires_at} or raise HTTPException."""
    try:
        raw = _b64u_decode(token).decode("utf-8")
        parts = raw.split(":")
        if len(parts) != 4:
            raise ValueError("malformed token")
        drive_id, email, expires_at_iso, sig = parts
        expected = _sign(f"{drive_id}:{email}:{expires_at_iso}")
        if not hmac.compare_digest(expected, sig):
            raise ValueError("bad signature")
        # expiry check
        try:
            expires_at = datetime.fromisoformat(expires_at_iso)
        except ValueError:
            raise ValueError("bad expiry")
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="This link has expired.")
        return {"drive_id": drive_id, "email": email, "expires_at": expires_at_iso}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="This link is invalid.")


def _student_compact(s: Dict[str, Any]) -> Dict[str, Any]:
    """Return a minimal, read-only student summary (no PII like phone/DOB/hometown)."""
    return {
        "id": s.get("id"),
        "name": s.get("name"),
        "email": s.get("email"),
        "branch": s.get("branch"),
        "year": s.get("year"),
        "cgpa": s.get("cgpa"),
        "backlogs_active": s.get("backlogs_active"),
        "summary": (s.get("profile_enriched") or {}).get("summary"),
    }


def _company_for_drive(drive: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    company_id = drive.get("company_id")
    if not company_id:
        return None
    # demo companies first
    for c in DEMO_COMPANIES:
        if c["id"] == company_id:
            return c
    try:
        return select_one(T_COMPANIES, {"id": company_id})
    except Exception:
        return None


# ---------- routes ----------

class TokenCreate(BaseModel):
    drive_id: str
    recruiter_email: str


@router.post("/tokens")
async def create_recruiter_token(payload: TokenCreate):
    drive_id = payload.drive_id.strip()
    email = (payload.recruiter_email or "").strip().lower()
    if not drive_id or not email or "@" not in email:
        raise HTTPException(status_code=422, detail="drive_id and valid recruiter_email are required.")

    expires_at = datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS)
    expires_iso = expires_at.isoformat()
    token = _mint_token(drive_id, email, expires_iso)

    demo = demo_drive_by_id(drive_id)
    if demo:
        # Don't persist for demo; token is self-contained + signed.
        college_id = demo.get("college_id")
        if college_id:
            safe_log(
                college_id=college_id,
                action="recruiter_token_create",
                target_type="drive",
                target_id=drive_id,
                details={
                    "recruiter_email": email,
                    "expires_at": expires_iso,
                    "demo": True,
                },
            )
        return {
            "token": token,
            "expires_at": expires_iso,
            "drive_id": drive_id,
            "recruiter_email": email,
            "demo": True,
        }

    # Real drive — persist for auditability and to allow revocation.
    try:
        row = insert(T_RECRUITER_TOKENS, {
            "drive_id": drive_id,
            "recruiter_email": email,
            "signed_token": token,
            "expires_at": expires_iso,
        })
    except Exception as e:
        # If the drive doesn't exist in DB we surface 404-ish
        raise HTTPException(status_code=500, detail=f"Could not create token: {e}")

    # Look up college_id so the event lands in the right chain.
    drive_row = None
    try:
        drive_row = select_one(T_DRIVES, {"id": drive_id})
    except Exception:
        pass
    college_id = (drive_row or {}).get("college_id")
    if college_id:
        safe_log(
            college_id=college_id,
            action="recruiter_token_create",
            target_type="drive",
            target_id=drive_id,
            details={
                "recruiter_email": email,
                "expires_at": expires_iso,
                "token_row_id": row.get("id") if isinstance(row, dict) else None,
            },
        )

    return {
        "token": token,
        "expires_at": expires_iso,
        "drive_id": drive_id,
        "recruiter_email": email,
        "token_row_id": row.get("id") if isinstance(row, dict) else None,
    }


@router.get("/view")
async def recruiter_view(token: str = Query(...)):
    verified = _verify_token(token)
    drive_id = verified["drive_id"]

    # ---- Demo branch ----
    demo_drive = demo_drive_by_id(drive_id)
    if demo_drive:
        # Pull from the in-memory shortlist store in shortlists route.
        try:
            from .shortlists import _DEMO_SHORTLISTS  # type: ignore
            sl_rows = [r for r in _DEMO_SHORTLISTS.values() if r.get("drive_id") == drive_id]
        except Exception:
            sl_rows = []

        shortlists: List[Dict[str, Any]] = []
        for r in sorted(sl_rows, key=lambda x: x.get("rank") or 999):
            s = demo_student_by_id(r.get("student_id"))
            if not s:
                continue
            shortlists.append({
                "student_compact": _student_compact(s),
                "stage": r.get("stage"),
                "fit_score": r.get("fit_score"),
                "fit_rationale": r.get("fit_rationale"),
                "rank": r.get("rank"),
            })

        return {
            "drive": demo_drive,
            "company": _company_for_drive(demo_drive),
            "shortlists": shortlists,
            "recruiter_email": verified["email"],
            "expires_at": verified["expires_at"],
            "demo": True,
        }

    # ---- Real DB branch ----
    # Validate DB token row (belt-and-suspenders: HMAC alone is sufficient, but
    # matching a persisted row gives us revocation + last_used_at audit.)
    token_row = select_one(T_RECRUITER_TOKENS, {"signed_token": token})
    if not token_row:
        raise HTTPException(status_code=400, detail="This link is invalid.")

    drive = select_one(T_DRIVES, {"id": drive_id})
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found.")

    sl_rows = select_many(T_SHORTLISTS, filters={"drive_id": drive_id}, order_by="rank")
    shortlists = []
    for r in sl_rows or []:
        sid = r.get("student_id")
        s = select_one(T_STUDENTS, {"id": sid}) if sid else None
        if not s:
            continue
        shortlists.append({
            "student_compact": _student_compact(s),
            "stage": r.get("stage"),
            "fit_score": r.get("fit_score"),
            "fit_rationale": r.get("fit_rationale"),
            "rank": r.get("rank"),
        })

    # Bump last_used_at (best-effort)
    try:
        if token_row.get("id"):
            update(T_RECRUITER_TOKENS, token_row["id"], {"last_used_at": _now_iso()})
    except Exception:
        pass

    return {
        "drive": drive,
        "company": _company_for_drive(drive),
        "shortlists": shortlists,
        "recruiter_email": verified["email"],
        "expires_at": verified["expires_at"],
    }
