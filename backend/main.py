"""
Tech Vista — Bias-Aware AI Resume Screening for Indian Startups
FastAPI Application Entry Point
"""
import os
import json
import uuid
import time
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from typing import Optional

from config import DEFAULT_WEIGHTS, ALLOWED_ORIGINS
from models.schemas import SessionData, WeightsUpdate, ParsedJD
from services.file_handler import extract_text
from services.parser import parse_resume, parse_jd
from services.embedder import generate_resume_embeddings, generate_jd_embeddings
from services.scorer import score_candidate, recalculate_scores
from services.bias_audit import run_bias_audit
from services.jd_analyzer import analyze_jd_quality
from services.exporter import generate_pdf, generate_csv
from services.demo_data import get_demo_session
from services.audit_store import write_audit_log
from services.session_store import save_session, load_session, purge_expired
from services.auth_middleware import get_current_user, require_auth, check_session_ownership
from routes.upload import router as upload_router
from routes.pipeline import router as pipeline_router
from routes.explain import router as explain_router
from routes.talent_pool import router as talent_pool_router
from routes.auth import router as auth_router


# In-memory session store (file-backed for persistence across restarts)
sessions: dict[str, SessionData] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n🚀 Tech Vista Backend Starting...")
    print("📊 Bias-Aware AI Resume Screening for Indian Startups")
    print("=" * 55)
    removed = purge_expired()
    if removed:
        print(f"🧹 Purged {removed} expired sessions from disk")
    yield
    print("\n👋 Tech Vista Backend Shutting Down...")


app = FastAPI(
    title="Tech Vista API",
    description="Bias-Aware AI Resume Screening for Indian Startups",
    version="2.0.0",
    lifespan=lifespan
)

# CORS for frontend - Restricted to specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# Register routes
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(pipeline_router)
app.include_router(explain_router)
app.include_router(talent_pool_router)


# ==================== HEALTH ====================

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Tech Vista API",
        "version": "2.0.0",
        "active_sessions": len(sessions),
    }


# ==================== DEMO MODE ====================

@app.get("/api/demo")
async def get_demo():
    """Load demo mode with pre-computed data."""
    demo_session = get_demo_session()
    sessions[demo_session.session_id] = demo_session
    return demo_session


# ==================== FULL ANALYSIS PIPELINE ====================

