# Tech Vista — Bias-Aware AI Resume Screening

> Built by **M S Vikram** · Gemini Flash + Embedding API · DPDPA 2023 Compliant

---

## What It Does

Tech Vista replaces manual resume shortlisting with a semantic AI pipeline that scores candidates across three dimensions **and automatically audits results for statistical bias** before the shortlist reaches a hiring manager.

| Feature | Detail |
|---|---|
| **Semantic Scoring** | Gemini `text-embedding-004` embeds JD and resumes, cosine similarity ranks candidates by meaning — not keywords |
| **Bias Audit** | Mann-Whitney U (institution tier) + Kruskal-Wallis (experience cohort) tests. Scores normalised if bias detected |
| **Skill Gap Analysis** | Per-candidate matched / adjacent / missing skills breakdown |
| **JD Quality Score** | Scores the job description 0–100 with improvement suggestions |
| **HR-in-the-Loop** | Adjust Skills / Experience / Education weights, recalculate without re-processing |
| **Exports** | PDF report + CSV, strips raw resume text (DPDPA data minimisation) |

---

## Quick Start

### Prerequisites
- Python 3.11+ with `venv`
- Node.js 18+
- Gemini API keys (get free keys at [aistudio.google.com](https://aistudio.google.com))

### 1 — Set API keys

```bash
# backend/.env
GEMINI_API_KEY_1=your_key_here   # used for parsing + JD analysis
GEMINI_API_KEY_2=your_key_here   # used for embeddings
```

### 2 — Install dependencies

```bash
# Backend
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 3 — Start both servers (one command)

```bash
./start.sh
```

Or manually:

```bash
# Terminal 1 — Backend
cd backend && ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev -- --host
```

**Open:** `http://localhost:5173`  
**API Docs:** `http://localhost:8000/docs`

---

## Project Structure

```
TECHVISTA/
├── backend/
│   ├── main.py               # FastAPI routes + pipeline orchestration
│   ├── config.py             # API keys, defaults
│   ├── models/schemas.py     # Pydantic data models
│   └── services/
│       ├── parser.py         # Gemini Flash — resume + JD parsing
│       ├── embedder.py       # Gemini Embedding API — vector generation
│       ├── scorer.py         # Cosine similarity + weighted composite
│       ├── bias_audit.py     # Mann-Whitney U + Kruskal-Wallis tests
│       ├── jd_analyzer.py    # JD quality analysis
│       ├── exporter.py       # PDF (ReportLab) + CSV export
│       ├── demo_data.py      # 15 synthetic demo candidates
│       └── session_store.py  # File-based session persistence (24hr)
│
├── frontend/src/
│   ├── pages/
│   │   ├── LandingPage.jsx   # Hero + features + CTA
│   │   ├── UploadPage.jsx    # JD input + resume batch upload
│   │   ├── ProcessingPage.jsx# Live log + progress ring
│   │   ├── ResultsPage.jsx   # Full results dashboard
│   │   └── ExportPage.jsx    # PDF/CSV export
│   └── components/
│       ├── Navbar.jsx        # Stepper + live API health + dark mode
│       ├── DemoTour.jsx      # 8-step guided onboarding tour
│       ├── CandidateComparison.jsx  # Radar chart comparison modal
│       ├── SkillGapCard.jsx
│       ├── JDQualityCard.jsx
│       ├── ShortcutsModal.jsx
│       └── Toast.jsx         # Notification system
│
└── start.sh                  # One-command launcher
```

---

## Keyboard Shortcuts (Results Page)

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate candidates |
| `E` | Go to Export |
| `C` | Open Compare modal |
| `T` | Toggle dark mode |
| `?` | Show shortcuts |
| `Esc` | Close modals |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **AI / ML** | Gemini Flash 2.0 (parsing), `text-embedding-004` (vectors) |
| **Backend** | FastAPI, Pydantic v2, Uvicorn |
| **File parsing** | PyMuPDF (PDF), python-docx (DOCX) |
| **Statistics** | SciPy (Mann-Whitney U, Kruskal-Wallis), scikit-learn (cosine similarity) |
| **Export** | ReportLab (PDF), Python csv |
| **Frontend** | Vite + React 19, Framer Motion, Recharts |
| **Design** | Custom design system (Playfair Display + DM Sans + DM Mono) |

---

## Bias Audit Methodology

1. **Institution Tier** — Candidates grouped as Tier 1 (IIT/NIT/BITS), Tier 2, Tier 3. Mann-Whitney U test checks if composite scores differ significantly by group (threshold: p < 0.05, Cohen's d > 0.5). If flagged, scores are z-score normalised within groups.
2. **Experience Cohort** — Candidates grouped as Fresher / Mid / Senior / Lead. Kruskal-Wallis test checks for rank-order bias. If flagged, same normalisation applied.

---

*Tech Vista · v2.0.0 · For queries contact M S Vikram*
