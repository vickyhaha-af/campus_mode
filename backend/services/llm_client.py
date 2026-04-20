"""
Unified LLM client — routes to whichever provider has a valid key.

Priority order:
  1. Groq (free tier, Llama 3.3 70B)  — primary
  2. Gemini (Developer API or Vertex) — secondary
  3. Regex fallback                    — handled by callers if both fail

Env vars read:
  GROQ_API_KEY           starts with "gsk_..."
  GROQ_MODEL             optional, defaults to "llama-3.3-70b-versatile"
  GEMINI_API_KEY_1       fallback, starts with "AIza..." (Developer API) or "AQ..." (Vertex)
  GEMINI_FLASH_MODEL     optional, defaults to "gemini-2.0-flash"

Groq uses OpenAI-compatible API, so tool-calling works with the same schema
format as OpenAI — we expose a single `chat_with_tools` helper that both
the chat orchestrator and future features can use.
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Callable, Dict, Iterable, List, Optional


# ---------- provider config (lazy — read env at call time so .env load order doesn't bite) ----------

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def _groq_key() -> str:
    return (os.getenv("GROQ_API_KEY") or "").strip()


def groq_available() -> bool:
    k = _groq_key()
    return bool(k and k.startswith("gsk_"))


@property
def _dummy(): pass  # noqa


def _groq_model() -> str:
    return (os.getenv("GROQ_MODEL") or "llama-3.3-70b-versatile").strip()


# Backward-compat module attribute (evaluated at import time but callers can
# also use _groq_model() or _groq_key() for always-fresh values).
GROQ_API_KEY = _groq_key()
GROQ_MODEL = _groq_model()


def gemini_available() -> bool:
    return bool(os.getenv("GEMINI_API_KEY_1"))


def primary_backend() -> str:
    """Which LLM backend will be used by default."""
    if groq_available():
        return "groq"
    if gemini_available():
        return "gemini"
    return "none"


# ---------- OpenAI-compatible Groq client (lazy) ----------

_openai_client = None


def _get_groq_client():
    """Lazily construct an OpenAI client pointed at Groq."""
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI  # type: ignore
        _openai_client = OpenAI(api_key=_groq_key(), base_url=GROQ_BASE_URL)
    return _openai_client


# ---------- JSON extraction helper ----------

def _strip_fences(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _parse_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(_strip_fences(text))
    except json.JSONDecodeError:
        # Pull the first {...} block
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            return json.loads(m.group())
        raise


# ---------- Core APIs ----------

def generate_json(prompt: str, system: Optional[str] = None, max_tokens: int = 4096) -> Dict[str, Any]:
    """Send prompt → parse JSON response.

    Prefers Groq with response_format={"type": "json_object"}. Falls back to
    Gemini if Groq unavailable. Caller handles all-fail with regex.
    """
    if groq_available():
        messages: List[Dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        client = _get_groq_client()
        response = client.chat.completions.create(
            model=_groq_model(),
            messages=messages,
            temperature=0.2,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or ""
        return _parse_json(content)

    # Gemini fallback
    if gemini_available():
        return _gemini_generate_json(prompt, system)

    raise RuntimeError("No LLM backend configured (set GROQ_API_KEY or GEMINI_API_KEY_1)")


def _gemini_generate_json(prompt: str, system: Optional[str]) -> Dict[str, Any]:
    from services.gemini_client import make_client  # type: ignore
    from config import GEMINI_API_KEY_1, GEMINI_FLASH_MODEL  # type: ignore
    client = make_client(GEMINI_API_KEY_1)
    combined = (system + "\n\n" + prompt) if system else prompt
    response = client.models.generate_content(
        model=GEMINI_FLASH_MODEL,
        contents=combined,
    )
    return _parse_json(response.text or "")


# ---------- Tool-calling chat (for the agent) ----------

def chat_with_tools(
    messages: List[Dict[str, Any]],
    tools: List[Dict[str, Any]],
    system: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = 2048,
) -> Dict[str, Any]:
    """
    OpenAI-format tool-calling chat.

    Args:
        messages: [{"role": "user"|"assistant"|"tool", "content": str, ...}]
                  Tool results should be {"role": "tool", "tool_call_id": str, "content": str}
        tools: OpenAI function-calling schema
               [{"type": "function", "function": {"name": str, "description": str,
                                                  "parameters": <json_schema>}}]
        system: optional system prompt (prepended as first message)

    Returns dict:
        {
            "text": str | None,
            "tool_calls": [{"id": str, "name": str, "args": dict}],
            "finish_reason": str,
        }
    """
    if not groq_available():
        # We don't implement Gemini tool-calling through this path because
        # the chat orchestrator already has its own Gemini tool-call loop
        # as a legacy path. Callers should check primary_backend() first.
        raise RuntimeError("Groq not configured — tool-call chat requires GROQ_API_KEY")

    msgs: List[Dict[str, Any]] = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.extend(messages)

    client = _get_groq_client()
    response = client.chat.completions.create(
        model=model or _groq_model(),
        messages=msgs,
        tools=tools,
        tool_choice="auto",
        temperature=0.3,
        max_tokens=max_tokens,
    )
    msg = response.choices[0].message
    tool_calls = []
    if getattr(msg, "tool_calls", None):
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except (json.JSONDecodeError, AttributeError):
                args = {}
            tool_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "args": args,
            })

    return {
        "text": msg.content,
        "tool_calls": tool_calls,
        "finish_reason": response.choices[0].finish_reason,
    }


# ---------- Health probe (useful for an /api/llm/status endpoint later) ----------

def probe() -> Dict[str, Any]:
    """Quickly confirm the primary backend is reachable. Returns dict with status."""
    backend = primary_backend()
    out: Dict[str, Any] = {"backend": backend, "ok": False, "error": None}
    if backend == "none":
        out["error"] = "no_api_key"
        return out
    try:
        res = generate_json(
            'Reply with this exact JSON: {"ok": true}',
            system="You return valid JSON only.",
            max_tokens=40,
        )
        out["ok"] = bool(res.get("ok"))
    except Exception as e:
        out["error"] = str(e)[:200]
    return out
