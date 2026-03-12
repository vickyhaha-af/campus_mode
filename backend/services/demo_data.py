"""
Synthetic demo data — 15 realistic resumes + 1 JD with pre-computed scores.
"""
from models.schemas import (
    ParsedResume, ParsedJD, CandidateScore,
    BiasAuditResult, JDQualityReport, SessionData, WeightsUpdate
)
from datetime import datetime
import uuid


def _demo_jd():
    return ParsedJD(
        title="Senior Backend Engineer — Fintech Startup (Bengaluru)",
        required_skills=["Python","Django","FastAPI","PostgreSQL","Redis","REST APIs","Microservices","Docker","AWS","CI/CD","System Design","Unit Testing"],
        skills_text="Strong Python backend engineer proficient in Django or FastAPI, REST APIs, microservices, PostgreSQL, Redis, Docker, AWS, CI/CD, and system design.",
        experience_requirements="5+ years backend, 2+ years fintech/startup",
        experience_text="5+ years of backend development, ideally 2+ in fintech or high-scale startup environments.",
        education_requirements="B.Tech/B.E. CS preferred; non-traditional backgrounds considered.",
        education_text="B.Tech/B.E. in Computer Science preferred. Strong non-traditional candidates welcome.",
        nice_to_have=["Kubernetes","Kafka","GraphQL","Terraform","Go","ML basics"],
        responsibilities=["Design scalable backend services (10K+ RPM)","Own payments microservice architecture","Lead code reviews, mentor juniors","Collaborate on sprint planning","Implement monitoring & incident response"],
        raw_text="Senior Backend Engineer — Fintech Startup (Bengaluru)\n5+ years backend, Python/Django/FastAPI, PostgreSQL, Redis, Docker, AWS.\nNice-to-have: Kubernetes, Kafka, GraphQL.\n₹25-40 LPA + ESOPs"
    )


