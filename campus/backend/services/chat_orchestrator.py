"""
Chat agent orchestrator — Gemini Flash 2.0 with function calls.

Agent loop:
    1. Take user message + prior history + optional pinned drive context
    2. Call Gemini with tool declarations
    3. If response contains function_call(s): execute them, append results,
       loop again until model returns plain text (final answer)
    4. Yield SSE-friendly events at each step

Session memory persists to campus_chat_sessions when Supabase is configured;
otherwise lives in-process (single-session demo mode is fine).
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any, AsyncIterator, Dict, List, Optional

from google import genai  # type: ignore
from google.genai import types  # type: ignore

from services.gemini_client import make_client  # type: ignore
from config import GEMINI_API_KEY_1, GEMINI_FLASH_MODEL  # type: ignore

from ..db import T_CHAT, select_one, insert, update
from .demo_store import is_demo
from .tools import TOOL_REGISTRY, fetch_drive
from .chat_fallback import run_fallback_stream


# ---------------------------------------------------------------------------
# Tool declarations — Gemini needs a schema for each tool it can call.
# ---------------------------------------------------------------------------

def _tool_declarations() -> List[types.Tool]:
    return [types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="search_students",
            description=(
                "Filter the student pool by structured attributes (branch, year, cgpa, "
                "backlogs, gender, current_city, placement status). Returns compact "
                "student summaries. Use this FIRST for any filtered query."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "branch": types.Schema(type="STRING", description="Branch abbreviation e.g. CSE, ECE"),
                    "year": types.Schema(type="INTEGER", description="Graduation year"),
                    "placed_status": types.Schema(type="STRING", description="unplaced | in_process | placed"),
                    "min_cgpa": types.Schema(type="NUMBER"),
                    "max_active_backlogs": types.Schema(type="INTEGER"),
                    "gender": types.Schema(type="STRING", description="Use only if drive eligibility requires it; triggers compliance warning otherwise"),
                    "current_city": types.Schema(type="STRING"),
                    "limit": types.Schema(type="INTEGER"),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="semantic_rank",
            description=(
                "Rank students by semantic fit against a free-text query or JD. "
                "Optionally scope to a subset of student_ids (e.g. output of search_students). "
                "Returns ranked list with fit_score (0-100)."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "query_text": types.Schema(type="STRING", description="JD text or description to match against"),
                    "student_ids": types.Schema(type="ARRAY", items=types.Schema(type="STRING")),
                    "limit": types.Schema(type="INTEGER"),
                },
                required=["query_text"],
            ),
        ),
        types.FunctionDeclaration(
            name="fetch_drive",
            description="Load a drive's JD, location, eligibility rules, and metadata.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"drive_id": types.Schema(type="STRING")},
                required=["drive_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="check_eligibility",
            description="Check if a student meets a drive's eligibility rules. Returns violations if any.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "student_id": types.Schema(type="STRING"),
                    "drive_id": types.Schema(type="STRING"),
                },
                required=["student_id", "drive_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_student_profile",
            description="Fetch a student's full profile including rich enrichment (passions, personality, role_fit).",
            parameters=types.Schema(
                type="OBJECT",
                properties={"student_id": types.Schema(type="STRING")},
                required=["student_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="explain_fit",
            description=(
                "Get factual signals (skill overlap, top role fits, passion alignment, personality) "
                "for a student-drive pair. Use this as source material to write a human-readable rationale."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "student_id": types.Schema(type="STRING"),
                    "drive_id": types.Schema(type="STRING"),
                },
                required=["student_id", "drive_id"],
            ),
        ),
    ])]


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are TechVista Campus's matching assistant. You help placement committee (PC) admins pair students with visiting companies.

How you work:
- You have tools: search_students, semantic_rank, fetch_drive, check_eligibility, get_student_profile, explain_fit.
- For most queries you'll chain them: fetch_drive (if context) → search_students (filter) → semantic_rank (rank) → explain_fit (rationale for top few).
- Always show your reasoning at the end and justify WHY your top picks fit — cite skills, passions, personality signals, achievements.
- Keep responses focused. A ranked shortlist of 5–15 with one-line rationale per candidate is the typical ideal.
- When a drive context is pinned (provided in system context), use it automatically. No need for the user to paste JD text.

Compliance rules (IMPORTANT):
- If the user asks you to filter by gender, age, or other protected attributes WITHOUT a pinned drive that has that eligibility rule explicitly set, apply the filter but surface a compliance warning to the user and note it is being logged for review. Indian employment equity norms apply.
- If a drive has gender_restriction set in its eligibility_rules, it carries a justification — apply it cleanly and do not warn.

Tone: concise, professional, direct. Use bullet points for lists. Never apologise for using tools — they are your job."""


