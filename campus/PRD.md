# TechVista Campus — Product Requirements Document

**Version:** 1.0 (Signed off — April 2026)
**Status:** Locked. Ready for Phase 0 implementation.
**Relationship to parent:** Second vertical alongside existing Tech Vista HR-screening product. Shares infra, isolated data/UX.

---

## 1. Vision

Shift the core Tech Vista engine from *"companies screen candidates"* to *"college placement cells match their students to visiting companies."* TechVista Campus is a role-based dashboard + AI chatbot for Placement Committees (PC), students, and recruiters, built on the same foundations (Gemini, Supabase, FastAPI, React) but with a distinct data model, workflow, and conversational interface.

---

## 2. Personas & Access

| Persona | Who | What they do |
|---|---|---|
| **PC Admin** | Placement committee officers at the college | Owns everything. Uploads JDs, manages drives, runs the chatbot to build shortlists, triggers emails + meeting links, tracks lifecycle, exports reports. Primary chatbot user. |
| **Student** | College students in the placement pool | Maintains own profile (resume, CGPA, backlogs, internships, preferences, passions), views eligible drives, tracks own shortlist status. |
| **Recruiter (Company)** | Visiting company reps | Read-only view of their drive's shortlist + per-candidate deep-dives. Leaves feedback. Does NOT manipulate state in v1. |

**Consent model:** blanket opt-in at student registration. Revocation = student leaves the pool (profile hidden from all drives).

---

## 3. Feature Scope

### MVP (v1)

- Student profile CRUD (self-serve with PC override rights)
- Bulk resume ingest → LLM extraction → rich structured + semantic profile
- PC dashboard: drives, students, upcoming schedule, placement stats
- JD upload per drive + eligibility rules (CGPA, branches, backlogs, location, gender-if-company-required)
- **Chatbot** (Gemini Flash 2.0 agent with tool calls):
  - Natural language queries: *"Top 15 for this JD"*, *"Finance, 3yrs exp, Gurgaon"*, *"Who's unplaced and eligible for Deloitte tomorrow?"*
  - Explainable ranking with per-candidate rationale
  - Multi-turn with session memory (*"Now filter by CGPA > 8"*)