@app.post("/api/analyze")
async def full_analysis(request: Request):
    """
    Full analysis pipeline: Upload JD + resumes → Parse → Embed → Score → Bias Audit.
    Accepts JSON body with jd_text and resume_texts.
    """
    # Get current user (optional - allows both auth and non-auth for demo)
    user = await get_current_user(request)
    user_id = user.get("id") if user else None
    
    body = await request.json()
    jd_text = body.get("jd_text", "")
    resume_texts = body.get("resume_texts", [])
    weights_body = body.get("weights") or {}
    
    if not jd_text:
        raise HTTPException(status_code=400, detail="JD text is required")
    if not resume_texts:
        raise HTTPException(status_code=400, detail="At least one resume text is required")
    
    session_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Normalise incoming weights (if provided) so they sum to 1.0.
    try:
        raw_weights = {
            "skills": float(weights_body.get("skills", DEFAULT_WEIGHTS["skills"])),
            "experience": float(weights_body.get("experience", DEFAULT_WEIGHTS["experience"])),
            "education": float(weights_body.get("education", DEFAULT_WEIGHTS["education"])),
        }
    except (TypeError, ValueError):
        raw_weights = DEFAULT_WEIGHTS.copy()

    total_w = raw_weights["skills"] + raw_weights["experience"] + raw_weights["education"]
    if total_w <= 0:
        norm_weights = DEFAULT_WEIGHTS.copy()
    else:
        norm_weights = {
            k: v / total_w for k, v in raw_weights.items()
        }

    session = SessionData(
        session_id=session_id,
        user_id=user_id,  # Associate session with authenticated user
        status="parsing",
        progress=0.0,
        created_at=datetime.now().isoformat(),
        weights=WeightsUpdate(
            skills=norm_weights["skills"],
            experience=norm_weights["experience"],
            education=norm_weights["education"],
        ),
    )
    sessions[session_id] = session
    
    try:
        # Step 1: Parse JD
        print(f"[{session_id[:8]}] Parsing JD...")
        parsed_jd = parse_jd(jd_text)
        session.jd = parsed_jd
        session.progress = 5.0
        
        # JD Quality Analysis
        print(f"[{session_id[:8]}] Analyzing JD quality...")
        session.jd_quality = analyze_jd_quality(parsed_jd)
        session.progress = 10.0
        
        # Step 2: Parse resumes
        print(f"[{session_id[:8]}] Parsing {len(resume_texts)} resumes...")
        parsed_resumes = []
        for i, resume_data in enumerate(resume_texts):
            try:
                text = resume_data.get("text", "")
                parsed = parse_resume(text)
                if not parsed.candidate_name or parsed.candidate_name == "Unknown":
                    parsed.candidate_name = resume_data.get("filename", f"Candidate {i+1}").replace(".pdf", "").replace(".docx", "")
                parsed_resumes.append(parsed)
                print(f"  ✓ Parsed: {parsed.candidate_name}")
            except Exception as e:
                print(f"  ✗ Failed: {resume_data.get('filename', 'unknown')} — {e}")
            session.progress = 10 + (35 * (i + 1) / len(resume_texts))
        
        session.resumes = parsed_resumes
        
        if not parsed_resumes:
            raise HTTPException(status_code=400, detail="No resumes could be parsed successfully")
        
        # Step 3: Generate embeddings
        session.status = "embedding"
        print(f"[{session_id[:8]}] Generating JD embeddings...")
        jd_embeddings = generate_jd_embeddings(parsed_jd)
        session.progress = 50.0
        
        print(f"[{session_id[:8]}] Generating resume embeddings...")
        all_resume_embeddings = []
        for i, resume in enumerate(parsed_resumes):
            try:
                emb = generate_resume_embeddings(resume)
                all_resume_embeddings.append(emb)
                print(f"  ✓ Embedded: {resume.candidate_name}")
            except Exception as e:
                print(f"  ✗ Embed failed: {resume.candidate_name} — {e}")
                all_resume_embeddings.append({})
            session.progress = 50 + (25 * (i + 1) / len(parsed_resumes))
        
        # Step 4: Score
        session.status = "scoring"
        print(f"[{session_id[:8]}] Scoring candidates...")
        scores = []
        weights = norm_weights
        
        for resume, emb in zip(parsed_resumes, all_resume_embeddings):
            if emb:
                s = score_candidate(emb, jd_embeddings, resume, parsed_jd, weights)
                scores.append(s)
        
        scores.sort(key=lambda x: x.composite_score, reverse=True)
        for i, s in enumerate(scores):
            s.rank = i + 1
        
        session.scores = scores
        session.progress = 85.0
        
        # Step 5: Bias audit
        session.status = "auditing"
        print(f"[{session_id[:8]}] Running bias audit...")
        if len(scores) >= 6:
            session.bias_audit = run_bias_audit(scores)
            print(f"  Bias status: {session.bias_audit.overall_status}")
        else:
            print(f"  Skipped: only {len(scores)} candidates (need 6+)")
        
        session.embeddings = {
            "jd": {k: v[:5] for k, v in jd_embeddings.items()},  # Store truncated for memory
        }
        
        session.status = "complete"
        session.progress = 100.0

        # Persist to disk so exports work after restarts
        try:
            save_session(session)
        except Exception as e:
            print(f"  ⚠ Session persist failed: {e}")

        # Best-effort audit log persistence to Supabase (if configured).
        try:
            write_audit_log(session)
        except Exception:
            pass
        
        elapsed = time.time() - start_time
        print(f"[{session_id[:8]}] ✅ Analysis complete in {elapsed:.1f}s")
        
        return session
    
    except HTTPException:
        raise
    except Exception as e:
        session.status = "error"
        print(f"[{session_id[:8]}] ❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== UPLOAD & EXTRACT ====================

@app.post("/api/upload/jd")
async def upload_jd(
    jd_text: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None)
):
    """Upload JD as text or file."""
    if not jd_text and not jd_file:
        raise HTTPException(status_code=400, detail="Provide JD text or file")
    
    text = jd_text or ""
    if jd_file:
        content = await jd_file.read()
        text = extract_text(content, jd_file.filename)
    
    return {"status": "success", "text": text}


