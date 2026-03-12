"""
Upload routes — JD and resume file upload endpoints.
"""
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from services.file_handler import extract_text
from config import MAX_FILE_SIZE_MB, MAX_RESUMES_PER_BATCH, ALLOWED_EXTENSIONS

router = APIRouter(prefix="/api", tags=["upload"])


def _validate_file(file: UploadFile) -> None:
    """Validate file extension."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {ext}. Only PDF and DOCX are supported."
        )


@router.post("/upload/jd")
async def upload_jd(
    jd_text: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None)
):
    """Upload a Job Description — either as pasted text or a file."""
    if not jd_text and not jd_file:
        raise HTTPException(status_code=400, detail="Provide either JD text or a JD file")
    
    text = jd_text or ""
    
    if jd_file:
        _validate_file(jd_file)
        content = await jd_file.read()
        if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")
        text = extract_text(content, jd_file.filename)
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="JD text is empty")
    
    return {"status": "success", "text": text, "char_count": len(text)}


@router.post("/upload/resumes")
async def upload_resumes(files: list[UploadFile] = File(...)):
    """Upload batch resumes (PDF/DOCX)."""
    if len(files) > MAX_RESUMES_PER_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_RESUMES_PER_BATCH} resumes per batch"
        )
    
    results = []
    errors = []
    
    for file in files:
        try:
            _validate_file(file)
            content = await file.read()
            if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
                errors.append({"filename": file.filename, "error": f"Exceeds {MAX_FILE_SIZE_MB}MB limit"})
                continue
            text = extract_text(content, file.filename)
            results.append({"filename": file.filename, "text": text, "status": "success"})
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})
    
    return {
        "status": "success",
        "processed": len(results),
        "errors": len(errors),
        "results": results,
        "error_details": errors
    }
