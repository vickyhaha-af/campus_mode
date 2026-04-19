import os
from dotenv import load_dotenv

load_dotenv()

# Gemini API Keys (rotating for rate limit management)
GEMINI_API_KEY_1 = os.getenv("GEMINI_API_KEY_1", "")
GEMINI_API_KEY_2 = os.getenv("GEMINI_API_KEY_2", "")

# Supabase Auth
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Email Settings
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "mock") # "mock", "smtp", "sendgrid", "ses"
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "hiring@techvista.demo")
FROM_NAME = os.getenv("FROM_NAME", "Tech Vista Hiring Team")

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

# CORS Origins - Production Security
# Default allows local dev; override with env var for production
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:5180,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5180"
).split(",")

# Feature 2 & 3: Advanced Hiring OS Parameters
TALENT_POOL_DECAY_LAMBDA = float(os.getenv("TALENT_POOL_DECAY_LAMBDA", "0.005"))
TALENT_POOL_MIN_SCORE = float(os.getenv("TALENT_POOL_MIN_SCORE", "30.0"))
BOOTSTRAP_ITERATIONS = int(os.getenv("BOOTSTRAP_ITERATIONS", "1000"))
BOOTSTRAP_CHUNKS = int(os.getenv("BOOTSTRAP_CHUNKS", "10"))