def _demo_resumes():
    data = [
        ("Aditya Sharma","tier_1",7.0,["Python","Django","FastAPI","PostgreSQL","Redis","Docker","AWS","Kubernetes","CI/CD","REST APIs","Microservices","System Design","Kafka","Terraform"],"IIT Bombay","B.Tech","CS","Razorpay → Flipkart → TCS"),
        ("Priya Menon","tier_1",6.5,["Python","Django","Flask","PostgreSQL","MongoDB","Docker","AWS","REST APIs","Microservices","Redis","CI/CD","Celery","Unit Testing","GraphQL"],"NIT Trichy","B.Tech","IT","PhonePe → Freshworks → Zoho"),
        ("Rahul Verma","tier_1",6.5,["Python","FastAPI","PostgreSQL","Redis","Docker","AWS","REST APIs","Microservices","System Design","CI/CD","Go","gRPC","Prometheus"],"BITS Pilani","B.E.","CS","CRED → Walmart Labs → Infosys"),
        ("Sneha Patel","tier_1",5.0,["Python","Django","PostgreSQL","Docker","REST APIs","JavaScript","React","Node.js","MongoDB","Git"],"VIT Vellore","B.Tech","CS","Swiggy → Accenture"),
        ("Vikram Singh","tier_2",5.0,["Java","Spring Boot","Python","PostgreSQL","MySQL","Docker","AWS","REST APIs","Microservices","Kafka","CI/CD"],"Anna University","B.E.","CS","Paytm → Cognizant"),
        ("Ananya Krishnan","tier_2",5.0,["Python","Flask","SQLAlchemy","PostgreSQL","REST APIs","Docker","Git","Linux","Celery","RabbitMQ","Unit Testing"],"PSG College","B.E.","ECE","Dunzo → Wipro → Freelance"),
        ("Deepak Joshi","tier_1",4.5,["Python","Data Analysis","Pandas","NumPy","SQL","ML","Scikit-learn","TensorFlow","Jupyter","Statistics"],"IIT Madras","M.Tech","DS","Tiger Analytics → Mu Sigma"),
        ("Meera Nair","tier_1",4.5,["JavaScript","TypeScript","React","Node.js","Express","MongoDB","REST APIs","GraphQL","Docker","AWS Lambda","Next.js"],"Manipal IT","B.Tech","IT","Myntra → Stealth Startup"),
        ("Arjun Reddy","tier_3",6.0,["Java","Spring Boot","Hibernate","Oracle DB","MySQL","SOAP","REST APIs","Jenkins","Maven"],"JNTU Hyderabad","B.Tech","CS","TCS → HCL"),
        ("Kavya Iyer","tier_2",0.8,["Python","Django","HTML","CSS","JavaScript","MySQL","Git","Linux","REST APIs"],"RVCE Bangalore","B.E.","CS","Zoho (Intern)"),
        ("Rohit Agarwal","tier_1",0.25,["C++","Python","DSA","Algorithms","OOP","SQL","Git"],"IIT Delhi","B.Tech","CS","GSoC contributor"),
        ("Nisha Kumari","tier_3",1.0,["Python","Flask","HTML","CSS","Bootstrap","SQLite","Git"],"Delhi University","B.A.","Literature","Freelance web dev"),
        ("Suresh Kumar","tier_3",8.0,["Salesforce","SAP","CRM","ERP","Business Analysis","SQL","Excel","Power BI","Tableau"],"Symbiosis","MBA","IT Mgmt","Deloitte → Capgemini"),
        ("Fatima Khan","tier_3",5.0,["Digital Marketing","SEO","Google Analytics","Content Strategy","Social Media","HubSpot","WordPress"],"Christ University","BBA","Marketing","Zomato → OYO"),
        ("Ravi Prasad","tier_1",6.0,["Mechanical Design","AutoCAD","SolidWorks","MATLAB","Six Sigma","Quality Control","Manufacturing"],"NIT Warangal","B.Tech","Mech Eng","Tata Motors → L&T"),
    ]
    resumes = []
    for name,tier,yrs,skills,inst,deg,field,exp_summary in data:
        resumes.append(ParsedResume(
            candidate_name=name, skills=skills, skills_text=", ".join(skills),
            experience_text=exp_summary, experience_years=yrs,
            education=[{"institution":inst,"degree":deg,"field":field}],
            education_text=f"{deg} in {field} from {inst}",
            institution_tier=tier,
        ))
    return resumes


