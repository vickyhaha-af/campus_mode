# TechVista Campus — Production Readiness Checklist

Status key: ✅ done · 🟡 needs human · 🔴 needs code · ⚪ optional

---

## 1. Environment & Secrets

| Item | Status | Notes |
|------|--------|-------|
| `GEMINI_API_KEY_1` (parsing + chat agent) | 🟡 | User must provide. Free tier = 15 RPM, 1500 RPD. Paid tier lifts caps. Hitting 429 now → either wait for daily reset or upgrade. |
| `GEMINI_API_KEY_2` (embeddings) | 🟡 | Same Gemini project, separate key for rate-limit rotation. Embeddings have much higher free quota (~150 RPM). |
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | 🟡 | Free Supabase project. Required for any non-demo persistence. 5-min setup (see §2). |
| `ALLOWED_ORIGINS` | ✅ | Configured in `backend/config.py`. Production: override via env var with actual domain(s). |
| `EMAIL_PROVIDER` / `SENDGRID_API_KEY` | ⚪ | Only needed when email drafting/sending goes live. Mock provider works for MVP. |
| `FROM_EMAIL`, `FROM_NAME` | ⚪ | Display sender info for outbound mail. |

### .env template for production
```bash
# Core
GEMINI_API_KEY_1=AIza...
GEMINI_API_KEY_2=AIza...

# Supabase
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# CORS (comma-separated — include all production frontend origins)
ALLOWED_ORIGINS=https://techvista.yourdomain.com,https://campus.yourdomain.com

# Email (optional)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxx
FROM_EMAIL=placements@yourcollege.ac.in
FROM_NAME=Tech Vista Placement Cell
```

---

## 2. Supabase Setup (5 minutes)

