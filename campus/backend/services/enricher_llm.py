"""
Rich LLM enricher — the "secret sauce" of TechVista Campus.

One Gemini Flash 2.0 call per resume extracts *everything*:
  • structured identity + academic fields (name, email, phone, cgpa, branch, year, backlogs)
  • skills, projects, internships, work experience
  • inferred nuance: passions, interests, personality_hints, role_fit_signals
  • achievement_weight (0–1 calibrated impact score)
  • embedding-ready text summaries (skills_text, projects_text, summary_text)

Resilience layers (in priority order):
  1. Circuit breaker: 3 consecutive Gemini failures → GEMINI_UNAVAILABLE=True for 60s,
     all subsequent calls skip straight to regex fallback.
  2. Fast-fail on 429 / quota-exhausted: abort retries immediately; retries only
     happen for transient (non-quota) errors.
  3. 5-second total wall-clock budget across all retries.
  4. Rich regex fallback — extracts ~15+ fields (skills, projects, internships,
     achievements, certifications, interests, contact, academic) so ingest always
     produces a usable profile even when Gemini is totally down.
"""
from __future__ import annotations

import json
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

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


# ---------------------------------------------------------------------------
# Circuit breaker state
# ---------------------------------------------------------------------------
#
# Thread-safe module-level state. When we see 3 consecutive failures, we stop
# calling Gemini for 60s to avoid wasting 3.5s/resume on doomed retries.

_CB_LOCK = threading.Lock()
_CB_CONSECUTIVE_FAILURES = 0
_CB_OPEN_UNTIL: float = 0.0
_CB_FAIL_THRESHOLD = 3
_CB_COOLDOWN_SEC = 60.0
GEMINI_TOTAL_BUDGET_SEC = 5.0


def _circuit_open() -> bool:
    with _CB_LOCK:
        return time.monotonic() < _CB_OPEN_UNTIL


def _circuit_reason() -> str:
    with _CB_LOCK:
        if time.monotonic() < _CB_OPEN_UNTIL:
            remaining = _CB_OPEN_UNTIL - time.monotonic()
            return f"gemini_circuit_open ({remaining:.0f}s remaining)"
        return "gemini_available"


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
                f"[enricher_llm] circuit breaker OPEN for {_CB_COOLDOWN_SEC:.0f}s "
                f"(after {_CB_CONSECUTIVE_FAILURES} consecutive failures)"
            )


def _is_quota_error(err: BaseException) -> bool:
    """Detect quota/429 errors so we skip retries immediately."""
    msg = str(err).lower()
    return (
        "429" in msg
        or "quota" in msg
        or "rate limit" in msg
        or "resource_exhausted" in msg
        or "resourceexhausted" in msg
        or "billing" in msg
    )


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
    """Call Gemini Flash with fast-fail-on-429 + 5s total wall-clock budget."""
    if not GEMINI_API_KEY_1:
        raise RuntimeError("Gemini API key missing")
    if _circuit_open():
        raise RuntimeError(f"circuit_open ({_circuit_reason()})")

    client = _client()
    start = time.monotonic()
    last_err: Optional[BaseException] = None

    for attempt in range(MAX_RETRIES):
        elapsed = time.monotonic() - start
        if elapsed >= GEMINI_TOTAL_BUDGET_SEC:
            last_err = last_err or RuntimeError("gemini_budget_exhausted")
            break
        try:
            response = client.models.generate_content(
                model=GEMINI_FLASH_MODEL,
                contents=prompt,
            )
            _record_success()
            return response.text or ""
        except Exception as e:  # noqa: BLE001
            last_err = e
            if _is_quota_error(e):
                _record_failure()
                raise RuntimeError(f"gemini_quota_exhausted: {e}")
            _record_failure()
            if attempt < MAX_RETRIES - 1:
                # Back off only if we have time left in the budget.
                backoff = API_CALL_DELAY_SECONDS * (2 ** attempt)
                remaining = GEMINI_TOTAL_BUDGET_SEC - (time.monotonic() - start)
                if backoff >= remaining:
                    break
                time.sleep(backoff)

    raise RuntimeError(f"gemini_failed: {last_err}")


def extract_rich_profile(resume_text: str) -> Dict[str, Any]:
    """
    Extract the full rich profile from raw resume text.

    Returns a dict matching the prompt's JSON schema. On any Gemini failure
    (quota, timeout, circuit-breaker-open, parse error) we return a rich
    regex-based fallback so the ingest pipeline always produces a usable
    profile.
    """
    snippet = resume_text[:12000]
    try:
        raw = _call_with_retry(RICH_EXTRACT_PROMPT.format(text=snippet))
        data = _parse_json(raw)
    except Exception as e:  # noqa: BLE001
        reason = _circuit_reason() if _circuit_open() else str(e)[:120]
        print(f"[enricher_llm] fallback → regex (reason: {reason})")
        fb = _fallback_with_text(resume_text)
        fb["_fallback_reason"] = reason
        return fb

    # Merge with fallback skeleton so downstream code can rely on every key.
    merged: Dict[str, Any] = {**FALLBACK, **data}

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