def _demo_scores():
    raw = [
        ("Aditya Sharma",88.5,85.2,82.1,86.5,"tier_1",7.0,"lead"),
        ("Priya Menon",84.3,82.7,78.5,82.9,"tier_1",6.5,"senior"),
        ("Rahul Verma",86.1,81.3,79.8,83.6,"tier_1",6.5,"senior"),
        ("Sneha Patel",72.4,68.5,74.2,71.5,"tier_1",5.0,"mid_level"),
        ("Vikram Singh",65.8,70.2,68.1,67.5,"tier_2",5.0,"mid_level"),
        ("Ananya Krishnan",68.2,65.4,55.3,64.8,"tier_2",5.0,"mid_level"),
        ("Deepak Joshi",55.3,48.7,80.5,57.4,"tier_1",4.5,"mid_level"),
        ("Meera Nair",42.1,52.8,72.4,49.8,"tier_1",4.5,"mid_level"),
        ("Arjun Reddy",38.5,58.2,52.1,46.2,"tier_3",6.0,"senior"),
        ("Kavya Iyer",58.2,22.5,65.3,48.1,"tier_2",0.8,"fresher"),
        ("Rohit Agarwal",35.4,12.8,82.1,35.5,"tier_1",0.25,"fresher"),
        ("Nisha Kumari",32.1,18.3,28.5,27.9,"tier_3",1.0,"fresher"),
        ("Suresh Kumar",12.3,25.4,35.2,19.6,"tier_3",8.0,"lead"),
        ("Fatima Khan",8.5,15.2,22.1,13.1,"tier_3",5.0,"mid_level"),
        ("Ravi Prasad",5.2,10.8,45.3,13.9,"tier_1",6.0,"senior"),
    ]
    scores = []
    for name,sk,ex,ed,comp,tier,yrs,cohort in raw:
        if comp > 80:
            m,p,mi = ["Python","Django","FastAPI","PostgreSQL","Redis","Docker","AWS","CI/CD","REST APIs","Microservices"],["System Design"],[]
            sk_exp = f"Excellent skills match ({sk:.0f}%). Direct matches: Python, Django, FastAPI, PostgreSQL, Redis, Docker, AWS."
        elif comp > 60:
            m,p,mi = ["Python","PostgreSQL","Docker","REST APIs"],["Django/Flask","AWS"],["Kubernetes","Kafka","System Design"]
            sk_exp = f"Strong skills match ({sk:.0f}%). Matches: Python, PostgreSQL, Docker. Gaps in advanced infra."
        elif comp > 40:
            m,p,mi = ["Python","SQL"],["REST APIs","Docker"],["Django","FastAPI","Redis","Microservices","CI/CD"]
            sk_exp = f"Partial skills match ({sk:.0f}%). Python foundation but missing key frameworks."
        elif comp > 25:
            m,p,mi = [],["Python basics"],["Django","FastAPI","PostgreSQL","Redis","Docker","AWS","Microservices"]
            sk_exp = f"Limited skills match ({sk:.0f}%). Minimal overlap with backend stack."
        else:
            m,p,mi = [],[],["Python","Django","FastAPI","PostgreSQL","Redis","Docker","AWS","REST APIs"]
            sk_exp = f"Minimal match ({sk:.0f}%). Different domain entirely."

        scores.append(CandidateScore(
            candidate_name=name,
            skills_score=sk, experience_score=ex, education_score=ed, composite_score=comp,
            skills_explanation=sk_exp,
            experience_explanation=f"{'Strong' if ex>70 else 'Moderate' if ex>50 else 'Limited'} experience match ({ex:.0f}%). {yrs:.1f} years.",
            education_explanation=f"{'Strong' if ed>70 else 'Moderate' if ed>50 else 'Partial'} education match ({ed:.0f}%).",
            matched_skills=m, partial_skills=p, missing_skills=mi,
            institution_tier=tier, experience_years=yrs, experience_cohort=cohort,
        ))
    scores.sort(key=lambda x: x.composite_score, reverse=True)
    for i,s in enumerate(scores): s.rank = i + 1
    return scores


def _demo_bias():
    return BiasAuditResult(
        overall_status="Flagged", flags_detected=1, tests_run=2, normalization_applied=True,
        details={
            "institution_tier": {
                "test_used": "Mann-Whitney U", "p_value": 0.0312, "effect_size": 0.8542,
                "bias_detected": True, "normalization_applied": True,
                "group_averages": {"Tier 1": 58.7, "Non-Tier 1": 38.9},
            },
            "experience_cohort": {
                "test_used": "Kruskal-Wallis", "p_value": 0.1847, "effect_size": 0.2134,
                "bias_detected": False, "normalization_applied": False,
                "group_averages": {"Fresher": 37.2, "Mid Level": 49.3, "Senior": 58.2, "Lead": 53.1},
            },
        },
    )


def _demo_jd_quality():
    return JDQualityReport(
        score=85, has_responsibilities=True, has_requirements=True, has_nice_to_haves=True,
        specificity_analysis="The JD is well-structured with clear sections for responsibilities, required skills, nice-to-haves, experience and education. Specificity is moderate — requirements are reasonable without being overly restrictive, which should attract a good candidate pool.",
        improvement_suggestions=["Consider specifying preferred team size","Add Python version requirement (3.10+)","Mention on-call/incident rotation expectations"],
    )


def get_demo_session() -> SessionData:
    return SessionData(
        session_id=f"demo-{uuid.uuid4().hex[:8]}",
        jd=_demo_jd(), jd_quality=_demo_jd_quality(),
        resumes=_demo_resumes(), scores=_demo_scores(),
        bias_audit=_demo_bias(),
        weights=WeightsUpdate(skills=0.50, experience=0.30, education=0.20),
        status="complete", progress=100.0, is_demo=True,
        created_at=datetime.now().isoformat(),
    )
