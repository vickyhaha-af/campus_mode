"""
Scorer service — multi-dimensional cosine similarity with weighted composite scoring.
"""
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from config import DEFAULT_WEIGHTS, EXPERIENCE_COHORTS
from models.schemas import CandidateScore


def _cosine_sim(vec_a: list[float], vec_b: list[float]) -> float:
    if not vec_a or not vec_b:
        return 0.0
    a = np.array(vec_a).reshape(1, -1)
    b = np.array(vec_b).reshape(1, -1)
    sim = cosine_similarity(a, b)[0][0]
    return round(max(0.0, min(100.0, (sim + 1) / 2 * 100)), 2)


def _classify_experience_cohort(years: float) -> str:
    for name, (lo, hi) in EXPERIENCE_COHORTS.items():
        if lo <= years <= hi:
            return name
    return "lead"


def _generate_explanation(dimension, score, resume, jd):
    strength = "Excellent" if score >= 80 else "Strong" if score >= 65 else "Moderate" if score >= 50 else "Partial" if score >= 35 else "Limited"

    matched, partial, missing = [], [], []

    if dimension == "skills":
        r_skills = resume.skills if hasattr(resume, 'skills') else []
        j_skills = jd.required_skills if hasattr(jd, 'required_skills') else []
        matched = [s for s in r_skills if any(s.lower() in js.lower() or js.lower() in s.lower() for js in j_skills)]
        missing = [s for s in j_skills if not any(s.lower() in rs.lower() or rs.lower() in s.lower() for rs in r_skills)]
        partial = [s for s in r_skills if s not in matched and any(any(w in js.lower() for w in s.lower().split()) for js in j_skills)]
        exp = f"{strength} skills match ({score:.0f}%). "
        if matched: exp += f"Direct matches: {', '.join(matched[:5])}. "
        if partial: exp += f"Related: {', '.join(partial[:3])}. "
        if missing: exp += f"Gaps: {', '.join(missing[:3])}."
        return exp, matched[:8], partial[:5], missing[:5]

    if dimension == "experience":
        yrs = resume.experience_years if hasattr(resume, 'experience_years') else 0
        exp = f"{strength} experience match ({score:.0f}%). {yrs:.1f} years of experience."
        return exp, [], [], []

    exp = f"{strength} education match ({score:.0f}%)."
    if resume.education:
        edu = resume.education[0] if isinstance(resume.education, list) else {}
        if isinstance(edu, dict):
            exp += f" {edu.get('degree', '')} from {edu.get('institution', '')}."
    return exp, [], [], []


def score_candidate(resume_emb, jd_emb, resume, jd, weights=None):
    if weights is None:
        weights = DEFAULT_WEIGHTS

    sk = _cosine_sim(resume_emb.get("skills", []), jd_emb.get("skills", []))
    ex = _cosine_sim(resume_emb.get("experience", []), jd_emb.get("experience", []))
    ed = _cosine_sim(resume_emb.get("education", []), jd_emb.get("education", []))

    sk_exp, matched, partial, missing = _generate_explanation("skills", sk, resume, jd)
    ex_exp, _, _, _ = _generate_explanation("experience", ex, resume, jd)
    ed_exp, _, _, _ = _generate_explanation("education", ed, resume, jd)

    composite = sk * weights.get("skills", 0.5) + ex * weights.get("experience", 0.3) + ed * weights.get("education", 0.2)

    return CandidateScore(
        candidate_name=resume.candidate_name,
        skills_score=sk,
        experience_score=ex,
        education_score=ed,
        composite_score=round(composite, 2),
        skills_explanation=sk_exp,
        experience_explanation=ex_exp,
        education_explanation=ed_exp,
        matched_skills=matched,
        partial_skills=partial,
        missing_skills=missing,
        institution_tier=resume.institution_tier,
        experience_years=resume.experience_years,
        experience_cohort=_classify_experience_cohort(resume.experience_years),
    )


def recalculate_scores(scores: list[CandidateScore], new_weights: dict) -> list[CandidateScore]:
    for s in scores:
        s.composite_score = round(
            s.skills_score * new_weights.get("skills", 0.5) +
            s.experience_score * new_weights.get("experience", 0.3) +
            s.education_score * new_weights.get("education", 0.2), 2
        )
    scores.sort(key=lambda x: x.composite_score, reverse=True)
    for i, s in enumerate(scores):
        s.rank = i + 1
    return scores
