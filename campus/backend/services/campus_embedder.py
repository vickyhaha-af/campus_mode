"""
Thin campus embedder — embeds the three rich text surfaces produced by
enricher_llm (skills_text, projects_text, summary_text) directly, rather than
reshaping them to fit parent's ParsedResume contract.

Falls back to a deterministic pseudo-vector (same shape as parent's embedder
fallback) if the Gemini API is unreachable, so ingest never crashes.
"""
from __future__ import annotations

import time
from typing import Dict, List, Optional

from google import genai  # type: ignore
from google.genai import types  # type: ignore
from services.gemini_client import make_client  # type: ignore
from config import (  # type: ignore
    GEMINI_API_KEY_2, GEMINI_EMBEDDING_MODEL,
    API_CALL_DELAY_SECONDS, MAX_RETRIES,
)


def _client():
    return make_client(GEMINI_API_KEY_2)


def _pseudo(text: str) -> List[float]:
    """Deterministic fallback embedding so downstream schema stays satisfied."""
    import numpy as np
    vec = np.zeros(768, dtype=float)
    for i, ch in enumerate(text.lower()[:1024]):
        vec[(ord(ch) + i) % 768] += 1.0
    norm = float(np.linalg.norm(vec)) or 1.0
    return (vec / norm).tolist()


def _embed_one(text: str) -> Optional[List[float]]:
    if not text:
        return None
    if not GEMINI_API_KEY_2:
        return _pseudo(text)
    client = _client()
    for attempt in range(MAX_RETRIES):
        try:
            res = client.models.embed_content(
                model=GEMINI_EMBEDDING_MODEL,
                contents=text,
                config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY"),
            )
            return list(res.embeddings[0].values)
        except Exception:
            if attempt < MAX_RETRIES - 1:
                time.sleep(API_CALL_DELAY_SECONDS * (2 ** attempt))
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
    out = {
        "skills": _embed_one(skills_text),
        "projects": _embed_one(projects_text),
        "summary": _embed_one(summary_text),
    }
    return out
