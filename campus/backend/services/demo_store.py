"""
Demo mode data — hand-crafted synthetic college, students, companies, drives.

The demo college has a stable UUID. Any route that filters by college_id can
check is_demo(college_id) to short-circuit Supabase and return these in-memory
records. This lets the whole product (listing, chat, matching) work with zero
setup.

Students are calibrated across branches, CGPAs, and role-fit profiles so the
agent has something real to reason about. Each has rich profile_enriched data
(passions, interests, personality_hints, role_fit_signals).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


# Stable demo UUIDs (well-known so frontend can bookmark demo links).
DEMO_COLLEGE_ID = "d3000000-0000-0000-0000-000000000000"
DEMO_COLLEGE_SLUG = "demo-campus"


def is_demo(college_id: Optional[str]) -> bool:
    return (college_id or "").strip().lower() == DEMO_COLLEGE_ID


# ===========================================================================
# COLLEGE
# ===========================================================================

DEMO_COLLEGE: Dict[str, Any] = {
    "id": DEMO_COLLEGE_ID,
    "name": "Tech Vista Demo College",
    "slug": DEMO_COLLEGE_SLUG,
    "logo_url": None,
    "branches": ["CSE", "ECE", "EE", "ME", "Civil", "IT", "Chem", "MBA"],
    "settings": {"demo": True},
    "created_at": "2026-01-01T00:00:00Z",
}


# ===========================================================================
# COMPANIES
# ===========================================================================

def _cmp(id_suffix: str, name: str, industry: str, tier: str) -> Dict[str, Any]:
    return {
        "id": f"d1000000-0000-0000-0000-0000000000{id_suffix}",
        "college_id": DEMO_COLLEGE_ID,
        "name": name,
        "industry": industry,
        "tier": tier,
        "website": None,
        "added_by": None,
        "first_visit_date": "2026-03-01",
        "created_at": "2026-01-01T00:00:00Z",
    }

DEMO_COMPANIES: List[Dict[str, Any]] = [
    _cmp("01", "Goldman Sachs", "Finance / IB", "tier_1"),
    _cmp("02", "Zomato", "Consumer Tech", "tier_1"),
    _cmp("03", "Microsoft", "Enterprise / Cloud", "tier_1"),
    _cmp("04", "Cred", "Fintech Startup", "tier_2"),
    _cmp("05", "Infosys", "IT Services", "tier_2"),
]


# ===========================================================================
# DRIVES
# ===========================================================================

DEMO_DRIVES: List[Dict[str, Any]] = [
    {
        "id": "d2000000-0000-0000-0000-000000000001",
        "college_id": DEMO_COLLEGE_ID,
        "company_id": DEMO_COMPANIES[0]["id"],  # Goldman
        "role": "Quantitative Analyst",
        "jd_text": (
            "Quantitative Analyst — Mumbai / Bengaluru. 3-year analyst rotation. "
            "Looking for rigorous mathematical thinkers comfortable with Python, "
            "statistics, time-series analysis, and C++. Finance background not required "
            "but quantitative curiosity is. Top-tier CGPA expected."
        ),
        "jd_parsed": {},
        "ctc_offered": 2400000,
        "location": "Mumbai",
        "job_type": "full_time",
        "eligibility_rules": {
            "min_cgpa": 8.5,
            "max_active_backlogs": 0,
            "allowed_branches": ["CSE", "ECE", "EE", "MBA"],
            "allowed_years": [2026],
        },
        "status": "upcoming",
        "scheduled_date": "2026-05-12",
        "created_by": None,
        "created_at": "2026-04-10T10:00:00Z",
        "updated_at": "2026-04-10T10:00:00Z",
    },
    {
        "id": "d2000000-0000-0000-0000-000000000002",
        "college_id": DEMO_COLLEGE_ID,
        "company_id": DEMO_COMPANIES[1]["id"],  # Zomato
        "role": "Backend Engineer",
        "jd_text": (
            "Backend Engineer — Gurgaon. Build APIs that serve 100M+ orders/month. "
            "Must-have: Python or Go, PostgreSQL, REST API design, distributed systems "
            "fundamentals. Good-to-have: Kafka, Redis, microservices experience. "
            "Looking for builders, not theorists."
        ),
        "jd_parsed": {},
        "ctc_offered": 1800000,
        "location": "Gurgaon",
        "job_type": "full_time",
        "eligibility_rules": {
            "min_cgpa": 7.0,
            "max_active_backlogs": 0,
            "allowed_branches": ["CSE", "IT", "ECE"],
            "allowed_years": [2026],
        },
        "status": "upcoming",
        "scheduled_date": "2026-05-18",
        "created_by": None,
        "created_at": "2026-04-11T10:00:00Z",
        "updated_at": "2026-04-11T10:00:00Z",
    },
    {
        "id": "d2000000-0000-0000-0000-000000000003",
        "college_id": DEMO_COLLEGE_ID,
        "company_id": DEMO_COMPANIES[2]["id"],  # Microsoft
        "role": "ML Engineer",
        "jd_text": (
            "Machine Learning Engineer — Bengaluru (Hyderabad alt). "
            "Work on production ML systems for Azure. Python, PyTorch or TensorFlow, "
            "strong linear algebra, ML research literacy (can read & implement recent papers). "
            "Research experience / published work is a strong plus."
        ),
        "jd_parsed": {},
        "ctc_offered": 2200000,
        "location": "Bengaluru",
        "job_type": "full_time",
        "eligibility_rules": {
            "min_cgpa": 8.0,
            "max_active_backlogs": 0,
            "allowed_branches": ["CSE", "ECE", "IT"],
            "allowed_years": [2026],
        },
        "status": "upcoming",
        "scheduled_date": "2026-05-25",
        "created_by": None,
        "created_at": "2026-04-12T10:00:00Z",
        "updated_at": "2026-04-12T10:00:00Z",
    },
    {
        "id": "d2000000-0000-0000-0000-000000000004",
        "college_id": DEMO_COLLEGE_ID,
        "company_id": DEMO_COMPANIES[3]["id"],  # Cred
        "role": "Product Associate",
        "jd_text": (
            "Product Associate — Bengaluru. Own a 0→1 product surface end-to-end. "
            "We're looking for strong communicators who've shipped something real "
            "(side projects, internships, campus products). Technical fluency expected "
            "but coding day-to-day is not required. Hustle energy matters."
        ),
        "jd_parsed": {},
        "ctc_offered": 2000000,
        "location": "Bengaluru",
        "job_type": "full_time",
        "eligibility_rules": {
            "min_cgpa": 7.5,
            "max_active_backlogs": 0,
            "allowed_branches": ["CSE", "ECE", "ME", "MBA"],
            "allowed_years": [2026],
        },
        "status": "upcoming",
        "scheduled_date": "2026-06-01",
        "created_by": None,
        "created_at": "2026-04-13T10:00:00Z",
        "updated_at": "2026-04-13T10:00:00Z",
    },
]


# ===========================================================================
# STUDENTS
# ===========================================================================

def _stu(
    id_suffix: str, name: str, email: str, branch: str, year: int, cgpa: float,
    backlogs_active: int, gender: str, current_city: str,
    skills: List[str], passions: List[str], interests: List[str],
    personality: Dict[str, float], role_fit: Dict[str, float],
    achievements: List[str], projects: List[Dict[str, Any]], internships: List[Dict[str, Any]],
    achievement_weight: float, summary: str,
    placed_status: str = "unplaced",
) -> Dict[str, Any]:
    return {
        "id": f"d4000000-0000-0000-0000-000000000{id_suffix}",
        "college_id": DEMO_COLLEGE_ID,
        "user_id": None,
        "name": name,
        "email": email,
        "roll_no": f"{branch[:2].upper()}{2026 - year + 22}{id_suffix}",
        "branch": branch,
        "year": year,
        "cgpa": cgpa,
        "backlogs_active": backlogs_active,
        "backlogs_cleared": 0,
        "gender": gender,
        "date_of_birth": None,
        "hometown": None,
        "current_city": current_city,
        "phone": None,
        "placed_status": placed_status,
        "placed_drive_id": None,
        "consent_given": True,
        "consent_timestamp": "2026-01-01T00:00:00Z",
        "resume_text": None,
        "profile_enriched": {
            "skills": skills,
            "projects": projects,
            "internships": internships,
            "passions": passions,
            "interests": interests,
            "achievements": achievements,
            "certifications": [],
            "role_fit_signals": role_fit,
            "domain_preferences": [],
            "personality_hints": personality,
            "achievement_weight": achievement_weight,
            "summary": summary,
        },
        "preferences": {
            "desired_roles": [],
            "desired_locations": [],
            "desired_company_types": [],
            "willingness_to_relocate": True,
            "work_mode": None,
        },
        "registered_at": "2026-01-15T00:00:00Z",
        "updated_at": "2026-04-01T00:00:00Z",
    }


DEMO_STUDENTS: List[Dict[str, Any]] = [
    _stu("01", "Aarav Mehta", "aarav.mehta@demo.edu", "CSE", 2026, 9.3, 0, "male", "Bengaluru",
         ["Python", "PyTorch", "TensorFlow", "Linear Algebra", "Transformers", "CUDA"],
         ["ML research", "open-source", "mathematical rigor"],
         ["competitive coding", "chess"],
         {"leadership": 0.5, "collaboration": 0.6, "initiative": 0.9, "communication": 0.7, "analytical_depth": 0.95, "notes": "Research-oriented, deep rather than broad."},
         {"software_engineering": 0.7, "data_science_ml": 0.95, "product_management": 0.3, "consulting": 0.4, "finance": 0.5, "design": 0.2, "research": 0.9, "operations": 0.3, "marketing_sales": 0.2},
         ["NeurIPS workshop paper 2025", "Google Summer of Code — PyTorch"],
         [{"name": "Attention-efficient transformer for low-resource languages", "description": "Reduced inference cost 4x on Indic NLP benchmarks", "tech": ["PyTorch", "CUDA"], "impact": "Cited in 2 papers"}],
         [{"company": "Microsoft Research India", "role": "ML Research Intern", "duration": "May–Jul 2025", "description": "Worked on sparse attention mechanisms"}],
         0.9,
         "Strong ML researcher with solid mathematical foundations and a GSoC-level open-source track record. Built sparse attention systems at MSR India."),

    _stu("02", "Zara Khan", "zara.khan@demo.edu", "CSE", 2026, 8.7, 0, "female", "Gurgaon",
         ["Go", "Python", "PostgreSQL", "Redis", "Kafka", "Docker", "gRPC"],
         ["distributed systems", "reliability engineering", "devtools"],
         ["long-distance running", "cooking"],
         {"leadership": 0.7, "collaboration": 0.85, "initiative": 0.75, "communication": 0.8, "analytical_depth": 0.7, "notes": "Strong collaborator — led infra team in campus fest."},
         {"software_engineering": 0.95, "data_science_ml": 0.4, "product_management": 0.5, "consulting": 0.35, "finance": 0.3, "design": 0.3, "research": 0.3, "operations": 0.5, "marketing_sales": 0.2},
         ["Won HackerEarth inter-college SRE challenge", "Built campus scheduler serving 6K students"],
         [{"name": "Campus scheduler service", "description": "Go microservice handling 500 QPS during registration window", "tech": ["Go", "Redis", "Postgres"], "impact": "Zero downtime over 3 semesters"}],
         [{"company": "Razorpay", "role": "Backend Engineer Intern", "duration": "May–Jul 2025", "description": "Built payment retry workflow"}],
         0.85,
         "Hands-on backend engineer with production-grade Go + Postgres experience from Razorpay. Built and operated real systems at campus scale."),

    _stu("03", "Rohan Gupta", "rohan.gupta@demo.edu", "ECE", 2026, 9.6, 0, "male", "Delhi",
         ["Python", "C++", "Probability", "Statistics", "Time-series", "QuantLib", "Pandas"],
         ["probability theory", "market microstructure", "mathematical puzzles"],
         ["debate", "poker"],
         {"leadership": 0.6, "collaboration": 0.7, "initiative": 0.85, "communication": 0.85, "analytical_depth": 0.95, "notes": "Elite quant thinker, articulate under pressure."},
         {"software_engineering": 0.6, "data_science_ml": 0.7, "product_management": 0.4, "consulting": 0.75, "finance": 0.95, "design": 0.1, "research": 0.75, "operations": 0.4, "marketing_sales": 0.3},
         ["KVPY fellowship", "Winner — IIMC Trading Simulation", "All India Rank 247 JEE Advanced"],
         [{"name": "Options volatility surface modeling", "description": "Implemented SABR model calibration on NSE options data", "tech": ["Python", "QuantLib"], "impact": "Published on GitHub, 400 stars"}],
         [{"company": "JP Morgan QR Intern", "role": "Quant Research", "duration": "May–Jul 2025", "description": "Built stat-arb signals for Indian equities"}],
         0.92,
         "Exceptional quantitative analyst — KVPY fellow with JPMC quant internship. Ideal finance/IB candidate."),

    _stu("04", "Priya Ramaswamy", "priya.r@demo.edu", "CSE", 2026, 8.2, 0, "female", "Bengaluru",
         ["React", "TypeScript", "Node.js", "Figma", "Product analytics"],
         ["consumer products", "design systems", "indie hacking"],
         ["stand-up comedy", "travel photography"],
         {"leadership": 0.85, "collaboration": 0.85, "initiative": 0.95, "communication": 0.95, "analytical_depth": 0.65, "notes": "Natural communicator who ships. Runs a student-founded side project."},
         {"software_engineering": 0.7, "data_science_ml": 0.35, "product_management": 0.95, "consulting": 0.65, "finance": 0.3, "design": 0.7, "research": 0.25, "operations": 0.6, "marketing_sales": 0.7},
         ["Founded campus fashion resale app — 2K MAU", "TEDxCampus speaker"],
         [{"name": "Ghoom — campus fashion resale", "description": "iOS + web, revenue positive", "tech": ["React Native", "Firebase"], "impact": "2000 MAU, $4K GMV/month"}],
         [{"company": "Razorpay", "role": "APM Intern", "duration": "Dec 2024–Jan 2025", "description": "Owned onboarding flow redesign"}],
         0.88,
         "Student founder + APM at Razorpay. Built a profitable campus product. Ideal product-track candidate with builder energy."),

    _stu("05", "Arnav Singh", "arnav.singh@demo.edu", "CSE", 2026, 7.1, 0, "male", "Mumbai",
         ["JavaScript", "React", "CSS", "Tailwind"],
         ["web development", "UI animation"],
         ["football", "anime"],
         {"leadership": 0.3, "collaboration": 0.6, "initiative": 0.5, "communication": 0.55, "analytical_depth": 0.4, "notes": "Solid builder, less ambitious scope."},
         {"software_engineering": 0.75, "data_science_ml": 0.2, "product_management": 0.4, "consulting": 0.3, "finance": 0.2, "design": 0.55, "research": 0.15, "operations": 0.3, "marketing_sales": 0.25},
         ["Top 50 in campus hackathon"],
         [{"name": "Class notes sharing portal", "description": "React + Supabase", "tech": ["React", "Supabase"], "impact": "Used by ~200 students"}],
         [],
         0.45,
         "Comfortable full-stack builder with front-end strengths. Good baseline candidate for generalist engineering drives."),

    _stu("06", "Ishaan Patel", "ishaan.p@demo.edu", "ECE", 2026, 8.9, 0, "male", "Pune",
         ["Python", "PyTorch", "Computer Vision", "OpenCV", "FPGA"],
         ["edge ML", "robotics", "hardware-software co-design"],
         ["drone building", "electronic music"],
         {"leadership": 0.55, "collaboration": 0.7, "initiative": 0.85, "communication": 0.65, "analytical_depth": 0.85, "notes": "Hands-on tinkerer — builds things end-to-end."},
         {"software_engineering": 0.7, "data_science_ml": 0.85, "product_management": 0.4, "consulting": 0.3, "finance": 0.25, "design": 0.4, "research": 0.7, "operations": 0.4, "marketing_sales": 0.15},
         ["IEEE student paper — autonomous drone obstacle avoidance"],
         [{"name": "Autonomous delivery drone", "description": "Real-time obstacle avoidance on Jetson Nano", "tech": ["PyTorch", "ROS", "OpenCV"], "impact": "Live-demo at IIT Madras Shaastra"}],
         [{"company": "Qualcomm", "role": "DSP Intern", "duration": "May–Jul 2025", "description": "Worked on Hexagon DSP ML kernels"}],
         0.75,
         "Strong edge-ML/robotics profile with Qualcomm DSP experience. Bridges ECE and ML worlds."),

    _stu("07", "Ananya Das", "ananya.das@demo.edu", "MBA", 2026, 8.6, 0, "female", "Kolkata",
         ["Excel", "SQL", "Tableau", "Financial modeling", "Consulting frameworks"],
         ["retail strategy", "consumer behavior", "emerging markets"],
         ["Bharatanatyam", "food blogging"],
         {"leadership": 0.9, "collaboration": 0.8, "initiative": 0.8, "communication": 0.9, "analytical_depth": 0.75, "notes": "Polished MBA profile, strong case-interview performer."},
         {"software_engineering": 0.15, "data_science_ml": 0.35, "product_management": 0.75, "consulting": 0.9, "finance": 0.75, "design": 0.3, "research": 0.4, "operations": 0.65, "marketing_sales": 0.85},
         ["BCG Focus case competition — finalist", "Class representative 2 years"],
         [{"name": "Retail pricing study — Tier-2 India", "description": "Capstone analysis for McKinsey mentor", "tech": ["Tableau", "Excel"], "impact": "Adopted by local retailer"}],
         [{"company": "BCG", "role": "Summer Associate", "duration": "Apr–Jun 2025", "description": "Retail transformation project"}],
         0.85,
         "Top-tier MBA profile with BCG summer internship. Ideal for consulting and strategic product roles."),

    _stu("08", "Karan Nair", "karan.nair@demo.edu", "CSE", 2026, 6.8, 2, "male", "Kochi",
         ["Java", "Spring Boot", "MySQL"],
         ["enterprise software"],
         ["cricket", "Malayalam cinema"],
         {"leadership": 0.25, "collaboration": 0.5, "initiative": 0.3, "communication": 0.45, "analytical_depth": 0.35, "notes": "Struggled with foundational courses."},
         {"software_engineering": 0.5, "data_science_ml": 0.15, "product_management": 0.25, "consulting": 0.2, "finance": 0.2, "design": 0.15, "research": 0.1, "operations": 0.4, "marketing_sales": 0.3},
         [],
         [{"name": "Library management system", "description": "Spring Boot REST API", "tech": ["Java", "Spring", "MySQL"], "impact": "—"}],
         [],
         0.25,
         "Baseline CSE candidate with 2 active backlogs. Will need to clear them before most premium drives."),

    _stu("09", "Sneha Reddy", "sneha.reddy@demo.edu", "CSE", 2026, 9.1, 0, "female", "Hyderabad",
         ["Python", "scikit-learn", "PyTorch", "SQL", "Causal inference", "A/B testing"],
         ["causal inference", "experimentation", "applied ML at scale"],
         ["Kuchipudi dance", "poetry"],
         {"leadership": 0.75, "collaboration": 0.8, "initiative": 0.85, "communication": 0.85, "analytical_depth": 0.9, "notes": "Rigorous yet communicative — rare combo."},
         {"software_engineering": 0.65, "data_science_ml": 0.9, "product_management": 0.65, "consulting": 0.55, "finance": 0.4, "design": 0.25, "research": 0.75, "operations": 0.55, "marketing_sales": 0.3},
         ["Kaggle Expert", "Won Flipkart GRiD data challenge"],
         [{"name": "Recommender churn prediction", "description": "XGBoost + uplift modeling", "tech": ["Python", "scikit-learn"], "impact": "Would save Flipkart ₹40L/yr in simulation"}],
         [{"company": "Flipkart", "role": "Data Scientist Intern", "duration": "May–Jul 2025", "description": "Uplift modeling for churn"}],
         0.87,
         "Well-rounded applied ML candidate with Flipkart internship. Strong for both ML engineering and data-science-PM crossover roles."),

    _stu("10", "Vihaan Iyer", "vihaan.iyer@demo.edu", "CSE", 2026, 8.4, 0, "male", "Chennai",
         ["Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes", "Terraform"],
         ["platform engineering", "reliability", "open-source"],
         ["tennis", "sci-fi reading"],
         {"leadership": 0.5, "collaboration": 0.75, "initiative": 0.8, "communication": 0.7, "analytical_depth": 0.75, "notes": "Engineering-first — quietly productive."},
         {"software_engineering": 0.9, "data_science_ml": 0.45, "product_management": 0.35, "consulting": 0.25, "finance": 0.3, "design": 0.2, "research": 0.3, "operations": 0.6, "marketing_sales": 0.15},
         ["Maintainer of a 3K-star Python utility lib"],
         [{"name": "Campus internship portal", "description": "FastAPI + Postgres, 1500 users", "tech": ["FastAPI", "PostgreSQL"], "impact": "Adopted by Placement Cell"}],
         [{"company": "Atlassian", "role": "Platform Intern", "duration": "May–Jul 2025", "description": "Terraform modules for Jira infra"}],
         0.78,
         "Strong platform engineer with Atlassian internship and a popular open-source lib. Excellent for backend/SRE drives."),

    _stu("11", "Diya Shah", "diya.shah@demo.edu", "ECE", 2026, 8.1, 0, "female", "Ahmedabad",
         ["Verilog", "SystemVerilog", "C", "Linux", "Signal processing"],
         ["chip design", "low-level systems"],
         ["classical Hindustani vocals", "origami"],
         {"leadership": 0.4, "collaboration": 0.65, "initiative": 0.7, "communication": 0.55, "analytical_depth": 0.85, "notes": "Deep technical focus, less extroverted."},
         {"software_engineering": 0.6, "data_science_ml": 0.4, "product_management": 0.25, "consulting": 0.25, "finance": 0.3, "design": 0.35, "research": 0.75, "operations": 0.35, "marketing_sales": 0.15},
         ["Samsung chip design hackathon — runner-up"],
         [{"name": "RISC-V core implementation", "description": "5-stage pipeline in Verilog", "tech": ["Verilog", "FPGA"], "impact": "—"}],
         [{"company": "Samsung SRI-Bangalore", "role": "VLSI Intern", "duration": "May–Jul 2025", "description": "Memory controller verification"}],
         0.7,
         "Strong ECE / chip-design profile. Less fit for pure software roles, excellent for Samsung/Intel/Qualcomm drives."),

    _stu("12", "Yash Thakur", "yash.thakur@demo.edu", "ME", 2026, 7.6, 0, "male", "Indore",
         ["Python", "SolidWorks", "MATLAB", "Excel", "Product thinking"],
         ["hardware products", "sustainability", "EV startups"],
         ["cycling", "DIY electronics"],
         {"leadership": 0.65, "collaboration": 0.7, "initiative": 0.8, "communication": 0.75, "analytical_depth": 0.6, "notes": "Product-minded engineer who pivots fast."},
         {"software_engineering": 0.4, "data_science_ml": 0.3, "product_management": 0.75, "consulting": 0.55, "finance": 0.35, "design": 0.5, "research": 0.3, "operations": 0.65, "marketing_sales": 0.4},
         ["SAE Baja team lead", "Interned at Ather Energy"],
         [{"name": "Electric skateboard — full build", "description": "From BLDC motor selection to firmware", "tech": ["SolidWorks", "Arduino"], "impact": "DIY portfolio piece"}],
         [{"company": "Ather Energy", "role": "Product Intern", "duration": "May–Jul 2025", "description": "Battery pack QA processes"}],
         0.65,
         "Hardware-to-product bridge candidate. Strong for EV/consumer hardware startup roles, atypical for pure IT drives."),

    _stu("13", "Meera Kapoor", "meera.kapoor@demo.edu", "CSE", 2026, 9.8, 0, "female", "Delhi",
         ["Python", "Rust", "C++", "Complexity theory", "Algorithms", "Number theory"],
         ["algorithms", "theoretical CS", "competitive programming"],
         ["piano", "Arabic calligraphy"],
         {"leadership": 0.55, "collaboration": 0.6, "initiative": 0.9, "communication": 0.75, "analytical_depth": 0.98, "notes": "IOI medalist-level algorithmic talent."},
         {"software_engineering": 0.85, "data_science_ml": 0.7, "product_management": 0.4, "consulting": 0.55, "finance": 0.85, "design": 0.2, "research": 0.9, "operations": 0.4, "marketing_sales": 0.2},
         ["ICPC World Finalist 2025", "IMO bronze medal"],
         [{"name": "SAT-solver in Rust", "description": "Competitive with MiniSAT on SATcomp", "tech": ["Rust", "CMake"], "impact": "Final-year thesis"}],
         [{"company": "Two Sigma", "role": "Quant Dev Intern", "duration": "May–Jul 2025", "description": "Low-latency C++ systems"}],
         0.96,
         "Elite algorithmic candidate — ICPC World Finalist with Two Sigma quant internship. Top-tier for both finance and systems roles."),

    _stu("14", "Vikram Joshi", "vikram.joshi@demo.edu", "CSE", 2026, 8.0, 0, "male", "Bengaluru",
         ["Python", "Django", "PostgreSQL", "React", "Figma"],
         ["indie hacking", "developer tools"],
         ["mountaineering", "journaling"],
         {"leadership": 0.65, "collaboration": 0.75, "initiative": 0.9, "communication": 0.85, "analytical_depth": 0.6, "notes": "Entrepreneurial — already ships stuff that makes money."},
         {"software_engineering": 0.75, "data_science_ml": 0.3, "product_management": 0.9, "consulting": 0.55, "finance": 0.35, "design": 0.55, "research": 0.2, "operations": 0.5, "marketing_sales": 0.65},
         ["Generated $8K revenue from indie SaaS in college"],
         [{"name": "Quicknotes.so — quick markdown notes app", "description": "Indie SaaS, 300 paying users", "tech": ["Django", "Stripe", "React"], "impact": "$8K ARR"}],
         [],
         0.78,
         "Indie maker with a profitable SaaS while in college. Ideal for PM/founder-track roles and early-stage startups."),

    _stu("15", "Nidhi Agarwal", "nidhi.a@demo.edu", "CSE", 2026, 7.9, 0, "female", "Jaipur",
         ["Python", "SQL", "Power BI", "Statistics", "Marketing analytics"],
         ["marketing analytics", "growth"],
         ["makeup", "travel vlogging"],
         {"leadership": 0.6, "collaboration": 0.8, "initiative": 0.7, "communication": 0.85, "analytical_depth": 0.6, "notes": "People-person with numbers instinct."},
         {"software_engineering": 0.3, "data_science_ml": 0.5, "product_management": 0.6, "consulting": 0.6, "finance": 0.3, "design": 0.45, "research": 0.2, "operations": 0.55, "marketing_sales": 0.8},
         ["Built 40K-follower Instagram travel page"],
         [{"name": "Fashion brand A/B testing framework", "description": "Final-year project", "tech": ["Python", "Power BI"], "impact": "—"}],
         [{"company": "Nykaa", "role": "Marketing Analyst Intern", "duration": "May–Jul 2025", "description": "Campaign performance analytics"}],
         0.6,
         "Marketing/growth analyst profile. Better fit for D2C brand, consumer startups, marketing analytics roles than pure engineering."),

    _stu("16", "Advait Mukherjee", "advait.m@demo.edu", "EE", 2026, 8.3, 0, "male", "Kolkata",
         ["Python", "MATLAB", "Power systems", "Control theory", "Renewable energy"],
         ["grid modernization", "renewables"],
         ["classical Rabindra Sangeet", "film making"],
         {"leadership": 0.5, "collaboration": 0.7, "initiative": 0.7, "communication": 0.65, "analytical_depth": 0.8, "notes": "Technically solid, slightly reserved."},
         {"software_engineering": 0.4, "data_science_ml": 0.5, "product_management": 0.3, "consulting": 0.4, "finance": 0.3, "design": 0.2, "research": 0.65, "operations": 0.5, "marketing_sales": 0.15},
         [],
         [{"name": "Solar microgrid simulation", "description": "MATLAB/Simulink", "tech": ["MATLAB"], "impact": "Published in IEEE SB conf"}],
         [{"company": "Tata Power DDL", "role": "EE Intern", "duration": "May–Jul 2025", "description": "Grid load analysis"}],
         0.55,
         "Power systems EE candidate. Best for utility/renewables/core-EE drives. Not a typical tech-product match."),

    _stu("17", "Aditi Desai", "aditi.d@demo.edu", "IT", 2026, 8.5, 0, "female", "Surat",
         ["Python", "Django", "React", "AWS", "Docker"],
         ["accessible software", "civic tech"],
         ["creative writing", "Marathi theatre"],
         {"leadership": 0.75, "collaboration": 0.9, "initiative": 0.8, "communication": 0.9, "analytical_depth": 0.65, "notes": "Mission-driven team player."},
         {"software_engineering": 0.75, "data_science_ml": 0.4, "product_management": 0.7, "consulting": 0.5, "finance": 0.25, "design": 0.55, "research": 0.25, "operations": 0.5, "marketing_sales": 0.35},
         ["Hackathon win — civic tech category"],
         [{"name": "Voter helpline platform", "description": "Multilingual FAQs for state elections", "tech": ["Django", "React"], "impact": "20K users"}],
         [{"company": "Swiggy", "role": "SDE Intern", "duration": "May–Jul 2025", "description": "Restaurant onboarding APIs"}],
         0.72,
         "Full-stack SDE with Swiggy internship + civic-tech portfolio. Good for backend and PM-adjacent roles."),

    _stu("18", "Kabir Chopra", "kabir.chopra@demo.edu", "MBA", 2026, 7.8, 0, "male", "Chandigarh",
         ["Excel", "Financial modeling", "SQL", "Salesforce"],
         ["investment banking", "M&A", "macroeconomics"],
         ["golf", "historical non-fiction"],
         {"leadership": 0.7, "collaboration": 0.7, "initiative": 0.75, "communication": 0.85, "analytical_depth": 0.7, "notes": "Classic banker profile — disciplined and polished."},
         {"software_engineering": 0.1, "data_science_ml": 0.3, "product_management": 0.55, "consulting": 0.75, "finance": 0.9, "design": 0.15, "research": 0.3, "operations": 0.5, "marketing_sales": 0.55},
         ["CFA L1 passed", "Campus Finance Club president"],
         [{"name": "Valuation case study — Zomato IPO", "description": "DCF + comps", "tech": ["Excel"], "impact": "—"}],
         [{"company": "Deutsche Bank", "role": "IB Summer Analyst", "duration": "Apr–Jun 2025", "description": "Pitch deck support for M&A team"}],
         0.78,
         "Classic IB/finance profile with Deutsche Bank summer. Strong for Goldman, JPM, banking drives — weak for tech roles."),

    _stu("19", "Tanvi Banerjee", "tanvi.b@demo.edu", "CSE", 2026, 8.8, 0, "female", "Bengaluru",
         ["Python", "PyTorch", "NLP", "Hugging Face", "Distributed training"],
         ["LLMs", "interpretability", "AI safety"],
         ["Carnatic music", "illustration"],
         {"leadership": 0.55, "collaboration": 0.7, "initiative": 0.9, "communication": 0.8, "analytical_depth": 0.9, "notes": "LLM-era native — reads papers weekly."},
         {"software_engineering": 0.7, "data_science_ml": 0.9, "product_management": 0.4, "consulting": 0.3, "finance": 0.3, "design": 0.3, "research": 0.85, "operations": 0.3, "marketing_sales": 0.2},
         ["First-author paper at EMNLP 2025 workshop"],
         [{"name": "Indic-LLaMA fine-tune", "description": "Instruction-tuned 7B on Indic QA", "tech": ["PyTorch", "Hugging Face"], "impact": "Open-sourced, 2K downloads"}],
         [{"company": "Sarvam AI", "role": "ML Intern", "duration": "May–Jul 2025", "description": "Indic LLM evaluation"}],
         0.83,
         "Modern LLM/NLP profile with Sarvam AI internship and a published paper. Strong ML and research fit."),

    _stu("20", "Harsh Verma", "harsh.verma@demo.edu", "CSE", 2026, 6.5, 3, "male", "Lucknow",
         ["C", "Python basics"],
         [],
         ["cricket"],
         {"leadership": 0.2, "collaboration": 0.4, "initiative": 0.25, "communication": 0.4, "analytical_depth": 0.3, "notes": "Struggling — 3 active backlogs."},
         {"software_engineering": 0.35, "data_science_ml": 0.1, "product_management": 0.15, "consulting": 0.15, "finance": 0.15, "design": 0.1, "research": 0.1, "operations": 0.25, "marketing_sales": 0.2},
         [],
         [],
         [],
         0.2,
         "Needs significant remediation. 3 active backlogs — ineligible for most tier-1 drives until cleared.",
         placed_status="unplaced"),
]


def demo_bundle() -> Dict[str, Any]:
    """Return the full demo payload for the frontend to stash."""
    return {
        "college": DEMO_COLLEGE,
        "companies": DEMO_COMPANIES,
        "drives": DEMO_DRIVES,
        "students": DEMO_STUDENTS,
    }


# ===========================================================================
# LOOKUPS (used by tools / routes when is_demo(college_id))
# ===========================================================================

def demo_students_filter(
    branch: Optional[str] = None,
    year: Optional[int] = None,
    placed_status: Optional[str] = None,
    min_cgpa: Optional[float] = None,
    max_active_backlogs: Optional[int] = None,
    gender: Optional[str] = None,
    current_city: Optional[str] = None,
) -> List[Dict[str, Any]]:
    out = []
    for s in DEMO_STUDENTS:
        if branch and (s.get("branch") or "").lower() != branch.lower(): continue
        if year is not None and s.get("year") != year: continue
        if placed_status and s.get("placed_status") != placed_status: continue
        if min_cgpa is not None and (s.get("cgpa") or 0) < min_cgpa: continue
        if max_active_backlogs is not None and (s.get("backlogs_active") or 0) > max_active_backlogs: continue
        if gender and (s.get("gender") or "").lower() != gender.lower(): continue
        if current_city and (s.get("current_city") or "").lower() != current_city.lower(): continue
        out.append(s)
    return out


def demo_drive_by_id(drive_id: str) -> Optional[Dict[str, Any]]:
    for d in DEMO_DRIVES:
        if d["id"] == drive_id:
            return d
    return None


def demo_student_by_id(student_id: str) -> Optional[Dict[str, Any]]:
    for s in DEMO_STUDENTS:
        if s["id"] == student_id:
            return s
    return None