# ===========================================================================
# Regex / heuristic fallback — rich extraction without an LLM
# ===========================================================================

# Canonical skills allowlist. If a token from the resume matches one of these
# (case-insensitive, word-boundary), we're confident it's a real skill.
_TECH_SKILLS_CANON: List[str] = [
    # Languages
    "Python", "Java", "C", "C++", "C#", "Go", "Rust", "Kotlin", "Swift",
    "JavaScript", "TypeScript", "Ruby", "PHP", "Scala", "R", "MATLAB",
    "SQL", "Bash", "Shell", "Perl", "Julia", "Dart", "Objective-C", "Lua",
    "HTML", "CSS", "Sass", "LESS",
    # Web / frameworks
    "React", "React Native", "Next.js", "Vue", "Angular", "Svelte", "Redux",
    "Node", "Node.js", "Express", "Nest.js", "Django", "Flask", "FastAPI",
    "Spring", "Spring Boot", "Rails", "Laravel", "ASP.NET", ".NET",
    "jQuery", "Bootstrap", "Tailwind", "Material UI",
    # Mobile
    "Android", "iOS", "Flutter", "Xamarin",
    # Data / ML
    "NumPy", "Pandas", "SciPy", "scikit-learn", "sklearn", "TensorFlow",
    "PyTorch", "Keras", "JAX", "Hugging Face", "Transformers", "OpenCV",
    "NLTK", "spaCy", "XGBoost", "LightGBM", "LangChain", "LlamaIndex",
    "OpenAI", "Gemini", "LLM", "LLMs", "MLOps", "MLflow", "Airflow",
    # Databases
    "PostgreSQL", "Postgres", "MySQL", "SQLite", "MongoDB", "Redis",
    "Cassandra", "DynamoDB", "Firestore", "Firebase", "Elasticsearch",
    "Neo4j", "Supabase", "Snowflake", "BigQuery",
    # DevOps / cloud
    "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions",
    "CircleCI", "AWS", "GCP", "Azure", "Heroku", "Vercel", "Netlify",
    "Render", "Railway", "Linux", "Nginx", "Apache", "RabbitMQ", "Kafka",
    # Tools
    "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Figma", "Postman",
    "VS Code", "Vim", "Emacs",
    # Concepts / methods
    "REST", "GraphQL", "gRPC", "WebSocket", "OAuth", "JWT", "Microservices",
    "CI/CD", "Agile", "Scrum", "TDD", "OOP", "Machine Learning",
    "Deep Learning", "NLP", "Computer Vision", "Reinforcement Learning",
    "Data Structures", "Algorithms", "System Design", "Cybersecurity",
    "Blockchain", "Solidity", "Web3", "Ethereum",
]

_STOP_WORDS = {
    "the", "and", "for", "with", "from", "this", "that", "have", "has", "was",
    "were", "are", "been", "being", "will", "would", "could", "should", "into",
    "about", "over", "under", "above", "below", "more", "most", "some", "all",
    "any", "each", "other", "than", "then", "also", "such", "very", "just",
    "using", "used", "use", "uses", "work", "works", "working", "worked",
    "across", "through", "out", "off", "its", "his", "her", "our", "their",
    "them", "these", "those", "who", "whom", "which", "what", "when", "where",
    "how", "why", "but", "not", "you", "your", "yours",
}

