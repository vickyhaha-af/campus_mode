"""
File-based session store — persists sessions across restarts.
Sessions written as JSON to /tmp/techvista_sessions/
TTL: 24 hours (auto-purged on read).
"""
import os
import json
import time
import uuid
from pathlib import Path
from models.schemas import SessionData

STORE_DIR = Path("/tmp/techvista_sessions")
TTL_SECONDS = 86400  # 24 hours


def _ensure_dir():
    STORE_DIR.mkdir(parents=True, exist_ok=True)


def _path(session_id: str) -> Path:
    return STORE_DIR / f"{session_id}.json"


def save_session(session: SessionData) -> None:
    _ensure_dir()
    payload = {
        "saved_at": time.time(),
        "data": session.model_dump()
    }
    with open(_path(session.session_id), "w") as f:
        json.dump(payload, f)


def load_session(session_id: str) -> SessionData | None:
    p = _path(session_id)
    if not p.exists():
        return None
    try:
        with open(p) as f:
            payload = json.load(f)
        # TTL check
        if time.time() - payload["saved_at"] > TTL_SECONDS:
            p.unlink(missing_ok=True)
            return None
        return SessionData(**payload["data"])
    except Exception:
        return None


def delete_session(session_id: str) -> None:
    _path(session_id).unlink(missing_ok=True)


def purge_expired() -> int:
    _ensure_dir()
    removed = 0
    for f in STORE_DIR.glob("*.json"):
        try:
            with open(f) as fp:
                payload = json.load(fp)
            if time.time() - payload.get("saved_at", 0) > TTL_SECONDS:
                f.unlink(missing_ok=True)
                removed += 1
        except Exception:
            f.unlink(missing_ok=True)
            removed += 1
    return removed
