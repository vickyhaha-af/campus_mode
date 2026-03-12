import os
import json
import numpy as np
from google import genai
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from models.schemas import (
    CompareRequest, CompareResult, CompareComposite, CompareDimensionScore,
    AttributionRequest, AttributionResult, SentenceAttribution
)
from services.session_store import load_session
from services.embedder import _embed_with_retry
from config import BOOTSTRAP_ITERATIONS, BOOTSTRAP_CHUNKS, DEFAULT_WEIGHTS, GEMINI_API_KEY_1

router = APIRouter(prefix="/api/explain", tags=["explain"])

# Initialize the new SDK client
client = genai.Client(api_key=GEMINI_API_KEY_1)

def _cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    if len(vec1) == 0 or len(vec2) == 0:
        return 0.0
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(vec1, vec2) / (norm1 * norm2))

def _bootstrap_score_gap(vA: np.ndarray, vB: np.ndarray, jd_v: np.ndarray, iterations: int=1000, chunks: int=10):
    if len(vA) == 0 or len(vB) == 0 or len(jd_v) == 0:
        return 0.0, 0.0, 0.0, False, "None"

    # Ensure equal length safely
    min_len = min(len(vA), len(vB), len(jd_v))
    vA = vA[:min_len]
    vB = vB[:min_len]
    jd_v = jd_v[:min_len]

    chunk_size = min_len // chunks
    if chunk_size == 0:
        scA = _cosine_similarity(vA, jd_v)
        scB = _cosine_similarity(vB, jd_v)
        gap = (scA - scB) * 100
        return gap, gap, gap, False, "None"
        
    vA_chunks = [vA[i*chunk_size:(i+1)*chunk_size] for i in range(chunks-1)]
    vA_chunks.append(vA[(chunks-1)*chunk_size:])
    
    vB_chunks = [vB[i*chunk_size:(i+1)*chunk_size] for i in range(chunks-1)]
    vB_chunks.append(vB[(chunks-1)*chunk_size:])

    scores_A = []
    scores_B = []

    for _ in range(iterations):
        indices = np.random.randint(0, chunks, chunks)
        
        boot_vA = np.concatenate([vA_chunks[i] for i in indices])
        boot_vB = np.concatenate([vB_chunks[i] for i in indices])
        
        scores_A.append(_cosine_similarity(boot_vA, jd_v))
        scores_B.append(_cosine_similarity(boot_vB, jd_v))

    scores_A = np.array(scores_A)
    scores_B = np.array(scores_B)

    mean_A = np.mean(scores_A)
    mean_B = np.mean(scores_B)
    std_A = np.std(scores_A)
    std_B = np.std(scores_B)

    gap_mean = (mean_A - mean_B) * 100
    gap_se = np.sqrt(std_A**2 + std_B**2) * 100
    
    ci_lower = gap_mean - 1.96 * gap_se
    ci_upper = gap_mean + 1.96 * gap_se
    
    significant = False
    winner = "None"
    
    if ci_lower > 0 and ci_upper > 0:
        significant = True
        winner = "A"
    elif ci_lower < 0 and ci_upper < 0:
        significant = True
        winner = "B"

    # Invert signs if candidate B is the winner, CI is always presented relative to winner in UI usually, 
    # but we will return strictly A - B.
    return gap_mean, ci_lower, ci_upper, significant, winner