# Branch detection — ONLY match when in clear academic context. We search a
# reduced window around degree / academic markers, not the whole document,
# so stray mentions in projects ("ML project", "AI course") don't pollute.
_BRANCH_MAP: List[Tuple[str, str]] = [
    # Management programs (IPM = Integrated Program in Management — IIM Indore/Rohtak/Ranchi)
    (r"\b(?:ipm|integrated\s*program(?:me)?\s*in\s*management)\b", "IPM"),
    (r"\b(?:bba|bachelor\s*of\s*business\s*administration)\b", "BBA"),
    (r"\b(?:bbm|bachelor\s*of\s*business\s*management)\b", "BBM"),
    (r"\b(?:bms|bachelor\s*of\s*management\s*studies)\b", "BMS"),
    (r"\b(?:pgdm|post\s*graduate\s*diploma\s*in\s*management)\b", "PGDM"),
    (r"\b(?:mba|master\s*of\s*business\s*administration)\b", "MBA"),
    # Engineering branches (require word boundaries, and require context prefix for loose abbrevs)
    (r"\bcomputer\s*science(?:\s*(?:and|&)?\s*engineering)?\b|(?:branch|major|specialisation|specialization|stream)\s*[:\-]?\s*cse\b", "CSE"),
    (r"\binformation\s*technology\b|(?:branch|major|specialisation|specialization|stream)\s*[:\-]?\s*it\b", "IT"),
    (r"\belectronics(?:\s*(?:and|&)?\s*communication)?\b|(?:branch|major|specialisation|specialization|stream)\s*[:\-]?\s*ece\b", "ECE"),
    (r"\belectrical(?:\s*(?:and|&)?\s*electronics)?\s*engineering\b|(?:branch|major|specialisation|specialization|stream)\s*[:\-]?\s*eee\b", "EEE"),
    (r"\belectrical\s*engineering\b|(?:branch|major|specialisation|specialization|stream)\s*[:\-]?\s*ee\b", "EE"),
    (r"\bmechanical\s*engineering\b|(?:branch|major|specialisation|specialization|stream)\s*[:\-]?\s*me\b", "ME"),
    (r"\bcivil\s*engineering\b|(?:branch|major|specialisation|specialization|stream)\s*[:\-]?\s*ce\b", "Civil"),
    (r"\bchemical\s*engineering\b|(?:branch|major|specialisation|specialization|stream)\s*[:\-]?\s*chem\b", "Chem"),
    (r"\baerospace\s*engineering\b|\baeronautical\s*engineering\b", "Aero"),
    (r"\bbiotechnology\b|\bbiomedical\s*engineering\b", "Bio"),
    (r"\b(?:m\.?sc|master\s*of\s*science)\b", "MSc"),
    (r"\b(?:m\.?tech|master\s*of\s*technology)\b", "MTech"),
    (r"\b(?:b\.?sc|bachelor\s*of\s*science)\b", "BSc"),
    # AI/ML and DS — require an explicit academic-program context word to avoid
    # false positives on ML mentions in projects/skills.
    (r"(?:b\.?tech|btech|m\.?tech|mtech|bsc|msc|degree|major|specialisation|specialization|stream|program(?:me)?)\s*(?:in\s+)?(?:ai(?:\s*(?:&|and)?\s*ml)?|artificial\s*intelligence(?:\s*(?:&|and)?\s*machine\s*learning)?)\b", "AI/ML"),
    (r"(?:b\.?tech|btech|m\.?tech|mtech|bsc|msc|degree|major|specialisation|specialization|stream|program(?:me)?)\s*(?:in\s+)?(?:data\s*science|ds)\b", "DS"),
]

_DEGREE_PATTERNS: List[Tuple[str, str]] = [
    (r"\bph\.?\s*d\b|\bdoctor(?:ate)?\b", "PhD"),
    (r"\bm\.?\s*tech\b|\bmaster\s*of\s*technology\b", "M.Tech"),
    (r"\bm\.?\s*sc\b|\bmaster\s*of\s*science\b", "M.Sc"),
    (r"\bm\.?\s*e\b|\bmaster\s*of\s*engineering\b", "M.E"),
    (r"\bmba\b|\bmaster\s*of\s*business\b", "MBA"),
    (r"\bpgdm\b|\bpost\s*graduate\s*diploma\s*in\s*management\b", "PGDM"),
    # Management bachelors — put BEFORE the engineering B.Tech so IPM students
    # aren't mis-tagged as B.Tech from some stray "tech" mention.
    (r"\bipm\b|\bintegrated\s*program(?:me)?\s*in\s*management\b", "IPM"),
    (r"\bbba\b|\bbachelor\s*of\s*business\s*administration\b", "BBA"),
    (r"\bbbm\b|\bbachelor\s*of\s*business\s*management\b", "BBM"),
    (r"\bbms\b|\bbachelor\s*of\s*management\s*studies\b", "BMS"),
    (r"\bb\.?\s*tech\b|\bbachelor\s*of\s*technology\b", "B.Tech"),
    (r"\bb\.?\s*e\b|\bbachelor\s*of\s*engineering\b", "B.E"),
    (r"\bb\.?\s*sc\b|\bbachelor\s*of\s*science\b", "B.Sc"),
    (r"\bb\.?\s*a\b|\bbachelor\s*of\s*arts\b", "B.A"),
    (r"\bb\.?\s*com\b|\bbachelor\s*of\s*commerce\b", "B.Com"),
]

