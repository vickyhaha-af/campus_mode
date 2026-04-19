"""
Rich LLM enricher — the "secret sauce" of TechVista Campus.

One Gemini Flash 2.0 call per resume extracts *everything*:
  • structured identity + academic fields (name, email, phone, cgpa, branch, year, backlogs)
  • skills, projects, internships, work experience
  • inferred nuance: passions, interests, personality_hints, role_fit_signals
  • achievement_weight (0–1 calibrated impact score)
  • embedding-ready text summaries (skills_text, projects_text, summary_text)

Why one call instead of reusing parent's parse_resume:
  - we need extra fields (email, roll_no, branch, cgpa, passions, etc.)
  - two calls = half the ingest throughput against 15-RPM free tier
  - campus needs richer semantics than HR screening does
"""
from __future__ import annotations

import json
import re
import time
from typing import Any, Dict

# Parent backend services (on sys.path via main.py entry)
from services.gemini_client import make_client  # type: ignore
from config import GEMINI_API_KEY_1, GEMINI_FLASH_MODEL, MAX_RETRIES, API_CALL_DELAY_SECONDS  # type: ignore


RICH_EXTRACT_PROMPT = """You are a resume analyser for a college placement system. Extract EVERYTHING the schema asks for from the resume text below, and return ONLY raw JSON (no markdown, no code fences, no explanation).

Resume text:
{text}

Return this exact JSON structure:
{{
    "name": "Full name",
    "email": "Email if present in text, else empty string",
    "phone": "Phone if present, else empty string",
    "roll_no": "College roll number if present, else empty string",
    "branch": "Academic branch abbreviation — e.g. CSE, ECE, ME, IT, EE, Chem, Civil, MBA, MSc — if present",
    "year": 2026,
    "cgpa": 0.0,
    "backlogs_active": 0,
    "backlogs_cleared": 0,
    "date_of_birth": "ISO date YYYY-MM-DD if present, else empty",
    "hometown": "",
    "current_city": "",
    "skills": ["skill1", "skill2"],
    "projects": [
        {{"name": "Project name", "description": "1-2 sentence description", "tech": ["tech1","tech2"], "impact": "Outcome / metric if stated"}}
    ],
    "internships": [
        {{"company": "Company", "role": "Role", "duration": "e.g. May–Jul 2024", "description": "What they did"}}
    ],
    "work_experience": [
        {{"company": "Company", "role": "Role", "duration": "...", "description": "..."}}
    ],
    "experience_years": 0.0,
    "education": [
        {{"institution": "University", "degree": "B.Tech", "field": "CSE", "year": "2026"}}
    ],
    "certifications": ["cert1", "cert2"],
    "achievements": ["Won X", "Ranked Y"],
    "passions": ["What they seem to genuinely care about — inferred from project choices, extracurriculars, tone. Use concrete phrases like 'open-source', 'edtech', 'sustainability', 'competitive coding'. 3-6 items."],
    "interests": ["Hobbies, clubs, non-academic pursuits — e.g. 'debate', 'classical music', 'photography', 'football'. 3-6 items."],
    "personality_hints": {{
        "leadership": 0.0,
        "collaboration": 0.0,
        "initiative": 0.0,
        "communication": 0.0,
        "analytical_depth": 0.0,
        "notes": "One sentence qualitative impression"
    }},
    "role_fit_signals": {{
        "software_engineering": 0.0,
        "data_science_ml": 0.0,
        "product_management": 0.0,
        "consulting": 0.0,
        "finance": 0.0,
        "design": 0.0,
        "research": 0.0,
        "operations": 0.0,
        "marketing_sales": 0.0
    }},
    "domain_preferences": ["Concrete domains they've gravitated toward — e.g. 'backend', 'ML systems', 'fintech', 'devtools'. 2-5 items."],
    "achievement_weight": 0.0,
    "summary": "2-3 sentence rich human-readable summary. Focus on what makes this candidate distinctive.",
    "skills_text": "Paragraph listing ALL technical + soft skills — used for embedding, so be prose-heavy",
    "projects_text": "Paragraph describing projects + internships — used for embedding",
    "summary_text": "Paragraph blending everything — used for embedding. Include domain preferences, achievements, personality signal."
}}

Scoring rules for inferred fields (personality_hints, role_fit_signals, achievement_weight):
- Be CALIBRATED. Do not default to 0.5 or 0.7 for everything.
- 0.0 = no evidence, 0.3 = weak signal, 0.6 = clear signal, 0.9 = strong signal backed by multiple data points.
- achievement_weight is a holistic 0-1 score: tier of achievements × scope × verifiability. A student with "won national hackathon + published paper + 2 internships at top firms" is 0.85+. A blank slate is 0.1.

Extraction rules:
- Extract literal values verbatim (name, email, cgpa, backlogs).
- If a field is truly missing, use empty string / empty list / 0 / 0.0.
- For branch, normalise to standard abbreviation (CSE not "Computer Science and Engineering").
- For experience_years, SUM all internship durations + work experience in years.
- Return ONLY the JSON object. No preamble, no postamble, no markdown fences."""


