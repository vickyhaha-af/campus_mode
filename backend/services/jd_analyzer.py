"""
JD Quality Analyzer — evaluates job description completeness and specificity.
Uses google-genai SDK.
"""
import json
from google import genai
from config import GEMINI_API_KEY_1, GEMINI_FLASH_MODEL
from models.schemas import JDQualityReport, ParsedJD


def _get_client():
    return genai.Client(api_key=GEMINI_API_KEY_1)


def analyze_jd_quality(parsed_jd: ParsedJD) -> JDQualityReport:
    local = _local_quality_check(parsed_jd)
    if not GEMINI_API_KEY_1:
        return local
    try:
        client = _get_client()
        prompt = f"""Analyze this job description for quality. Return ONLY valid JSON.

Job Description:
{parsed_jd.raw_text[:4000]}

Return this JSON:
{{
    "score": 75,
    "has_responsibilities": true,
    "has_requirements": true,
    "has_nice_to_haves": false,
    "specificity_analysis": "The JD is moderately specific...",
    "improvement_suggestions": ["Add nice-to-have section", "Specify team size"]
}}
Rules: score 0-100, specificity_analysis as a paragraph, suggestions max 5. Return ONLY JSON."""

        response = client.models.generate_content(
            model=GEMINI_FLASH_MODEL,
            contents=prompt,
        )
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        data = json.loads(text.strip())
        return JDQualityReport(
            score=data.get("score", local.score),
            has_responsibilities=data.get("has_responsibilities", local.has_responsibilities),
            has_requirements=data.get("has_requirements", local.has_requirements),
            has_nice_to_haves=data.get("has_nice_to_haves", local.has_nice_to_haves),
            specificity_analysis=data.get("specificity_analysis", local.specificity_analysis),
            improvement_suggestions=data.get("improvement_suggestions", local.improvement_suggestions),
        )
    except Exception:
        return local


def _local_quality_check(jd: ParsedJD) -> JDQualityReport:
    score = 0
    suggestions = []
    has_resp = len(jd.responsibilities) > 0
    has_req = len(jd.required_skills) > 0
    has_nice = len(jd.nice_to_have) > 0
    has_exp = bool(jd.experience_requirements)
    has_edu = bool(jd.education_requirements)

    if has_resp: score += 25
    else: suggestions.append("Add a responsibilities section describing day-to-day tasks")
    if has_req:
        score += 25
        if len(jd.required_skills) < 3: suggestions.append("Add more specific technical skills")
    else:
        suggestions.append("Add required skills/qualifications section")
    if has_nice: score += 15
    else: suggestions.append("Add nice-to-have skills for broader talent pool")
    if has_exp: score += 20
    else: suggestions.append("Specify required experience level")
    if has_edu: score += 15
    else: suggestions.append("Specify education requirements")

    analysis = "The JD is "
    if score >= 80: analysis += "well-structured with clear sections and specific requirements."
    elif score >= 50: analysis += "moderately detailed but could benefit from additional sections."
    else: analysis += "quite sparse — adding more detail will improve candidate quality."

    return JDQualityReport(
        score=score,
        has_responsibilities=has_resp,
        has_requirements=has_req,
        has_nice_to_haves=has_nice,
        specificity_analysis=analysis,
        improvement_suggestions=suggestions[:5],
    )