_SECTION_ALIASES: Dict[str, List[str]] = {
    "skills": ["skills", "technical skills", "technologies", "technical expertise", "tools & technologies", "core competencies", "tech stack"],
    "projects": ["projects", "personal projects", "academic projects", "key projects", "selected projects", "relevant projects"],
    "experience": ["experience", "work experience", "professional experience", "employment"],
    "internships": ["internships", "internship", "internship experience"],
    "education": ["education", "academic", "academic qualifications", "qualifications"],
    "achievements": ["achievements", "awards", "honors", "accolades", "accomplishments", "honours"],
    "certifications": ["certifications", "certificates", "licences", "licenses", "courses"],
    "interests": ["interests", "hobbies", "personal interests"],
    "extracurriculars": ["extracurriculars", "extra curricular", "extracurricular activities", "activities", "positions of responsibility", "leadership"],
    "summary": ["summary", "objective", "about", "profile", "career objective", "professional summary"],
}

_HEADER_WORDS = {
    "resume", "curriculum", "vitae", "cv", "profile", "portfolio", "contact",
}

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s\-]?)?\(?\d{3,5}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}")
_URL_RE = re.compile(r"https?://\S+|www\.\S+")
_LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/\S+", re.I)
_GITHUB_RE = re.compile(r"(?:https?://)?(?:www\.)?github\.com/\S+", re.I)


def _fallback_with_text(resume_text: str) -> Dict[str, Any]:
    """Best-effort regex extraction when Gemini fails — keeps ingest moving.

    Extracts ~15+ fields: name, email, phone, linkedin, github, location,
    degree (in education), branch, year, cgpa, backlogs, skills, projects,
    internships, work_experience, achievements, certifications, interests,
    passions, summary + three embedding-ready text blobs.
    """
    skeleton: Dict[str, Any] = {**FALLBACK}
    text = resume_text or ""
    lines = [ln.rstrip() for ln in text.splitlines()]

    # --- Contact ---------------------------------------------------------
    em = _EMAIL_RE.search(text)
    if em:
        skeleton["email"] = em.group(0).strip()
    ph = _extract_phone(text)
    if ph:
        skeleton["phone"] = ph
    linkedin = _LINKEDIN_RE.search(text)
    github = _GITHUB_RE.search(text)

    # --- Name heuristic --------------------------------------------------
    skeleton["name"] = _guess_name(lines) or "Unknown"

    # --- Location --------------------------------------------------------
    loc = _guess_location(text, lines)
    if loc:
        skeleton["current_city"] = loc

    # --- Academic --------------------------------------------------------
    branch = _detect_branch(text)
    if branch:
        skeleton["branch"] = branch
    degree = _detect_degree(text)
    year = _detect_grad_year(text)
    if year:
        skeleton["year"] = year
    cgpa = _detect_cgpa(text)
    if cgpa is not None:
        skeleton["cgpa"] = cgpa
    active, cleared = _detect_backlogs(text)
    skeleton["backlogs_active"] = active
    skeleton["backlogs_cleared"] = cleared

    if degree or branch or year:
        edu_entry = {
            "institution": "",
            "degree": degree or "",
            "field": branch or "",
            "year": str(year) if year else "",
        }
        skeleton["education"] = [edu_entry]

    # --- Section-based extraction ---------------------------------------
    sections = _split_sections(lines)

    skills_from_section = _parse_skills_section(sections.get("skills", ""))
    skills_inline = _skills_from_allowlist(text)
    all_skills = _dedupe_preserve(skills_from_section + skills_inline)
    skeleton["skills"] = all_skills[:40]

    projects = _parse_projects_section(sections.get("projects", ""))
    skeleton["projects"] = projects

    internships = _parse_experience_section(sections.get("internships", ""))
    work_exp = _parse_experience_section(sections.get("experience", ""))
    # If "experience" looks internship-y and we don't have internships yet, upgrade.
    if not internships and work_exp:
        if any(_looks_internship(e) for e in work_exp):
            internships = [e for e in work_exp if _looks_internship(e)]
            work_exp = [e for e in work_exp if not _looks_internship(e)]
    skeleton["internships"] = internships
    skeleton["work_experience"] = work_exp
    skeleton["experience_years"] = round(
        sum(_estimate_months(e.get("duration", "")) for e in (internships + work_exp)) / 12.0, 2
    )

    skeleton["achievements"] = _parse_bullet_list(sections.get("achievements", ""))
    skeleton["certifications"] = _parse_bullet_list(sections.get("certifications", ""))

    interests_raw = _parse_bullet_list(sections.get("interests", "")) or \
        _parse_bullet_list(sections.get("extracurriculars", ""))
    interests, passions = _split_interests_passions(interests_raw)
    skeleton["interests"] = interests
    skeleton["passions"] = passions

    # --- Summary --------------------------------------------------------
    # Only use an explicit "Summary" / "Objective" / "About" section. If the
    # resume has none, leave `summary` empty — the UI shows "No summary
    # provided" which is truthful, rather than fabricating one from defaults.
    summ = (sections.get("summary", "") or "").strip()
    if summ:
        summ_lines = [l for l in summ.splitlines() if l.strip()]
        skeleton["summary"] = " ".join(summ_lines)[:500]
    else:
        skeleton["summary"] = ""

    # --- Embedding-ready text blobs -------------------------------------
    skeleton["skills_text"] = _join_skills_text(skeleton["skills"])
    skeleton["projects_text"] = _join_projects_text(projects, internships + work_exp)
    skeleton["summary_text"] = _join_summary_text(skeleton, degree)

    # Light domain-preference heuristic
    skeleton["domain_preferences"] = _infer_domains(skeleton["skills"], projects)

    # Stash extracted URLs onto hometown-adjacent fields? No — keep schema strict,
    # but surface them on summary_text so embeddings see them.
    url_bits: List[str] = []
    if linkedin:
        url_bits.append(f"LinkedIn: {linkedin.group(0)}")
    if github:
        url_bits.append(f"GitHub: {github.group(0)}")
    if url_bits:
        skeleton["summary_text"] = (skeleton["summary_text"] + " " + " ".join(url_bits)).strip()

    return skeleton