1. Create project at [supabase.com](https://supabase.com). Pick a region close to your users (Mumbai/Singapore for India).
2. Open SQL Editor → run `supabase_schema.sql` from repo root (parent Tech Vista tables).
3. Run `campus/schema.sql` (all `campus_*` tables + RLS policies + pgvector + triggers).
4. Settings → API → copy `Project URL` and `anon public` key into your `.env`.
5. Restart backend. `/api/campus/colleges` now returns 200 instead of 503.

### pgvector index size notes
The student table uses `ivfflat` indexes on 768-dim embeddings. For < 10K students this is fine with default parameters. Past 50K, consider:
- Switching to HNSW (faster reads, slower inserts)
- Or running `REINDEX` after bulk ingest

---

## 3. Auth & RLS (needs tightening before multi-college launch)

Current state (✅ works for MVP / single college):
- Supabase Auth integration via parent's `auth_middleware.py`
- `campus/schema.sql` enables RLS on all tables with a permissive `authenticated` policy
- App-layer authorization pending

Before multi-tenant launch (🔴 code needed):
- Tighten RLS policies to scope by `college_id` from JWT custom claim
- Add role-based guards on routes (PC vs student vs recruiter)
- Implement the signed-token flow for recruiters (schema + route exist as stub)
- Add `X-College-Id` header requirement on all mutations

---

## 4. Rate Limits & Quotas

| Limit | Current | Production recommendation |
|-------|---------|---------------------------|
| Gemini Flash 2.0 (chat + parsing) | 15 RPM free | Upgrade to paid (~$0.35 / 1M input tokens) if daily requests > 1500. Billing unlocks higher limits immediately. |
| Gemini text-embedding-004 | 1500 RPM free | Headroom enough for 100-student bulk waves. |
| Supabase free tier | 500MB DB, 2GB bandwidth, 500 concurrent | Upgrade to Pro ($25/mo) before production. |
| Backend → Gemini token bucket | 14 RPM parse / 55 RPM embed | Auto-scales if paid tier detected; override via env vars if needed. |

**Fallback behaviour (✅ already built):** when Gemini is unavailable (429, network, missing key), the chat orchestrator switches to a deterministic intent-parsing fallback that runs real tools and produces a real Markdown response. The UI badges this as "fallback mode."

---

## 5. Deployment

### Backend (Render — free tier, no CC)

Config in `render.yaml` at repo root. Python pinned to 3.11.10 via `.python-version` + `runtime.txt` (scipy==1.13.1 needs Py 3.11 wheels).

**One-time setup:**
1. Log in at [render.com](https://render.com) (GitHub OAuth, no CC).
2. **New + → Web Service → Connect GitHub → pick `campus_mode` repo**.
3. Render reads `render.yaml` automatically. Confirm defaults.
4. Under *Environment*, add these **secrets** (the 6 `sync: false` ones):
   - `GEMINI_API_KEY_1`
   - `GEMINI_API_KEY_2`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_JWT_SECRET`
   - `ALLOWED_ORIGINS` — must include your Vercel URL, e.g. `https://campus-mode.vercel.app,http://localhost:5180`
5. Click **Deploy**. First build takes ~3-5 min (pip install of scipy is slow).
6. When live, your backend URL is `https://campus-backend.onrender.com` (or whatever suffix Render assigns).

**Free tier gotchas:**
- Spins down after 15 min of no traffic. First request after sleep wakes it up (~30-50s cold start).
- 512MB RAM limit. Bulk ingest of 100+ resumes may be tight; consider splitting into smaller batches.
- Auto-deploys on push to `main` (autoDeploy: true in config).

**Alt free options if Render sleep is a problem:**
- **Koyeb** (koyeb.com): 1 always-on free service, 512MB RAM. Same config shape works.
- **Hugging Face Spaces**: 16GB free RAM, no sleep. Push your `backend/` as a Docker space.

### Frontend (Vercel)

Already configured in `vercel.json`. After backend is deployed, set ONE env var in Vercel dashboard:
```
VITE_API_URL = https://<your-render-subdomain>.onrender.com/api
```
Trigger a redeploy (just push anything, or click "Redeploy" in Vercel).

### Frontend (Vercel)

Already configured in `vercel.json`:
- Frontend SPA from `frontend/dist`
- `/api/*` proxied to a Python handler (or rewrite to Railway backend)

Required env vars in Vercel:
- `VITE_API_URL` = `https://<railway-backend>.up.railway.app/api` OR leave empty if using `vercel.json` rewrites

### Dev port summary
- Frontend: `:5180` (was 5173, moved for local-project coexistence)
- Backend: `:8000`
- Other dev project: `:5173` (untouched)

---

## 6. Observability

| Signal | State | Production recommendation |
|--------|-------|---------------------------|
| Backend logs | stdout → Railway log stream | Add structured logging (JSON) + ship to Axiom / Logtail |
| Frontend errors | console only | Add Sentry (frontend + backend) |
| Audit log | `campus_audit_log` table, SHA-256 chained | ✅ compliance-grade. Build an audit viewer UI when needed. |
| Gemini quota usage | not tracked | Add a metrics endpoint + Grafana Cloud free tier |
| Ingest job status | persisted in `campus_ingest_jobs` | ✅ polled by frontend |

---

## 7. Data / Compliance

| Item | Status |
|------|--------|
| DPDPA 2023 consent model (blanket opt-in at registration) | ✅ schema supports; UI needs a clear consent checkbox on student onboarding |
| Immutable audit log (SHA-256 chained) | ✅ schema in place, `audit_store.py` exists in parent — campus-specific writer TODO |
| Demographic filter compliance warnings | ✅ working end-to-end. Every gender/age-filtered free-form query triggers an audit-loggable warning. |
| Data retention policy (auto-purge old sessions, etc.) | 🔴 parent has `cleanup_expired_sessions()`; campus equivalents TODO |
| PII minimisation in exports | 🔴 parent's exporter strips PII; campus exporter TODO |
| Right-to-deletion / data export on request | 🔴 API endpoints TODO |

---

## 8. SQL migrations to apply (in order)

1. `supabase_schema.sql` — parent Tech Vista tables (auth-tied)
2. `campus/schema.sql` — campus vertical tables + indexes + triggers
3. `campus/schema_rls_patch.sql` — initial permissive RLS (already active)
4. `campus/schema_rls_tighten.sql` — **apply when turning on real auth**: reads stay public, writes require authenticated
5. `campus/schema_multi_tenant.sql` — **apply for production multi-tenant**: per-college scoping via `campus_college_members` + `user_colleges()` SQL function. PC admins only see their own college's data.

Demo mode keeps working regardless — in-memory college bypasses all RLS.

## 9. Feature Completeness Matrix

### Done ✅
- Rich LLM enricher via **Groq (Llama 3.3 70B)** — passions, interests, personality, role-fit, achievement weight, institution tier, Indian credentials (JEE/CAT/KVPY/Olympiads), company tier on internships
- **Progressive ingest** — regex Phase A (visible in ~10s for 150 resumes) + LLM Phase B in background (~30-40 min)
- Student / Drive / Company CRUD with dedupe + compliance guards
- **Demo mode** (20 hand-crafted students, 4 drives, 5 companies — no setup needed)
- **Full chatbot with 9 tool calls**: search_students, semantic_rank, fetch_drive, check_eligibility, get_student_profile, explain_fit, list_drives, compare_students, match_drives_for_student
- Token-streaming chat responses + inline confirmation ActionCards for write actions (propose_shortlist, propose_interview_email, propose_rejection_email)
- Chat history sidebar
- **Deterministic fallback chat** works even without any LLM
- **pgvector + BOW cosine semantic ranking** (real DB + demo)
- Shortlist management + 7-stage Kanban lifecycle + CSV export
- **Eligibility-rules-driven shortlist filtering** with bias audit live panel (traffic-light skew detection on branch/gender/tier)
- **Career Coach** (student-facing LLM utility): readiness score, top drive matches with why/gap, resume quality audit, skills to acquire, 4-week action plan, peer ranking
- **Email workflow**: LLM-drafted interview/offer/rejection emails with tone + slot + custom instructions; PC reviews + edits + adds meeting link + sends (mocked to `campus_communications` table)
- **Analytics dashboards**: placement funnel chart, branch placement rate, drive conversion heatmap, "needs attention" actionable feed
- **Audit log** — SHA-256 hash-chained immutable log on every shortlist/drive/email/chat action + filterable viewer page + chain integrity verify + CSV export
- **Recruiter view** via signed-token links (30-day expiry)
- Unified navigation, dark mode toggle, mobile-responsive Kanban/filters/tables, toast notifications on every mutating action
- Setup onboarding banner with contextual messaging (env missing vs schema missing)
- Auth gates on PC-admin routes (`RequireAuth`); demo mode bypasses; parent's `/api/auth/login` reused
- Institution tier knowledge base (~180 Indian colleges, tier_1 / tier_2 / tier_3)
- Dual-provider LLM routing: **Groq primary, Gemini fallback** — `AIza*` vs `AQ.*` vs `gsk_*` key autodetection

### In progress 🟡 (needs code)
- **Google Calendar / Google Meet auto-link generation** — requires OAuth screens + consent (currently: PC pastes meeting link manually into email drafts; `{{meeting_link}}` placeholder substitution already works)
- **Real SMTP sending** — wired to mock (writes to `campus_communications` with `status='sent'`). Flip `EMAIL_PROVIDER` env from `mock` to `sendgrid` + add `SENDGRID_API_KEY` to enable real delivery (parent's `email_service.py` already supports this)
- **Paid Groq tier** — for actually hitting 30-seconds-for-150-resumes (free tier caps ingest at ~4 resumes/minute on Llama 3.3 70B)

### Deferred to v2 🟡
- Multi-tenancy (multiple colleges on same instance)
- Claude Sonnet as alternate chat backend (stronger reasoning)
- Auto-scheduling with Calendar integration
- Predictive placement modeling

---

## 9. Known Issues / Gotchas

1. **Stale `.venv` at iCloud path**: if you re-clone, rebuild the venv from scratch. iCloud sync occasionally breaks the binary at `.venv/bin/python3`.
2. **scipy pin divergence**: `requirements.txt` pins scipy to `1.13.1` for Railway's Python 3.11 wheels. Locally on Python 3.13 you need `scipy>=1.14`. Don't unpin `requirements.txt` or Railway deploys break.
3. **Gemini free tier "limit: 0"**: seen in the wild when a key has project restrictions applied in Google AI Studio. Check AI Studio → API keys → restrictions if you see this.
4. **Vite imports from `../../campus/frontend/`**: supported via `server.fs.allow: ['..', '.']` in `vite.config.js`. Production build works without this setting since Vite resolves at build time.
5. **Path spaces**: the repo lives in `iCloud Drive (Archive)/`. `start.sh` was updated to survive this; direct shell scripts that hardcode paths should quote everything.

---

## 10. Launch Checklist (1-page)

Before clicking "deploy":

- [ ] Gemini API keys validated (hit `/api/campus/chat/session` + stream, see tool calls execute)
- [ ] Supabase migrations applied (`supabase_schema.sql` + `campus/schema.sql`)
- [ ] `ALLOWED_ORIGINS` includes all production frontend domains
- [ ] Test ingest with 10 real resumes end-to-end
- [ ] Create a real college (not demo) and a real drive
- [ ] Run chatbot against real data, verify shortlist flow works
- [ ] Set up Sentry DSN for frontend + backend
- [ ] Set up Railway + Vercel billing alerts
- [ ] Document the runbook (who to page if chat goes down? who holds Supabase root?)
- [ ] Share demo link with one placecom admin for beta feedback
