"""
Shared Gemini client factory.

Detects whether a provided API key is:
  - Gemini Developer API (starts with "AIza...") → free tier via generativelanguage.googleapis.com
  - Vertex AI Express   (starts with "AQ.")     → fresh quota via aiplatform.googleapis.com

and constructs the google-genai Client accordingly. All services use this so
key swaps just work without touching individual files.
"""
from __future__ import annotations

from google import genai  # type: ignore


def _is_vertex_key(key: str) -> bool:
    """Vertex AI Express API keys start with `AQ.` — Developer API keys start with `AIza`."""
    return (key or "").startswith("AQ.")


def make_client(api_key: str) -> genai.Client:
    """Return a properly-configured genai.Client regardless of key type."""
    if not api_key:
        raise RuntimeError("Gemini API key missing")
    if _is_vertex_key(api_key):
        # Vertex AI Express — the SDK routes through aiplatform.googleapis.com.
        return genai.Client(vertexai=True, api_key=api_key)
    return genai.Client(api_key=api_key)


def key_backend(api_key: str) -> str:
    """For debug/UI — returns 'vertex' or 'developer_api'."""
    return "vertex" if _is_vertex_key(api_key) else "developer_api"