# ---------------------------------------------------------------------------
# Fallback helpers
# ---------------------------------------------------------------------------

def _extract_phone(text: str) -> str:
    # Prefer well-formed 10+ digit sequences after stripping junk.
    for m in _PHONE_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        if 10 <= len(digits) <= 13:
            return m.group(0).strip()
    return ""


def _guess_name(lines: List[str]) -> str:
    """Name heuristic: inspect first ~5 non-empty lines for a line that
    looks like a human name (2-4 words, title-case or upper-case, no digits,
    no email/URL, not a header word)."""
    candidates: List[str] = []
    for ln in lines:
        stripped = ln.strip()
        if not stripped:
            continue
        if len(candidates) == 0 and len(stripped) > 80:
            continue
        candidates.append(stripped)
        if len(candidates) >= 5:
            break

    for cand in candidates:
        if _EMAIL_RE.search(cand) or _URL_RE.search(cand):
            continue
        if re.search(r"\d", cand):
            continue
        low = cand.lower()
        if any(w in low for w in _HEADER_WORDS):
            continue
        words = re.findall(r"[A-Za-z][A-Za-z.\-']+", cand)
        if not (2 <= len(words) <= 5):
            continue
        # accept title-case OR all-caps name lines
        title_ok = all(w[0].isupper() for w in words)
        caps_ok = all(w.isupper() for w in words) and len(cand) <= 60
        if title_ok or caps_ok:
            return " ".join(words).title() if caps_ok else " ".join(words)
    # Fallback: first short line without email.
    for cand in candidates:
        if _EMAIL_RE.search(cand):
            continue
        if 2 <= len(cand.split()) <= 6 and len(cand) < 80:
            return cand
    return ""


def _guess_location(text: str, lines: List[str]) -> str:
    # Pattern: "Based in Bangalore", "Based out of Mumbai", "Location: Delhi"
    m = re.search(r"(?:based\s+(?:in|out\s+of)|location|city)[\s:]+([A-Z][A-Za-z .,-]{2,40})", text, re.I)
    if m:
        return m.group(1).strip().rstrip(",.")
    # Pattern: first few lines often have "Bangalore, India" or "Delhi | +91..."
    for ln in lines[:8]:
        candidates = re.findall(r"([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*,\s*(?:India|USA|UK|Canada|Singapore|UAE)", ln)
        if candidates:
            return candidates[0]
    return ""


def _detect_branch(text: str) -> str:
    low = text.lower()
    for pat, tag in _BRANCH_MAP:
        if re.search(pat, low):
            return tag
    return ""


def _detect_degree(text: str) -> str:
    low = text.lower()
    for pat, tag in _DEGREE_PATTERNS:
        if re.search(pat, low):
            return tag
    return ""