@app.post("/api/upload/resumes")
async def upload_resumes(files: list[UploadFile] = File(...)):
    """Upload and extract text from batch resumes."""
    results = []
    errors = []
    
    for file in files:
        try:
            content = await file.read()
            text = extract_text(content, file.filename)
            results.append({"filename": file.filename, "text": text, "status": "success"})
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})
    
    return {"processed": len(results), "errors": len(errors), "results": results, "error_details": errors}


# ==================== SESSION & RECALCULATION ====================

def _ensure_session_active(session: SessionData) -> None:
    """
    Enforce 24-hour access window for sessions.

    Sessions older than 24 hours are treated as expired and are no longer
    accessible via the API, per the data minimisation requirement.
    """
    from datetime import datetime, timedelta

    if not session.created_at:
        return
    try:
        created = datetime.fromisoformat(session.created_at)
    except ValueError:
        return
    if datetime.now(created.tzinfo) - created > timedelta(hours=24):
        raise HTTPException(status_code=404, detail="Session not found or expired")


@app.get("/api/session/{session_id}")
async def get_session(session_id: str, request: Request):
    user = await get_current_user(request)
    user_id = user.get("id") if user else None
    
    session = sessions.get(session_id)
    if not session:
        session = load_session(session_id)
        if session:
            sessions[session_id] = session
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # Check ownership
    if not check_session_ownership(session, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    _ensure_session_active(session)
    return session


@app.post("/api/recalculate/{session_id}")
async def recalculate(session_id: str, weights: WeightsUpdate, request: Request):
    """Recalculate with new weights — no re-embedding."""
    user = await get_current_user(request)
    user_id = user.get("id") if user else None
    
    session = sessions.get(session_id)
    if not session:
        session = load_session(session_id)
        if session:
            sessions[session_id] = session
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Check ownership
    if not check_session_ownership(session, user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    _ensure_session_active(session)
    
    total = weights.skills + weights.experience + weights.education
    if abs(total - 1.0) > 0.05:
        # Normalize
        weights.skills /= total
        weights.experience /= total
        weights.education /= total
    
    new_w = {"skills": weights.skills, "experience": weights.experience, "education": weights.education}
    session.scores = recalculate_scores(session.scores, new_w)
    session.weights = weights
    
    if len(session.scores) >= 6:
        session.bias_audit = run_bias_audit(session.scores)
    
    return session


# ==================== EXPORT ====================

@app.get("/api/export/pdf/{session_id}")
async def export_pdf(session_id: str, request: Request):
    user = await get_current_user(request)
    user_id = user.get("id") if user else None
    
    session = sessions.get(session_id)
    if not session:
        session = load_session(session_id)
        if session:
            sessions[session_id] = session
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Check ownership
    if not check_session_ownership(session, user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    _ensure_session_active(session)
    
    pdf_bytes = generate_pdf(session)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=techvista_report_{session_id[:8]}.pdf"}
    )


@app.get("/api/export/csv/{session_id}")
async def export_csv(session_id: str, request: Request):
    user = await get_current_user(request)
    user_id = user.get("id") if user else None
    
    session = sessions.get(session_id)
    if not session:
        session = load_session(session_id)
        if session:
            sessions[session_id] = session
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Check ownership
    if not check_session_ownership(session, user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    _ensure_session_active(session)
    
    csv_content = generate_csv(session)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=techvista_results_{session_id[:8]}.csv"}
    )


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
