from pydantic import BaseModel, Field
from typing import Optional


class ParsedResume(BaseModel):
    candidate_name: str = ""
    skills: list[str] = Field(default_factory=list)
    skills_text: str = ""
    experience: list[dict] = Field(default_factory=list)
    experience_text: str = ""
    experience_years: float = 0.0
    education: list[dict] = Field(default_factory=list)
    education_text: str = ""
    certifications: list[str] = Field(default_factory=list)
    institution_tier: str = "tier_3"
    raw_text: str = ""


class ParsedJD(BaseModel):
    title: str = ""
    required_skills: list[str] = Field(default_factory=list)
    skills_text: str = ""
    experience_requirements: str = ""
    experience_text: str = ""
    education_requirements: str = ""
    education_text: str = ""
    nice_to_have: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    raw_text: str = ""


class CandidateScore(BaseModel):
    """Flat score model — aligned with what the React frontend expects."""
    candidate_name: str
    # Flat dimension scores (0-100) — the frontend reads these directly
    skills_score: float = 0.0
    experience_score: float = 0.0
    education_score: float = 0.0
    composite_score: float = 0.0
    # Explanations per dimension
    skills_explanation: str = ""
    experience_explanation: str = ""
    education_explanation: str = ""
    # Skill gap data
    matched_skills: list[str] = Field(default_factory=list)
    partial_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    # Metadata
    normalized_score: Optional[float] = None
    rank: int = 0
    institution_tier: str = "tier_3"
    experience_years: float = 0.0
    experience_cohort: str = "fresher"
    bias_flag: bool = False
    adjusted: bool = False


class BiasTestDetail(BaseModel):
    test_used: str = ""
    p_value: Optional[float] = None
    effect_size: Optional[float] = None
    bias_detected: bool = False
    group_averages: dict = Field(default_factory=dict)
    normalization_applied: bool = False


class BiasAuditResult(BaseModel):
    overall_status: str = "Pass"
    flags_detected: int = 0
    tests_run: int = 0
    details: dict = Field(default_factory=dict)   # category_name -> BiasTestDetail
    normalization_applied: bool = False


class JDQualityReport(BaseModel):
    """Aligned with what JDQualityCard.jsx expects."""
    score: float = 0.0
    has_responsibilities: bool = False
    has_requirements: bool = False
    has_nice_to_haves: bool = False
    has_experience_level: bool = False
    has_education: bool = False
    specificity_analysis: str = ""
    improvement_suggestions: list[str] = Field(default_factory=list)
    estimated_match_rate: str = "moderate"


class WeightsUpdate(BaseModel):
    skills: float = 0.50
    experience: float = 0.30
    education: float = 0.20


class SessionData(BaseModel):
    session_id: str
    jd: Optional[ParsedJD] = None
    jd_quality: Optional[JDQualityReport] = None
    resumes: list[ParsedResume] = Field(default_factory=list)
    scores: list[CandidateScore] = Field(default_factory=list)
    bias_audit: Optional[BiasAuditResult] = None
    weights: WeightsUpdate = Field(default_factory=WeightsUpdate)
    embeddings: dict = Field(default_factory=dict)
    status: str = "created"
    progress: float = 0.0
    is_demo: bool = False
    created_at: str = ""
