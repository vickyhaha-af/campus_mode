"""
Analysis routes — scoring pipeline, recalculation, JD quality, comparison, demo mode.
"""
import uuid
import time
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from models.schemas import SessionData, WeightsUpdate, CandidateScore
from services.parser import parse_resume, parse_jd
from services.embedder import generate_resume_embeddings, generate_jd_embeddings
from services.scorer import score_candidate, recalculate_scores
from services.bias_audit import run_bias_audit
from services.jd_analyzer import analyze_jd_quality
from services.demo_data import get_demo_session
from config import DEFAULT_WEIGHTS

router = APIRouter(prefix="/api", tags=["analysis"])

# In-memory session store
sessions: dict[str, SessionData] = {}


@router.post("/analyze")
async def start_analysis(
    jd_text: str,
    resume_texts: list[dict]  # [{"filename": "...", "text": "..."}]
):
    """Run the full analysis pipeline: parse → embed → score → bias audit."""
    session_id = str(uuid.uuid4())
    start_time = time.time()
    
    session = SessionData(
        session_id=session_id,
        status="parsing",
        progress=0.0,
        created_at=datetime.now().isoformat()
    )
    sessions[session_id] = session
    
    try:
        # Step 1: Parse JD
        session.status = "parsing"
        session.progress = 5.0
        parsed_jd = parse_jd(jd_text)
        session.jd = parsed_jd
        
        # Step 1b: JD Quality Analysis
        session.jd_quality = analyze_jd_quality(parsed_jd)
        session.progress = 10.0
        
        # Step 2: Parse resumes
        parsed_resumes = []
        for i, resume_data in enumerate(resume_texts):
            try:
                parsed = parse_resume(resume_data["text"])
                if parsed.candidate_name == "Unknown" or not parsed.candidate_name:
                    parsed.candidate_name = resume_data.get("filename", f"Candidate {i+1}").replace(".pdf", "").replace(".docx", "")
                parsed_resumes.append(parsed)
            except Exception as e:
                print(f"Failed to parse {resume_data.get('filename', 'unknown')}: {e}")
            session.progress = 10 + (40 * (i + 1) / len(resume_texts))
        
        session.resumes = parsed_resumes
        
        # Step 3: Generate embeddings
        session.status = "embedding"
        jd_embeddings = generate_jd_embeddings(parsed_jd)
        session.progress = 55.0
        
        all_resume_embeddings = []
        for i, resume in enumerate(parsed_resumes):
            try:
                emb = generate_resume_embeddings(resume)
                all_resume_embeddings.append(emb)
            except Exception as e:
                print(f"Failed to embed {resume.candidate_name}: {e}")
                all_resume_embeddings.append({})
            session.progress = 55 + (25 * (i + 1) / len(parsed_resumes))
        
        # Step 4: Score candidates
        session.status = "scoring"
        scores = []
        weights = {"skills": 0.5, "experience": 0.3, "education": 0.2}
        
        for i, (resume, emb) in enumerate(zip(parsed_resumes, all_resume_embeddings)):
            if emb:
                candidate_score = score_candidate(emb, jd_embeddings, resume, parsed_jd, weights)
                scores.append(candidate_score)
        
        # Rank candidates
        scores.sort(key=lambda x: x.composite_score, reverse=True)
        for i, s in enumerate(scores):
            s.rank = i + 1
        
        session.scores = scores
        session.progress = 85.0
        
        # Step 5: Bias audit
        session.status = "auditing"
        if len(scores) >= 6:
            session.bias_audit = run_bias_audit(scores)
        session.progress = 95.0
        
        # Store embeddings for recalculation
        session.embeddings = {
            "jd": jd_embeddings,
            "resumes": all_resume_embeddings
        }
        
        session.status = "complete"
        session.progress = 100.0
        
        elapsed = time.time() - start_time
        
        return {
            "status": "complete",
            "session_id": session_id,
            "candidates_scored": len(scores),
            "processing_time_seconds": round(elapsed, 2),
            "bias_status": session.bias_audit.overall_status if session.bias_audit else "Not enough data"
        }
    
    except Exception as e:
        session.status = "error"
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session results."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/recalculate/{session_id}")
async def recalculate(session_id: str, weights: WeightsUpdate):
    """Recalculate scores with new weights — no re-embedding needed."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.status != "complete":
        raise HTTPException(status_code=400, detail="Analysis not yet complete")
    
    # Validate weights sum to ~1.0
    total = weights.skills + weights.experience + weights.education
    if abs(total - 1.0) > 0.01:
        raise HTTPException(status_code=400, detail=f"Weights must sum to 1.0, got {total}")
    
    new_weights = {
        "skills": weights.skills,
        "experience": weights.experience,
        "education": weights.education
    }
    
    session.scores = recalculate_scores(session.scores, new_weights)
    session.weights = weights
    
    # Re-run bias audit with new scores
    if len(session.scores) >= 6:
        session.bias_audit = run_bias_audit(session.scores)
    
    return session


@router.get("/demo")
async def get_demo():
    """Load demo mode with pre-computed data."""
    demo_session = get_demo_session()
    sessions[demo_session.session_id] = demo_session
    return demo_session


@router.get("/progress/{session_id}")
async def get_progress(session_id: str):
    """Get analysis progress."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "status": session.status,
        "progress": session.progress,
        "is_complete": session.status == "complete"
    }
