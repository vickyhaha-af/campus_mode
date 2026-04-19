"""
Embedder service — uses Gemini text-embedding-004 (google-genai SDK) to generate dense vectors.
Separate embeddings per resume section (skills, experience, education).
"""
import time
from google import genai
from services.gemini_client import make_client
from config import GEMINI_API_KEY_2, GEMINI_EMBEDDING_MODEL, API_CALL_DELAY_SECONDS, MAX_RETRIES


def _get_client():
    return make_client(GEMINI_API_KEY_2)


def _embed_with_retry(text: str, task_type: str = "SEMANTIC_SIMILARITY") -> list[float]:
    """
    Generate embedding with exponential backoff retry.
    Falls back to a deterministic pseudo-embedding if key is not configured.
    """
    if not GEMINI_API_KEY_2:
        import numpy as np
        vec = np.zeros(8, dtype=float)
        for ch in text.lower()[:256]:
            vec[ord(ch) % 8] += 1.0
        return vec.tolist()

    client = _get_client()

    for attempt in range(MAX_RETRIES):
        try:
            result = client.models.embed_content(
                model=GEMINI_EMBEDDING_MODEL,
                contents=text,
                config=genai.types.EmbedContentConfig(task_type=task_type)
            )
            # New SDK returns result.embeddings list of ContentEmbedding objects
            return result.embeddings[0].values
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait_time = API_CALL_DELAY_SECONDS * (2 ** attempt)
                time.sleep(wait_time)
            else:
                # Final fallback — basic pseudo-embedding so pipeline doesn't crash
                import numpy as np
                vec = np.zeros(8, dtype=float)
                for ch in text.lower()[:256]:
                    vec[ord(ch) % 8] += 1.0
                return vec.tolist()
    return []


def generate_resume_embeddings(parsed_resume) -> dict:
    """
    Generate separate embeddings for each resume section.
    Returns dict: { "skills": [...], "experience": [...], "education": [...] }
    """
    embeddings = {}

    skills_text = parsed_resume.skills_text
    if not skills_text and parsed_resume.skills:
        skills_text = "Skills: " + ", ".join(parsed_resume.skills)
    if skills_text:
        embeddings["skills"] = _embed_with_retry(skills_text, "SEMANTIC_SIMILARITY")
        time.sleep(API_CALL_DELAY_SECONDS)

    experience_text = parsed_resume.experience_text
    if not experience_text and parsed_resume.experience:
        experience_text = "Experience: " + "; ".join(
            f"{exp.get('role', '')} at {exp.get('company', '')} for {exp.get('duration', '')}: {exp.get('description', '')}"
            for exp in parsed_resume.experience
        )
    if experience_text:
        embeddings["experience"] = _embed_with_retry(experience_text, "SEMANTIC_SIMILARITY")
        time.sleep(API_CALL_DELAY_SECONDS)

    education_text = parsed_resume.education_text
    if not education_text and parsed_resume.education:
        education_text = "Education: " + "; ".join(
            f"{edu.get('degree', '')} in {edu.get('field', '')} from {edu.get('institution', '')}"
            for edu in parsed_resume.education
        )
    if education_text:
        embeddings["education"] = _embed_with_retry(education_text, "SEMANTIC_SIMILARITY")
        time.sleep(API_CALL_DELAY_SECONDS)

    return embeddings


def generate_jd_embeddings(parsed_jd) -> dict:
    """
    Generate separate embeddings for each JD section.
    Returns dict: { "skills": [...], "experience": [...], "education": [...] }
    """
    embeddings = {}

    skills_text = parsed_jd.skills_text
    if not skills_text and parsed_jd.required_skills:
        skills_text = "Required skills: " + ", ".join(parsed_jd.required_skills)
    if skills_text:
        embeddings["skills"] = _embed_with_retry(skills_text, "RETRIEVAL_DOCUMENT")
        time.sleep(API_CALL_DELAY_SECONDS)

    experience_text = parsed_jd.experience_text
    if not experience_text:
        experience_text = f"Experience requirements: {parsed_jd.experience_requirements}"
    if experience_text:
        embeddings["experience"] = _embed_with_retry(experience_text, "RETRIEVAL_DOCUMENT")
        time.sleep(API_CALL_DELAY_SECONDS)

    education_text = parsed_jd.education_text
    if not education_text:
        education_text = f"Education requirements: {parsed_jd.education_requirements}"
    if education_text:
        embeddings["education"] = _embed_with_retry(education_text, "RETRIEVAL_DOCUMENT")
        time.sleep(API_CALL_DELAY_SECONDS)

    return embeddings
