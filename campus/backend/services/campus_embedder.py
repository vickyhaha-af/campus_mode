"""
Thin campus embedder — embeds the three rich text surfaces produced by
enricher_llm (skills_text, projects_text, summary_text) directly, rather than
reshaping them to fit parent's ParsedResume contract.

Resilience layers (same pattern as enricher_llm):
  1. Circuit breaker: 3 consecutive Gemini failures → marked unavailable for 60s.
  2. Fast-fail on 429 / quota errors — no pointless retries.
  3. 5-second total wall-clock budget across all retries.
  4. Meaningful BOW-hashing pseudo-embedding when Gemini is unavailable.

The pseudo-embedding is a bag-of-tokens hashing vector: we tokenize, stopword-
filter, hash each token into one of 768 buckets with occurrence weighting, and
L2-normalize. Two documents sharing real vocabulary get non-trivial cosine
similarity — vastly better than the previous character-hash fallback.
"""
from __future__ import annotations

import math
import re
import threading
import time
from typing import Dict, List, Optional

from google.genai import types  # type: ignore
from services.gemini_client import make_client  # type: ignore
from config import (  # type: ignore
    GEMINI_API_KEY_2, GEMINI_EMBEDDING_MODEL,
    API_CALL_DELAY_SECONDS, MAX_RETRIES,
)


EMBED_DIM = 768
EMBED_TOTAL_BUDGET_SEC = 5.0


# ---------------------------------------------------------------------------
# Circuit breaker (embedder-local, independent of enricher_llm's breaker).
# ---------------------------------------------------------------------------

_CB_LOCK = threading.Lock()
_CB_CONSECUTIVE_FAILURES = 0
_CB_OPEN_UNTIL: float = 0.0
_CB_FAIL_THRESHOLD = 3
_CB_COOLDOWN_SEC = 60.0


def _circuit_open() -> bool:
    with _CB_LOCK:
        return time.monotonic() < _CB_OPEN_UNTIL


def _record_success() -> None:
    global _CB_CONSECUTIVE_FAILURES, _CB_OPEN_UNTIL
    with _CB_LOCK:
        _CB_CONSECUTIVE_FAILURES = 0
        _CB_OPEN_UNTIL = 0.0


def _record_failure() -> None:
    global _CB_CONSECUTIVE_FAILURES, _CB_OPEN_UNTIL
    with _CB_LOCK:
        _CB_CONSECUTIVE_FAILURES += 1
        if _CB_CONSECUTIVE_FAILURES >= _CB_FAIL_THRESHOLD:
            _CB_OPEN_UNTIL = time.monotonic() + _CB_COOLDOWN_SEC
            print(
                f"[campus_embedder] circuit breaker OPEN for {_CB_COOLDOWN_SEC:.0f}s "
                f"(after {_CB_CONSECUTIVE_FAILURES} consecutive failures)"
            )


def _is_quota_error(err: BaseException) -> bool:
    msg = str(err).lower()
    return (
        "429" in msg
        or "quota" in msg
        or "rate limit" in msg
        or "resource_exhausted" in msg
        or "resourceexhausted" in msg
        or "billing" in msg
    )


# ---------------------------------------------------------------------------
# Bag-of-tokens hashing pseudo-embedding
# ---------------------------------------------------------------------------

_STOPWORDS_30 = {
    "the", "and", "for", "with", "from", "this", "that", "have", "has",
    "was", "were", "are", "will", "would", "could", "should", "into",
    "about", "over", "under", "more", "some", "all", "any", "such",
    "than", "then", "also", "but", "not",
}

_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9+.#-]{1,30}")


def _tokenize(text: str) -> List[str]:
    tokens: List[str] = []
    for raw in _TOKEN_RE.findall(text.lower()):
        if len(raw) < 3:
            continue
        if raw in _STOPWORDS_30:
            continue
        tokens.append(raw)
    return tokens


def _pseudo(text: str) -> List[float]:
    """Bag-of-tokens hashing pseudo-embedding.

    Approximates TF weighting with a sublinear dampening (1 + log(count)) so
    a token repeated 10 times doesn't dominate. Result is L2-normalized so
    cosine similarity is meaningful.
    """
    vec = [0.0] * EMBED_DIM
    if not text:
        # Stable zero-ish vector so downstream cosine doesn't NaN. Put weight
        # on a single bucket so it's non-zero.
        vec[0] = 1.0
        return vec

    counts: Dict[str, int] = {}
    for tok in _tokenize(text):
        counts[tok] = counts.get(tok, 0) + 1

    if not counts:
        vec[0] = 1.0
        return vec

    for tok, c in counts.items():
        # hash() is salted per-process by default in Python. For stable
        # embeddings across process restarts we'd want a deterministic hash —
        # but for within-ingest-run similarity it's fine, and we don't persist
        # these vectors beyond the run in the fallback path.
        bucket = (hash(tok) & 0x7FFFFFFF) % EMBED_DIM
        weight = 1.0 + math.log(c)
        vec[bucket] += weight

    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


# ---------------------------------------------------------------------------
# Real Gemini embedding path (with retries + circuit breaker)
# ---------------------------------------------------------------------------

def _client():
    return make_client(GEMINI_API_KEY_2)


def _embed_one(text: str) -> Optional[List[float]]:
    if not text:
        return None
    if not GEMINI_API_KEY_2 or _circuit_open():
        return _pseudo(text)

    start = time.monotonic()
    try:
        client = _client()
    except Exception:  # noqa: BLE001
        _record_failure()
        return _pseudo(text)

    for attempt in range(MAX_RETRIES):
        elapsed = time.monotonic() - start
        if elapsed >= EMBED_TOTAL_BUDGET_SEC:
            break
        try:
            res = client.models.embed_content(
                model=GEMINI_EMBEDDING_MODEL,
                contents=text,
                config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY"),
            )
            _record_success()
            return list(res.embeddings[0].values)
        except Exception as e:  # noqa: BLE001
            if _is_quota_error(e):
                _record_failure()
                return _pseudo(text)
            _record_failure()
            if attempt < MAX_RETRIES - 1:
                backoff = API_CALL_DELAY_SECONDS * (2 ** attempt)
                remaining = EMBED_TOTAL_BUDGET_SEC - (time.monotonic() - start)
                if backoff >= remaining:
                    break
                time.sleep(backoff)
    return _pseudo(text)


def embed_profile_texts(
    skills_text: str,
    projects_text: str,
    summary_text: str,
) -> Dict[str, Optional[List[float]]]:
    """
    Return embeddings for the three rich surfaces.

    Keys match the student table's vector columns:
      embedding_skills / embedding_projects / embedding_summary
    """
    return {
        "skills": _embed_one(skills_text),
        "projects": _embed_one(projects_text),
        "summary": _embed_one(summary_text),
    }