# ---------------------------------------------------------------------------
# Event helpers
# ---------------------------------------------------------------------------

def _event(type_: str, **kwargs) -> Dict[str, Any]:
    return {"type": type_, "ts": time.time(), **kwargs}


# ---------------------------------------------------------------------------
# Session persistence (Supabase-backed; safe-no-op if not configured)
# ---------------------------------------------------------------------------

def _load_messages(session_id: str) -> List[Dict[str, Any]]:
    try:
        row = select_one(T_CHAT, {"id": session_id})
        return (row or {}).get("messages") or []
    except Exception:
        return []


def _save_messages(session_id: str, messages: List[Dict[str, Any]],
                   context_drive_id: Optional[str] = None) -> None:
    try:
        update(T_CHAT, session_id, {
            "messages": messages,
            "context_drive_id": context_drive_id,
            "last_active": _now_iso(),
        })
    except Exception:
        pass  # demo / no-supabase mode — session dies with the process


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Session memory (in-process fallback for demo mode)
# ---------------------------------------------------------------------------

_INPROC_SESSIONS: Dict[str, Dict[str, Any]] = {}


def create_session(
    user_id: Optional[str],
    college_id: str,
    context_drive_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new chat session. Persist to DB if available; fall back to in-process."""
    session_payload = {
        "user_id": user_id,
        "college_id": college_id,
        "role_scope": "pc",
        "context_drive_id": context_drive_id,
        "messages": [],
    }
    try:
        return insert(T_CHAT, session_payload)
    except Exception:
        sid = str(uuid.uuid4())
        row = {"id": sid, **session_payload, "last_active": _now_iso()}
        _INPROC_SESSIONS[sid] = row
        return row


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    try:
        row = select_one(T_CHAT, {"id": session_id})
        if row:
            return row
    except Exception:
        pass
    return _INPROC_SESSIONS.get(session_id)


# ---------------------------------------------------------------------------
# Gemini call helpers
# ---------------------------------------------------------------------------

def _client():
    if not GEMINI_API_KEY_1:
        raise RuntimeError("GEMINI_API_KEY_1 not configured; cannot run chat agent")
    return make_client(GEMINI_API_KEY_1)


def _messages_to_contents(messages: List[Dict[str, Any]]) -> List[types.Content]:
    """Convert our stored message history back into Gemini Content objects."""
    out: List[types.Content] = []
    for m in messages:
        role = m.get("role")
        if role == "user":
            out.append(types.Content(role="user", parts=[types.Part.from_text(text=m.get("content") or "")]))
        elif role == "model":
            parts: List[types.Part] = []
            if m.get("content"):
                parts.append(types.Part.from_text(text=m["content"]))
            for tc in m.get("tool_calls") or []:
                parts.append(types.Part(function_call=types.FunctionCall(name=tc["name"], args=tc["args"])))
            if parts:
                out.append(types.Content(role="model", parts=parts))
        elif role == "tool":
            out.append(types.Content(
                role="user",
                parts=[types.Part.from_function_response(
                    name=m["name"], response=m.get("response") or {},
                )],
            ))
    return out


# ---------------------------------------------------------------------------
# The agent loop
# ---------------------------------------------------------------------------

MAX_TOOL_ITERATIONS = 6


async def run_agent_stream(
    session_id: str,
    user_message: str,
    college_id: str,
    drive_context_id: Optional[str] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """Async generator yielding SSE-ready event dicts."""
    session = get_session(session_id)
    if not session:
        yield _event("error", message="session not found")
        return

    messages: List[Dict[str, Any]] = list(session.get("messages") or [])

    # Pin drive context: if present, prefetch and stuff as a synthetic assistant turn
    # so the LLM can "see" the drive without the user needing to paste it.
    if drive_context_id and not any(m.get("pinned_drive") == drive_context_id for m in messages):
        drive = fetch_drive(drive_context_id)
        if "error" not in drive:
            messages.append({
                "role": "model",
                "content": f"[Pinned drive context: {drive.get('role')} @ {drive.get('company_id')} — eligibility {drive.get('eligibility_rules')}]",
                "pinned_drive": drive_context_id,
            })

    # Append the user turn
    messages.append({"role": "user", "content": user_message})
    yield _event("user_message", content=user_message)

    # If Gemini isn't configured, run the deterministic fallback plan.
    if not GEMINI_API_KEY_1:
        async for ev in run_fallback_stream(college_id, user_message, drive_context_id):
            if ev["type"] == "assistant_message":
                messages.append({"role": "model", "content": ev["content"], "fallback": True})
            if ev["type"] == "done":
                break
            yield ev
        yield _event("done")
        _save_messages(session_id, messages, drive_context_id)
        return

    try:
        client = _client()
        tools = _tool_declarations()
        config = types.GenerateContentConfig(
            tools=tools,
            system_instruction=SYSTEM_PROMPT,
            temperature=0.3,
        )

        iteration = 0
        while iteration < MAX_TOOL_ITERATIONS:
            iteration += 1
            yield _event("thinking", iteration=iteration)

            contents = _messages_to_contents(messages)
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=GEMINI_FLASH_MODEL,
                contents=contents,
                config=config,
            )

            candidate = (response.candidates or [None])[0]
            if not candidate or not candidate.content:
                yield _event("error", message="Gemini returned no candidate")
                break

            parts = candidate.content.parts or []
            function_calls = [p.function_call for p in parts if getattr(p, "function_call", None)]
            text_parts = [p.text for p in parts if getattr(p, "text", None)]

            if function_calls:
                # Record model turn with the tool calls
                tool_calls_list = [
                    {"name": fc.name, "args": dict(fc.args or {})}
                    for fc in function_calls
                ]
                messages.append({
                    "role": "model",
                    "content": "\n".join(text_parts) if text_parts else None,
                    "tool_calls": tool_calls_list,
                })

                # Execute each tool and append tool results
                for tc in tool_calls_list:
                    yield _event("tool_call", name=tc["name"], args=tc["args"])
                    fn = TOOL_REGISTRY.get(tc["name"])
                    if fn is None:
                        result = {"error": f"unknown tool: {tc['name']}"}
                    else:
                        try:
                            # Inject college_id where the tool needs it but the LLM didn't pass it
                            call_args = dict(tc["args"] or {})
                            if tc["name"] in ("search_students", "semantic_rank") and "college_id" not in call_args:
                                call_args["college_id"] = college_id
                            result = await asyncio.to_thread(fn, **call_args)
                        except TypeError as te:
                            result = {"error": f"tool invocation failed: {te}"}
                        except Exception as e:
                            result = {"error": f"tool raised: {e}"}

                    yield _event("tool_result", name=tc["name"], result=result)
                    messages.append({"role": "tool", "name": tc["name"], "response": result})

                # Loop back for LLM to synthesise / continue
                continue

            # No function calls → final answer
            final = "\n".join(text_parts).strip() or "(no response)"
            messages.append({"role": "model", "content": final})
            yield _event("assistant_message", content=final)
            break
        else:
            # Hit the iteration cap
            yield _event("error", message=f"Max {MAX_TOOL_ITERATIONS} tool iterations reached")
            messages.append({"role": "model", "content": "(agent exceeded max tool iterations)"})

    except Exception as e:
        # Gemini failed (429, network, etc.) — fall back to the deterministic plan
        # so the user still gets a useful answer. Emit a soft notice so the UI can
        # badge the message as "(fallback mode)".
        yield _event("fallback_triggered", reason=str(e)[:200])
        async for ev in run_fallback_stream(college_id, user_message, drive_context_id):
            if ev["type"] == "assistant_message":
                messages.append({"role": "model", "content": ev["content"], "fallback": True})
            if ev["type"] == "done":
                break
            yield ev

    _save_messages(session_id, messages, drive_context_id)
    yield _event("done")
