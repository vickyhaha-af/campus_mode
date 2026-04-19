"""
Parser service — uses Gemini Flash (google-genai SDK) to extract structured fields
from raw resume/JD text.
"""
import json
import time
from google import genai
from google.genai import types
from services.gemini_client import make_client
from config import (
    GEMINI_API_KEY_1, GEMINI_FLASH_MODEL,
    API_CALL_DELAY_SECONDS, MAX_RETRIES,
    TIER_1_KEYWORDS, TIER_2_KEYWORDS, EXPERIENCE_COHORTS
)
from models.schemas import ParsedResume, ParsedJD


RESUME_PARSE_PROMPT = """You are a resume parser. Extract structured information from the following resume text and return ONLY valid JSON (no markdown, no code blocks, just raw JSON).

Resume Text:
{text}

Return this exact JSON structure:
{{
    "candidate_name": "Full name of the candidate",
    "skills": ["skill1", "skill2"],
    "skills_text": "A paragraph summarizing all technical and soft skills",
    "experience": [
        {{
            "company": "Company name",
            "role": "Job title",
            "duration": "Duration string",
            "years": 1.5,
            "description": "Brief description of responsibilities"
        }}
    ],
    "experience_text": "A paragraph summarizing all work experience",
    "experience_years": 3.5,
    "education": [
        {{
            "institution": "University/College name",
            "degree": "Degree name",
            "field": "Field of study",
            "year": "Graduation year or expected"
        }}
    ],
    "education_text": "A paragraph summarizing educational background",
    "certifications": ["cert1", "cert2"]
}}

Rules:
- Extract ALL skills mentioned anywhere in the resume (technical, tools, frameworks, languages, soft skills)
- Calculate total experience_years by summing all role durations
- If information is missing, use empty strings or empty lists
- Return ONLY the JSON object, nothing else"""

JD_PARSE_PROMPT = """You are a job description parser. Extract structured information from the following job description and return ONLY valid JSON (no markdown, no code blocks, just raw JSON).

Job Description:
{text}

Return this exact JSON structure:
{{
    "title": "Job title",
    "required_skills": ["skill1", "skill2"],
    "skills_text": "A paragraph summarizing all required and preferred skills",
    "experience_requirements": "Experience requirement as stated",
    "experience_text": "A paragraph about experience expectations",
    "education_requirements": "Education requirement as stated",
    "education_text": "A paragraph about education expectations",
    "nice_to_have": ["nice1", "nice2"],
    "responsibilities": ["resp1", "resp2"]
}}

Rules:
- Include ALL skills mentioned (required and preferred/nice-to-have)
- Separate required skills from nice-to-have skills
- If sections are missing, use empty strings or empty lists
- Return ONLY the JSON object, nothing else"""


def _get_client():
    return make_client(GEMINI_API_KEY_1)


def _call_gemini_with_retry(prompt: str) -> str:
    if not GEMINI_API_KEY_1:
        raise RuntimeError("GEMINI_API_KEY_1 is not configured")

    client = _get_client()

    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=GEMINI_FLASH_MODEL,
                contents=prompt,
            )
            return response.text
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait_time = API_CALL_DELAY_SECONDS * (2 ** attempt)
                time.sleep(wait_time)
            else:
                raise RuntimeError(f"Gemini API call failed after {MAX_RETRIES} attempts: {str(e)}")
    return ""


def _clean_json_response(text: str) -> str:
    """Clean potential markdown code blocks from Gemini response."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _classify_institution_tier(education: list[dict]) -> str:
    for edu in education:
        institution = edu.get("institution", "").lower()
        for keyword in TIER_1_KEYWORDS:
            if keyword in institution:
                return "tier_1"
        for keyword in TIER_2_KEYWORDS:
            if keyword in institution:
                return "tier_2"
    return "tier_3"


def _classify_experience_cohort(years: float) -> str:
    for cohort_name, (min_y, max_y) in EXPERIENCE_COHORTS.items():
        if min_y <= years <= max_y:
            return cohort_name
    return "lead"


def _parse_json_safe(text: str) -> dict:
    cleaned = _clean_json_response(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        import re
        json_match = re.search(r"\{[\s\S]*\}", cleaned)
        if json_match:
            return json.loads(json_match.group())
        raise ValueError("Failed to parse Gemini response as JSON")


def parse_resume(text: str) -> ParsedResume:
    prompt = RESUME_PARSE_PROMPT.format(text=text[:8000])

    try:
        response_text = _call_gemini_with_retry(prompt)
        data = _parse_json_safe(response_text)
    except Exception:
        # Heuristic fallback
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        candidate_name = lines[0] if lines else "Unknown"
        import re
        skills = []
        for ln in lines:
            if any(k in ln.lower() for k in ["skill", "technology", "stack", "tools", "languages"]):
                parts = re.split(r"[,\u2022\-•]", ln)
                skills.extend([p.strip() for p in parts if len(p.strip()) > 1])
        skills = list(dict.fromkeys(skills))
        data = {
            "candidate_name": candidate_name,
            "skills": skills,
            "skills_text": text[:500],
            "experience": [],
            "experience_text": "",
            "experience_years": 0,
            "education": [],
            "education_text": "",
            "certifications": [],
        }

    resume = ParsedResume(
        candidate_name=data.get("candidate_name", "Unknown"),
        skills=data.get("skills", []),
        skills_text=data.get("skills_text", ""),
        experience=data.get("experience", []),
        experience_text=data.get("experience_text", ""),
        experience_years=float(data.get("experience_years", 0)),
        education=data.get("education", []),
        education_text=data.get("education_text", ""),
        certifications=data.get("certifications", []),
        raw_text=text[:2000],
    )
    resume.institution_tier = _classify_institution_tier(resume.education)
    return resume


def parse_jd(text: str) -> ParsedJD:
    prompt = JD_PARSE_PROMPT.format(text=text[:8000])

    try:
        response_text = _call_gemini_with_retry(prompt)
        data = _parse_json_safe(response_text)
    except Exception:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        title = lines[0] if lines else "Role"
        import re
        skills = []
        for ln in lines:
            if any(k in ln.lower() for k in ["must have", "required", "skills", "tech", "stack", "preferred"]):
                parts = re.split(r"[,\u2022\-•]", ln)
                skills.extend([p.strip() for p in parts if len(p.strip()) > 1])
        skills = list(dict.fromkeys(skills))
        data = {
            "title": title,
            "required_skills": skills,
            "skills_text": text[:500],
            "experience_requirements": "",
            "experience_text": "",
            "education_requirements": "",
            "education_text": "",
            "nice_to_have": [],
            "responsibilities": [],
        }

    return ParsedJD(
        title=data.get("title", ""),
        required_skills=data.get("required_skills", []),
        skills_text=data.get("skills_text", ""),
        experience_requirements=data.get("experience_requirements", ""),
        experience_text=data.get("experience_text", ""),
        education_requirements=data.get("education_requirements", ""),
        education_text=data.get("education_text", ""),
        nice_to_have=data.get("nice_to_have", []),
        responsibilities=data.get("responsibilities", []),
        raw_text=text[:2000],
    )