- Email drafting + sending (shortlist notifications, interview invites, offers, rejections)
- Lifecycle tracking: shortlisted → interview_1 → interview_2 → offered → accepted → joined
- Bias audit module (reuses parent's statistical bias audit — flags if shortlists skew unexpectedly)
- Full immutable audit log (DPDPA-compliant, reuses `audit_store.py`)

### v2 (once proof-of-change lands — paid tier budget unlocks)

- Companies self-register + view shortlists directly
- Auto-scheduling (Google Calendar integration, conflict resolution)
- Video meeting link generation (Google Meet / Zoom OAuth) — auto-injected into emails
- Multi-tenant (multiple colleges on same instance with row-level isolation)
- Claude Sonnet as alternate chat backend (stronger reasoning for complex multi-turn queries)
- Talent pool analytics dashboard (placement trends, department heat maps)

### Stretch

- LinkedIn/GitHub auto-enrichment
- Predictive placement modeling ("student X has 78% chance of converting Goldman based on historical patterns")
- Resume improvement suggestions for students

---

## 4. Data Model

All tables live in a new `campus` schema in the existing Supabase Postgres instance. Isolated from parent Tech Vista tables.

### `students`
- **Structured**: `id`, `name`, `email`, `roll_no`, `branch`, `year`, `cgpa`, `backlogs_active`, `backlogs_cleared`, `gender`, `date_of_birth`, `hometown`, `current_city`, `phone`, `placed_status` (unplaced/in-process/placed), `placed_drive_id`, `registered_at`, `consent_given`, `consent_timestamp`
- **JSONB `profile_enriched`** (Gemini-extracted): `skills[]`, `projects[]`, `internships[]`, `passions[]`, `interests[]`, `achievements[]`, `certifications[]`, `role_fit_signals{}`, `domain_preferences[]`, `personality_hints{}`, `achievement_weight` (0–1 float)
- **JSONB `preferences`** (student-stated): `desired_roles[]`, `desired_locations[]`, `desired_company_types[]` (startup/MNC/PSU etc.), `min_salary`, `willingness_to_relocate` (bool), `work_mode` (onsite/remote/hybrid)
- **Vector (pgvector, 768-dim)**: `embedding_skills`, `embedding_projects`, `embedding_summary`

### `companies`
- `id`, `name`, `industry`, `tier`, `website`, `added_by_pc`, `first_visit_date`

### `drives` (one row per company visit / role)
- `id`, `company_id`, `jd_text`, `jd_parsed` (JSONB), `role`, `ctc_offered`, `location`, `job_type` (FT/intern), `eligibility_rules` (JSONB), `status` (upcoming/in-progress/closed), `scheduled_date`, `jd_embedding` (vector)

**`eligibility_rules` shape:**
```json
{
  "min_cgpa": 7.5,
  "max_active_backlogs": 0,
  "max_total_backlogs": 2,
  "allowed_branches": ["CSE", "IT", "ECE"],
  "allowed_years": [2026],
  "gender_restriction": null,
  "location_flexibility_required": true,
  "custom_rules": [
    {"type": "prior_placement_tier", "max_tier_placed": 2, "justification": "company X excludes already-placed-in-tier1 students"}
  ]
}
```

### `shortlists`
- `id`, `drive_id`, `student_id`, `stage`, `rank`, `fit_score`, `fit_rationale`, `created_by` (pc_admin_id), `last_updated`, `withdrawn` (bool)

### `chat_sessions`
- `id`, `user_id`, `role_scope` (pc/student/recruiter), `messages` (JSONB array: `[{role, content, tool_calls?, tool_results?, ts}]`), `context_drive_id` (nullable — pinned context), `created_at`, `last_active`

### `communications`
- `id`, `drive_id`, `student_id`, `type` (shortlist_notify/interview_invite/offer/rejection/custom), `channel` (email/sms-v2), `subject`, `body`, `meeting_link`, `sent_at`, `sent_by`, `status` (draft/sent/bounced/opened)

### `audit_log` (reuses existing `audit_store.py` hashing pattern)
Immutable, SHA-256-chained. Every chatbot action, every email sent, every shortlist change, every eligibility-override logged.

### `recruiter_access_tokens`
- `id`, `drive_id`, `recruiter_email`, `signed_token`, `expires_at`, `last_used_at` — view-only magic links for recruiters in v1.

---

## 5. Chatbot Architecture

**Agent loop** (Gemini Flash 2.0 with tool calls):

```
User query → LLM plans → tool calls → tool results
  → LLM reasons → (more tool calls if needed) → final answer + rationale
```

**Tools exposed to the LLM:**

| Tool | Purpose | Read/Write |
|---|---|---|
| `search_students(filters)` | Structured filter: branch, year, cgpa range, gender, backlogs, placed_status, current_city, preferences | read |
| `semantic_rank(query_text, student_ids)` | pgvector similarity + LLM re-rank | read |
| `fetch_drive(drive_id)` | Load JD + eligibility rules | read |
| `check_eligibility(student_id, drive_id)` | Pass/fail + list of violations | read |
| `get_student_profile(student_id)` | Full profile for deep-dive | read |
| `explain_fit(student_id, drive_id)` | LLM rationale for match | read |
| `bias_check(shortlist)` | Runs stat bias audit over a tentative shortlist | read |
| `create_shortlist(drive_id, student_ids[])` | Commit shortlist | **write (PC approves)** |
| `draft_email(template, drive_id, student_ids[])` | Draft only, stores in `communications` as draft | write-draft |
| `send_email(communication_id)` | Gated; requires explicit PC click | **write (PC approves)** |
| `schedule_meeting(drive_id, student_id, slot)` | v2 | deferred |

**Session memory:** stored in `chat_sessions.messages`. LLM receives recent N turns + pinned drive context.

**Safety invariant:** any write action (shortlist creation, email send, profile mutation) is staged as a draft and requires explicit PC confirmation click. Chatbot never takes irreversible action unilaterally.

---

## 6. User Flows

### PC Admin (primary flow)
1. Login → Dashboard: upcoming drives, unplaced students count, recent activity, bias-audit warnings
2. Create drive: paste JD → LLM parses → PC reviews parsed fields → sets eligibility rules → save
3. Open chat on drive context: *"Top 20 fits"* → bot calls tools → returns ranked list + rationale
4. Refine: *"Filter out anyone already placed in tier-1 companies"* → bot updates list
5. Click "Approve shortlist" → students locked into drive stage: `shortlisted`
6. Chat: *"Draft interview invites for shortlisted, slot tomorrow 2pm"* → bot drafts → PC reviews → Send
7. Track lifecycle through drive detail page (Kanban reused from parent Tech Vista)

### Student
1. Register with college email → blanket consent → upload resume → LLM auto-fills profile
2. Review + edit profile (add passions, preferences, correct extraction errors)
3. Dashboard: eligible upcoming drives, own shortlist status, interview invites, offer letters
4. Receive emails for shortlists / interviews / offers / rejections

### Recruiter (v1, read-only)
1. PC shares drive link (signed token, 30-day expiry)
2. Recruiter opens link → sees shortlist + per-candidate deep-dive
3. Leaves feedback per candidate (stored, visible to PC)

---

## 7. Tech Stack (free-tier friendly)

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI + Python 3.11 | Reuses Tech Vista patterns |
| DB | Supabase (Postgres + pgvector + RLS) | Free tier sufficient for single college; already integrated |
| Auth | Supabase Auth with 3 roles (pc, student, recruiter) enforced via RLS | Free |
| LLM | Gemini Flash 2.0 (parsing + embeddings + agent chat) | Free tier (15 RPM, 1500 RPD); existing integration |
| Chat state | Supabase `chat_sessions` table | No Redis needed for MVP |
| Email | SMTP (Gmail app password) or SendGrid free tier (100/day) | Free tier; reuses `email_service.py` |
| Meeting links | v2: Google Meet via OAuth; v1: manual URL field PC fills in draft | Defer |
| Frontend | React 19 + Vite 6 | Reuse Tech Vista design system |
| Chat UI | Custom streaming component + SSE (Server-Sent Events) | Lean, no dep bloat |
| Deployment | Railway (backend) + Vercel (frontend) | Existing setup |

### 7.1 Bulk-ingest rate-limit strategy (60–100 resumes)

Gemini Flash 2.0 free tier = **15 RPM**. A 100-resume wave = ~7 minutes minimum parsing time even with perfect parallelism. Embeddings are a separate quota bucket (much higher), so run those in parallel with parsing.

**Design:**
- `profile_enricher.py` maintains an in-process queue with a token-bucket rate limiter (15 req/min per key, 2 keys = 30 req/min effective)
- PC uploads 60–100 resumes → backend returns `job_id` immediately, processes asynchronously (FastAPI `BackgroundTasks`)
- Frontend polls `/api/campus/ingest/{job_id}/status` every 3s → shows progress ring with live count (`42/100 enriched`)
- Failed parses retry with exponential backoff; after 3 failures they surface to PC for manual review
- Embeddings batched (Gemini supports batch embedding up to 100 items per call — big win)

Target: **100-resume wave fully enriched in under 5 minutes**. If that bottlenecks, paid-tier upgrade is the unlock (Section 3 v2).

---

## 8. Folder Structure

```
campus/
├── PRD.md                        ← this doc
├── schema.sql                    ← Supabase DDL for campus schema
├── backend/
│   ├── models/
│   │   ├── student.py
│   │   ├── company.py
│   │   ├── drive.py
│   │   ├── shortlist.py
│   │   ├── communication.py
│   │   └── chat.py
│   ├── routes/
│   │   ├── students.py
│   │   ├── drives.py
│   │   ├── shortlists.py
│   │   ├── chat.py                ← SSE chat endpoint
│   │   ├── communications.py
│   │   └── recruiter.py           ← signed-token view-only
│   └── services/
│       ├── chat_orchestrator.py   ← agent loop + tool dispatch
│       ├── tools.py               ← tool implementations
│       ├── matcher.py
│       ├── eligibility_engine.py
│       ├── profile_enricher.py    ← LLM extraction → JSONB
│       └── email_composer.py      ← extends parent's email_drafter
└── frontend/
    ├── pages/
    │   ├── PCDashboard.jsx
    │   ├── DriveDetailPage.jsx
    │   ├── ChatPage.jsx
    │   ├── StudentDashboard.jsx
    │   ├── StudentProfilePage.jsx
    │   └── RecruiterViewPage.jsx
    └── components/
        ├── ChatWindow.jsx
        ├── ShortlistTable.jsx
        ├── StudentProfileCard.jsx
        ├── EligibilityBadges.jsx
        ├── DriveCard.jsx
        └── CommunicationTimeline.jsx
```

**Shared with parent (imported, not duplicated):**
`backend/services/` — `parser.py`, `embedder.py`, `audit_store.py`, `exporter.py`, `file_handler.py`, `email_service.py`, `bias_audit.py`.

---

## 9. Ethical & Compliance Design

### Demographic filtering (gender, age, etc.)
Real placement scenarios sometimes include company-stated gender/demographic constraints (field-sales roles with travel restrictions, women-only hiring drives for diversity mandates, etc.). Indian employment law permits this only when there's a genuine occupational requirement.

**Design response:**
- Demographic filters are a first-class part of `eligibility_rules` on the **drive** — applied because the company specified it, with a `justification` field that's mandatory when such a rule is set.
- Free-form chatbot queries that *independently* include demographic filters (not tied to a drive) get a soft warning in the UI: *"This filter may raise compliance concerns. Logged for audit."* — PC can proceed; the action is logged.
- Every demographic-filtered query and shortlist is written to `audit_log` with the justification, creating a defensible trail.
- The bias audit module runs silently over final shortlists and flags any unexpected skew the PC didn't set.

This approach respects how placement cells actually operate while keeping you safe if a decision is ever challenged.

### Consent
Blanket opt-in at student registration with revocation option. DPDPA 2023 aligned.

### Audit
Every chatbot query, every shortlist change, every email, every eligibility override — SHA-256-chained immutable log.

---

## 10. Phased Roadmap

| Phase | Duration | Deliverables |
|---|---|---|
| **Phase 0 — Foundations** | ~Week 1 | `campus/` scaffold, Supabase schema DDL, student/company/drive models + basic CRUD APIs, profile enricher service |
| **Phase 1 — Dashboards** | ~Week 2 | PC Dashboard, Drive detail page, Student Dashboard + Profile edit, Recruiter view-only page |
| **Phase 2 — Chatbot MVP** | ~Week 3 | Agent orchestrator, 6 core read tools (search, semantic_rank, fetch_drive, check_eligibility, get_profile, explain_fit), streaming chat UI, session memory |
| **Phase 3 — Workflow automation** | ~Week 4 | Shortlist write tools with confirmation gate, email drafting + sending, lifecycle Kanban |
| **Phase 4 — Polish & ship** | ~Week 5 | Bias audit integration, compliance warnings, audit log UI, end-to-end test on mock placement scenario |
| **Phase 5 (post-MVP, paid tier)** | — | Claude Sonnet chat option, meeting link auto-gen, multi-tenancy, recruiter self-service |

---

## 11. Locked Decisions (sign-off April 2026)

1. **College identity** — generic and admin-configurable at setup. Not hardcoded to any single institution. Settings page lets PC name the college, upload logo, define branches/departments.
2. **Bulk ingest volume** — 60–100 resumes per wave. See Section 7.1 for rate-limit handling.
3. **Profile ownership** — **PC is king.** Students can view their profile but cannot override PC-made edits. Students can *suggest* edits (queued for PC review) but cannot directly mutate locked fields (CGPA, backlogs, branch, year).
4. **Duplicate handling** — **full replace.** Student re-uploads resume → existing enrichment is wiped, new extraction replaces it. Prior PC overrides are NOT preserved (PC can re-apply if needed). Old versions retained in audit log for reversibility.
5. **Bias audit UX** — **live warnings** inline as PC builds shortlist. Warning banner appears above the shortlist table when skew is detected (e.g., "Shortlist skews 87% male despite a gender-neutral JD — review?").
6. **Demographic filters** — approved design from Section 9: drive-level eligibility rules accept demographic constraints with mandatory justification; free-form chatbot queries with demographic filters trigger soft compliance warning + audit entry.

---

## 12. Success Criteria for MVP

- A PC admin can go from "paste JD" → "approved shortlist" → "sent interview invites" in **under 5 minutes** using only chat + two approve clicks
- Chatbot correctly handles at least these 4 query types: JD-based ranking, filter-based search, eligibility check, lifecycle query
- Zero data leaks between students (RLS enforced)
- Every action reproducible from audit log
- Runs entirely on free tiers for a 500-student / 30-drive cohort