FALLBACK: Dict[str, Any] = {
    "name": "Unknown",
    "email": "",
    "phone": "",
    "roll_no": "",
    "branch": "",
    "year": None,
    "cgpa": None,
    "backlogs_active": 0,
    "backlogs_cleared": 0,
    "date_of_birth": "",
    "hometown": "",
    "current_city": "",
    "skills": [],
    "projects": [],
    "internships": [],
    "work_experience": [],
    "experience_years": 0.0,
    "education": [],
    "certifications": [],
    "achievements": [],
    "passions": [],
    "interests": [],
    "personality_hints": {},
    "role_fit_signals": {},
    "domain_preferences": [],
    "achievement_weight": 0.0,
    "summary": "",
    "skills_text": "",
    "projects_text": "",
    "summary_text": "",
}


def _client():
    return make_client(GEMINI_API_KEY_1)


def _strip_fences(text: str) -> str:
    text = text.strip()
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
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            return json.loads(m.group())
        raise


def _call_with_retry(prompt: str) -> str:
    client = _client()
    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=GEMINI_FLASH_MODEL,
                contents=prompt,
            )
            return response.text or ""
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(API_CALL_DELAY_SECONDS * (2 ** attempt))
            else:
                raise RuntimeError(f"Gemini call failed after {MAX_RETRIES} tries: {e}")
    return ""


def extract_rich_profile(resume_text: str) -> Dict[str, Any]:
    """
    Extract the full rich profile from raw resume text.

    Returns a dict matching the prompt's JSON schema. On extraction failure,
    returns a skeleton FALLBACK dict so the ingest pipeline never crashes on
    one bad resume.
    """
    snippet = resume_text[:12000]  # larger than parent (8000) since we extract more
    try:
        raw = _call_with_retry(RICH_EXTRACT_PROMPT.format(text=snippet))
        data = _parse_json(raw)
    except Exception as e:
        print(f"[enricher_llm] fallback for resume: {e}")
        return _fallback_with_text(resume_text)

    # Merge with fallback skeleton so downstream code can rely on every key.
    merged = {**FALLBACK, **data}

    # Coerce numeric-ish fields to safe types
    merged["experience_years"] = _safe_float(merged.get("experience_years"))
    merged["cgpa"] = _safe_float_or_none(merged.get("cgpa"))
    merged["year"] = _safe_int_or_none(merged.get("year"))
    merged["backlogs_active"] = _safe_int(merged.get("backlogs_active"))
    merged["backlogs_cleared"] = _safe_int(merged.get("backlogs_cleared"))
    merged["achievement_weight"] = _clamp01(merged.get("achievement_weight"))

    # Clamp nested 0-1 scores
    for bucket in ("personality_hints", "role_fit_signals"):
        obj = merged.get(bucket) or {}
        for k, v in list(obj.items()):
            if isinstance(v, (int, float)):
                obj[k] = _clamp01(v)
        merged[bucket] = obj

    return merged


def _fallback_with_text(resume_text: str) -> Dict[str, Any]:
    """Best-effort regex extraction when Gemini fails — keeps ingest moving."""
    skeleton = {**FALLBACK}
    # Email sweep
    em = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", resume_text)
    if em:
        skeleton["email"] = em.group(0)
    # Phone (India-ish pattern)
    ph = re.search(r"(?:\+?91[\s\-]?)?\d{10}", resume_text)
    if ph:
        skeleton["phone"] = ph.group(0)
    # CGPA-looking number (e.g., "CGPA: 8.5")
    cg = re.search(r"(?:CGPA|GPA|cgpa|gpa)[\s:]+(\d+\.?\d*)", resume_text)
    if cg:
        skeleton["cgpa"] = _safe_float_or_none(cg.group(1))
    first_line = next((l.strip() for l in resume_text.splitlines() if l.strip()), "")
    if first_line and len(first_line) < 80:
        skeleton["name"] = first_line
    skeleton["summary"] = resume_text[:300]
    return skeleton


def _safe_float(v: Any) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _safe_float_or_none(v: Any):
    try:
        return float(v) if v not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None


def _safe_int(v: Any) -> int:
    try:
        return int(float(v)) if v is not None else 0
    except (TypeError, ValueError):
        return 0


def _safe_int_or_none(v: Any):
    try:
        return int(float(v)) if v not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None


def _clamp01(v: Any) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, x))
