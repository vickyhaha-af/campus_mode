import os
from dotenv import load_dotenv

load_dotenv()

# Gemini API Keys (rotating for rate limit management)
GEMINI_API_KEY_1 = os.getenv("GEMINI_API_KEY_1", "")
GEMINI_API_KEY_2 = os.getenv("GEMINI_API_KEY_2", "")

# Models
GEMINI_FLASH_MODEL = "gemini-2.0-flash"
GEMINI_EMBEDDING_MODEL = "text-embedding-004"

# Default scoring weights
DEFAULT_WEIGHTS = {
    "skills": 0.50,
    "experience": 0.30,
    "education": 0.20
}

# File upload limits
MAX_FILE_SIZE_MB = 5
MAX_BATCH_SIZE_MB = 50
MAX_RESUMES_PER_BATCH = 50
ALLOWED_EXTENSIONS = {".pdf", ".docx"}

# Bias audit threshold
BIAS_P_VALUE_THRESHOLD = 0.05

# NIRF-derived institution tier classification
TIER_1_KEYWORDS = [
    "iit", "indian institute of technology", "nit", "national institute of technology",
    "iiit", "iisc", "indian institute of science", "bits", "bits pilani",
    "dtu", "delhi technological university", "nsut", "jadavpur",
    "vit", "manipal institute of technology", "srm institute"
]
TIER_2_KEYWORDS = [
    "anna university", "psg", "coep", "vjti", "mnnit", "rvce",
    "bmsce", "pesit", "mit manipal", "thapar", "amity",
    "lovely professional", "chandigarh university", "chitkara"
]

# Experience cohort boundaries (years)
EXPERIENCE_COHORTS = {
    "fresher": (0, 2),
    "mid_level": (3, 5),
    "senior": (5, 8),
    "lead": (8, 100)
}

# Rate limiting
API_CALL_DELAY_SECONDS = 0.5
MAX_RETRIES = 3