def _detect_grad_year(text: str) -> Optional[int]:
    """Graduation year — ONLY from explicit academic context.

    Previously we fell back to 'the latest 20XX in the document', which picked
    up internship end-dates / project years / award years and produced wildly
    wrong graduation years (e.g. a 1st-year IPM student tagged as class of 2023).
    Better to return None and let the UI show 'Year: —' than to invent.
    """
    patterns = [
        r"(?:class\s+of|expected(?:\s+graduation)?|graduating|graduation|batch(?:\s+of)?)\s*[:\-–—]?\s*(20\d{2})",
        r"(?:expected|anticipated)\s*[–—\-:]\s*(20\d{2})",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            try:
                y = int(m.group(1))
                if 2020 <= y <= 2035:
                    return y
            except ValueError:
                pass
    return None


def _detect_cgpa(text: str) -> Optional[float]:
    patterns = [
        # "CGPA: 8.5", "CGPA — 8.5", "CGPA = 8.5", "CGPA 8.5"
        r"(?:CGPA|GPA)\s*[:\-–—=]?\s*(\d+(?:\.\d+)?)(?:\s*/\s*\d+)?",
        r"(?:CGPA|GPA)\s+of\s+(\d+(?:\.\d+)?)",
        r"(\d+\.\d+)\s*/\s*10",
        r"(\d+\.\d+)\s*/\s*4(?:\.0)?",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            try:
                val = float(m.group(1))
                if 0 < val <= 10.0:
                    return round(val, 2)
            except ValueError:
                continue
    return None


def _detect_backlogs(text: str) -> Tuple[int, int]:
    low = text.lower()
    active = 0
    cleared = 0
    m = re.search(r"(\d+)\s*(?:active|current|present)\s*backlog", low)
    if m:
        active = int(m.group(1))
    m = re.search(r"(\d+)\s*(?:cleared|passed)\s*backlog", low)
    if m:
        cleared = int(m.group(1))
    if active == 0 and re.search(r"no\s+(?:active\s+)?backlogs?", low):
        active = 0
    return active, cleared


def _split_sections(lines: List[str]) -> Dict[str, str]:
    """Split resume into sections keyed by normalised section name.

    Heuristic: a "header" line is a short (<= 40 chars) line whose stripped,
    punctuation-free lowercase form matches one of our aliases.
    """
    # Invert the alias map.
    alias_to_key: Dict[str, str] = {}
    for key, aliases in _SECTION_ALIASES.items():
        for a in aliases:
            alias_to_key[a.lower()] = key

    sections: Dict[str, List[str]] = {}
    current: Optional[str] = None
    buf: List[str] = []

    def flush() -> None:
        if current is not None:
            sections.setdefault(current, []).extend(buf)

    for raw in lines:
        stripped = raw.strip()
        norm = re.sub(r"[^a-z& ]+", "", stripped.lower()).strip()
        norm = re.sub(r"\s+", " ", norm)
        if stripped and len(stripped) <= 40 and norm in alias_to_key:
            flush()
            current = alias_to_key[norm]
            buf = []
            continue
        if current is not None:
            buf.append(raw)
    flush()

    return {k: "\n".join(v).strip() for k, v in sections.items()}


def _parse_skills_section(block: str) -> List[str]:
    if not block:
        return []
    skills: List[str] = []
    # Split by common separators: commas, bullets, pipes, newlines, slashes
    for raw in re.split(r"[,\n•·\|]+", block):
        chunk = raw.strip(" -*:•·.\t")
        if not chunk or len(chunk) < 2 or len(chunk) > 50:
            continue
        # Drop leading "Languages:", "Frameworks:" etc.
        chunk = re.sub(r"^[A-Za-z ]+:\s*", "", chunk).strip()
        if not chunk:
            continue
        if chunk.lower() in _STOP_WORDS:
            continue
        skills.append(chunk)
    return _dedupe_preserve(skills)


def _skills_from_allowlist(text: str) -> List[str]:
    found: List[str] = []
    for skill in _TECH_SKILLS_CANON:
        # Word-boundary-ish match; escape special chars.
        esc = re.escape(skill)
        if re.search(rf"(?<![A-Za-z0-9]){esc}(?![A-Za-z0-9])", text, re.I):
            found.append(skill)
    return found


def _parse_projects_section(block: str) -> List[Dict[str, Any]]:
    if not block:
        return []
    entries = _split_entries(block)
    out: List[Dict[str, Any]] = []
    for entry in entries:
        lines = [l.strip(" -*•·\t") for l in entry.splitlines() if l.strip()]
        if not lines:
            continue
        name = lines[0][:120]
        description = " ".join(lines[1:])[:500] if len(lines) > 1 else ""
        tech = _skills_from_allowlist(entry)[:10]
        impact = _extract_impact(entry)
        out.append({
            "name": name,
            "description": description,
            "tech": tech,
            "impact": impact,
        })
        if len(out) >= 10:
            break
    return out


def _parse_experience_section(block: str) -> List[Dict[str, Any]]:
    if not block:
        return []
    entries = _split_entries(block)
    out: List[Dict[str, Any]] = []
    for entry in entries:
        lines = [l.strip(" -*•·\t") for l in entry.splitlines() if l.strip()]
        if not lines:
            continue
        header = lines[0]
        role, company = _split_role_company(header)
        duration = _extract_duration(entry) or (
            lines[1] if len(lines) > 1 and _looks_like_date(lines[1]) else ""
        )
        desc_start = 1
        if len(lines) > 1 and _looks_like_date(lines[1]):
            desc_start = 2
        description = " ".join(lines[desc_start:])[:600]
        out.append({
            "company": company,
            "role": role,
            "duration": duration,
            "description": description,
        })
        if len(out) >= 8:
            break
    return out


def _parse_bullet_list(block: str) -> List[str]:
    if not block:
        return []
    items: List[str] = []
    for raw in re.split(r"[\n•·]+", block):
        item = raw.strip(" -*•·\t")
        if not item:
            continue
        if len(item) > 300:
            item = item[:300]
        items.append(item)
    return items[:15]


def _split_entries(block: str) -> List[str]:
    """Split a section into individual entries.

    Heuristic: blank lines delimit entries; if none, a line starting with "•" or
    "- " delimits; fallback to treating whole block as one entry.
    """
    if re.search(r"\n\s*\n", block):
        return [e.strip() for e in re.split(r"\n\s*\n", block) if e.strip()]
    bullet_splits = re.split(r"\n(?=[•\-*]\s)", block)
    if len(bullet_splits) > 1:
        return [e.strip() for e in bullet_splits if e.strip()]
    return [block.strip()] if block.strip() else []


def _split_role_company(header: str) -> Tuple[str, str]:
    for sep in (" at ", " @ ", " | ", " — ", " – ", " - "):
        if sep in header:
            parts = header.split(sep, 1)
            return parts[0].strip(), parts[1].strip()
    return header.strip(), ""


_MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december"
_DATE_RANGE_RE = re.compile(
    rf"((?:{_MONTHS})\s+\d{{4}})\s*(?:[-–—]|to)\s*((?:{_MONTHS})\s+\d{{4}}|present|current|now)",
    re.I,
)
_SEASON_RE = re.compile(r"(summer|winter|spring|fall|autumn)\s+(\d{4})", re.I)


def _extract_duration(entry: str) -> str:
    m = _DATE_RANGE_RE.search(entry)
    if m:
        return f"{m.group(1)} – {m.group(2)}"
    m2 = _SEASON_RE.search(entry)
    if m2:
        return f"{m2.group(1)} {m2.group(2)}"
    return ""


def _looks_like_date(line: str) -> bool:
    return bool(_DATE_RANGE_RE.search(line) or _SEASON_RE.search(line))


def _estimate_months(duration: str) -> float:
    if not duration:
        return 0.0
    m = _DATE_RANGE_RE.search(duration)
    if m:
        start = _parse_my(m.group(1))
        end_raw = m.group(2).lower()
        if end_raw in ("present", "current", "now"):
            # Assume short internship window when current.
            end = start + 3
        else:
            end = _parse_my(end_raw)
        return max(0.0, float(end - start + 1))
    if _SEASON_RE.search(duration):
        return 3.0
    return 0.0


_MONTH_NUM: Dict[str, int] = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}


def _parse_my(s: str) -> int:
    """Parse 'May 2024' into a rough integer month-count."""
    parts = s.strip().lower().split()
    if len(parts) >= 2:
        m = _MONTH_NUM.get(parts[0], 1)
        try:
            y = int(parts[1])
            return y * 12 + m
        except ValueError:
            return 0
    return 0


def _looks_internship(entry: Dict[str, Any]) -> bool:
    hay = f"{entry.get('role', '')} {entry.get('description', '')}".lower()
    return "intern" in hay


def _extract_impact(text: str) -> str:
    # Anything with a number + percent / x multiplier / "reduced", "improved"
    m = re.search(r"[^.\n]*\b(?:\d+[xX%]?|\d+(?:\.\d+)?\s*(?:%|x|times|fold))[^.\n]*", text)
    if m:
        return m.group(0).strip()[:200]
    m2 = re.search(r"[^.\n]*\b(?:reduced|improved|increased|decreased|achieved|boosted|grew)\b[^.\n]*", text, re.I)
    if m2:
        return m2.group(0).strip()[:200]
    return ""


def _split_interests_passions(raw: List[str]) -> Tuple[List[str], List[str]]:
    # Simple heuristic: items with "club", "volunteer", "lead", "captain",
    # "founded", "ngo", "organised" → passion (sustained activity). Others → interest.
    interests: List[str] = []
    passions: List[str] = []
    pas_signals = re.compile(
        r"\b(club|volunteer|lead|captain|found(?:ed|er)|ngo|organi[sz]ed|committee|head|president|coordinator|teach|mentor|initiative)\b",
        re.I,
    )
    for item in raw:
        if pas_signals.search(item):
            passions.append(item)
        else:
            interests.append(item)
    return interests[:8], passions[:8]


def _infer_domains(skills: List[str], projects: List[Dict[str, Any]]) -> List[str]:
    domains: List[str] = []
    low = " ".join(skills).lower() + " " + " ".join(p.get("name", "") + " " + p.get("description", "") for p in projects).lower()
    mapping = [
        (r"\b(react|vue|angular|next\.js|tailwind|frontend|front-end|html|css)\b", "frontend"),
        (r"\b(fastapi|django|flask|express|spring|node|backend|rest|graphql|microservice)\b", "backend"),
        (r"\b(pytorch|tensorflow|scikit-learn|sklearn|ml|machine learning|deep learning|nlp|computer vision)\b", "ML/AI"),
        (r"\b(aws|gcp|azure|docker|kubernetes|terraform|devops|ci/cd|mlops)\b", "devops/cloud"),
        (r"\b(postgres|mongodb|redis|sql|bigquery|snowflake|data)\b", "data"),
        (r"\b(android|ios|flutter|react native|mobile)\b", "mobile"),
        (r"\b(solidity|blockchain|web3|ethereum)\b", "web3"),
        (r"\b(fintech|payments|trading|finance)\b", "fintech"),
        (r"\b(edtech|education|learning)\b", "edtech"),
    ]
    for pat, tag in mapping:
        if re.search(pat, low) and tag not in domains:
            domains.append(tag)
    return domains[:5]


def _synth_summary(rec: Dict[str, Any], degree: str) -> str:
    """Build a summary ONLY from fields we actually detected.

    Never invent a degree. If we have no confirmed degree + branch + year,
    return an empty string rather than fabricate ('B.Tech' defaulting was
    a real source of hallucinated profiles — regression from IPM users).
    """
    parts: List[str] = []
    name = rec.get("name")
    if not name:
        return ""
    parts.append(name)

    # Only mention academic details we actually extracted — no defaults.
    academic_bits: List[str] = []
    if degree:
        academic_bits.append(degree)
    if rec.get("branch"):
        academic_bits.append(rec["branch"])
    if academic_bits:
        parts.append("studying " + " ".join(academic_bits))

    if rec.get("year"):
        parts.append(f"graduating {rec['year']}")
    if rec.get("cgpa"):
        parts.append(f"CGPA {rec['cgpa']}")
    top_skills = (rec.get("skills") or [])[:3]
    if top_skills:
        parts.append("skilled in " + ", ".join(top_skills))

    # If the ONLY thing we have is a name, don't synthesise a summary —
    # an orphaned name isn't useful and reads as placeholder in the UI.
    if len(parts) <= 1:
        return ""
    return ". ".join(parts)[:500]


def _join_skills_text(skills: List[str]) -> str:
    if not skills:
        return ""
    return "Skills: " + ", ".join(skills)


def _join_projects_text(projects: List[Dict[str, Any]], experiences: List[Dict[str, Any]]) -> str:
    bits: List[str] = []
    for p in projects:
        chunk = p.get("name", "")
        if p.get("description"):
            chunk += ": " + p["description"]
        if p.get("tech"):
            chunk += " (tech: " + ", ".join(p["tech"]) + ")"
        if p.get("impact"):
            chunk += " Impact: " + p["impact"]
        bits.append(chunk)
    for e in experiences:
        role = e.get("role", "") or ""
        company = e.get("company", "") or ""
        if role and company:
            chunk = f"{role} at {company}"
        else:
            chunk = role or company
        if e.get("duration"):
            chunk += f" ({e['duration']})"
        if e.get("description"):
            chunk += ": " + e["description"]
        bits.append(chunk)
    return " | ".join(b for b in bits if b)


def _join_summary_text(rec: Dict[str, Any], degree: str) -> str:
    """Build embedding-text summary from real fields only.

    Does NOT synthesise when data is thin — it would add noise to the vector
    and surface as hallucinated text in student profile views.
    """
    parts: List[str] = []
    explicit = rec.get("summary") or _synth_summary(rec, degree)
    if explicit:
        parts.append(explicit)
    if rec.get("domain_preferences"):
        parts.append("Domains: " + ", ".join(rec["domain_preferences"]))
    if rec.get("achievements"):
        parts.append("Achievements: " + "; ".join(rec["achievements"][:3]))
    if rec.get("interests"):
        parts.append("Interests: " + ", ".join(rec["interests"][:5]))
    if rec.get("passions"):
        parts.append("Passions: " + ", ".join(rec["passions"][:5]))
    return " ".join(parts)[:1500]


def _dedupe_preserve(items: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        key = item.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item.strip())
    return out


# ---------------------------------------------------------------------------
# Safe coercion helpers
# ---------------------------------------------------------------------------

def _safe_float(v: Any) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _safe_float_or_none(v: Any) -> Optional[float]:
    try:
        return float(v) if v not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None


def _safe_int(v: Any) -> int:
    try:
        return int(float(v)) if v is not None else 0
    except (TypeError, ValueError):
        return 0


def _safe_int_or_none(v: Any) -> Optional[int]:
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