@router.post("/compare", response_model=CompareResult)
async def compare_candidates(request: CompareRequest):
    session = load_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    candA = next((c for c in session.scores if c.candidate_name == request.candidate_id_A), None)
    candB = next((c for c in session.scores if c.candidate_name == request.candidate_id_B), None)
    
    if not candA or not candB:
        raise HTTPException(status_code=404, detail="Candidates not found")

    jd_embeds = session.embeddings.get("jd", {})
    embedA = session.embeddings.get(candA.candidate_name, {})
    embedB = session.embeddings.get(candB.candidate_name, {})

    w_skills = session.weights.skills
    w_exp = session.weights.experience
    w_edu = session.weights.education

    dimensions = {}
    for dim in ["skills", "experience", "education"]:
        vA = np.array(embedA.get(dim, []))
        vB = np.array(embedB.get(dim, []))
        jd_v = np.array(jd_embeds.get(dim, []))
        
        gap, ci_l, ci_u, sig, win = _bootstrap_score_gap(vA, vB, jd_v, BOOTSTRAP_ITERATIONS, BOOTSTRAP_CHUNKS)
        dimensions[dim] = CompareDimensionScore(
            gap=gap,
            ci_lower=ci_l,
            ci_upper=ci_u,
            significant=sig,
            winner=win
        )

    delta_skills_cont = (candA.skills_score - candB.skills_score) * w_skills
    delta_exp_cont = (candA.experience_score - candB.experience_score) * w_exp
    delta_edu_cont = (candA.education_score - candB.education_score) * w_edu
    
    total_delta = candA.composite_score - candB.composite_score
    
    if abs(total_delta) > 0.01:
        s_share = abs(delta_skills_cont / total_delta * 100)
        e_share = abs(delta_exp_cont / total_delta * 100)
        ed_share = abs(delta_edu_cont / total_delta * 100)
    else:
        s_share = e_share = ed_share = 0.0

    contributions = {"skills": delta_skills_cont, "experience": delta_exp_cont, "education": delta_edu_cont}
    primary_driver = max(contributions, key=lambda k: abs(contributions[k]))

    composite = CompareComposite(
        total_delta=total_delta,
        skills_contribution=delta_skills_cont,
        exp_contribution=delta_exp_cont,
        edu_contribution=delta_edu_cont,
        skills_share_pct=s_share,
        exp_share_pct=e_share,
        edu_share_pct=ed_share,
        primary_driver=primary_driver
    )

    # Generate Narrative
    try:
        prompt = f"""You are an HR analytics engine. Write a single paragraph (max 60 words) explaining why Candidate A scored differently than Candidate B.
Candidate A composite: {candA.composite_score:.1f}%
Candidate B composite: {candB.composite_score:.1f}%
Total Gap: {total_delta:.1f}pp
Skills Contribution: {delta_skills_cont:.1f}pp ({s_share:.1f}% share of gap).
Experience Contribution: {delta_exp_cont:.1f}pp ({e_share:.1f}% share of gap).
Education Contribution: {delta_edu_cont:.1f}pp ({ed_share:.1f}% share of gap).

The primary driver is {primary_driver}. Make it sound like a professional analytics insight. Do not use generic filler. Do not use bullet points. If Candidate A won, say "Candidate A possesses an advantage driven by..."
"""
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=120,
            )
        )
        narrative = response.text.strip()
    except Exception as e:
        print(f"Narrative generation failed: {e}")
        narrative = f"Candidate {'A' if total_delta > 0 else 'B'} scored higher. The primary driver of the {abs(total_delta):.1f}pp gap was {primary_driver} ({max(s_share, e_share, ed_share):.1f}% of the difference)."

    return CompareResult(
        candidate_A=candA.model_dump(),
        candidate_B=candB.model_dump(),
        dimensions=dimensions,
        composite=composite,
        narrative=narrative
    )

import re

@router.post("/attribution", response_model=AttributionResult)
async def sentence_attribution(request: AttributionRequest):
    session = load_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    resume = next((r for r in session.resumes if r.candidate_name == request.candidate_id), None)
    if not resume:
        raise HTTPException(status_code=404, detail="Candidate resume not found")

    jd_embeds = session.embeddings.get("jd", {})
    jd_v = np.array(jd_embeds.get(request.dimension, []))
    
    if len(jd_v) == 0:
        raise HTTPException(status_code=400, detail="Missing JD embedding for dimension")

    text = ""
    if request.dimension == "skills":
        text = resume.skills_text or "Skills: " + ", ".join(resume.skills)
    elif request.dimension == "experience":
        text = resume.experience_text or "Experience: " + ", ".join([e.get('description', '') for e in resume.experience])
    elif request.dimension == "education":
        text = resume.education_text or "Education: " + ", ".join([e.get('institution', '') for e in resume.education])
        
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +|\n|;', text) if s.strip()]
    if not sentences:
        return AttributionResult(sentences=[], total_score=0.0, explained_score=0.0, unexplained=0.0)

    # 1. Base score
    v_full = np.array(_embed_with_retry(text, "SEMANTIC_SIMILARITY"))
    s_full = _cosine_similarity(v_full, jd_v) * 100

    # 2. Occlusion
    raw_conts = []
    for i, s_i in enumerate(sentences):
        occluded_text = " ".join([s for j, s in enumerate(sentences) if j != i])
        
        # Rate limit protection + cost
        v_occ = np.array(_embed_with_retry(occluded_text, "SEMANTIC_SIMILARITY"))
        s_occ = _cosine_similarity(v_occ, jd_v) * 100
        
        contribution = s_full - s_occ
        raw_conts.append(contribution)

    # Normalize roughly so sum(|c|) relates to explanatory power
    abs_sum = sum(abs(c) for c in raw_conts) if sum(abs(c) for c in raw_conts) else 1.0
    
    results = []
    explained_score = sum(c for c in raw_conts if c > 0)
    
    for i, c in enumerate(raw_conts):
        pct = (abs(c) / abs_sum) * s_full if abs_sum > 0 else 0
        results.append({
            "text": sentences[i],
            "contribution": c,
            "pct_of_score": pct
        })
        
    results.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    
    out_sentences = []
    for rank, r in enumerate(results, 1):
        out_sentences.append(SentenceAttribution(
            text=r["text"],
            contribution=r["contribution"],
            rank=rank,
            pct_of_score=r["pct_of_score"]
        ))
        
    unexplained = s_full - explained_score

    return AttributionResult(
        sentences=out_sentences,
        total_score=s_full,
        explained_score=explained_score,
        unexplained=unexplained
    )
