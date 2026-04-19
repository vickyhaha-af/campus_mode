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

### Backend (Railway)

Already configured in `railway.toml`:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/api/health"
```

Required env vars in Railway dashboard:
- `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `ALLOWED_ORIGINS` (must include your Vercel frontend URL)
- Python 3.11 (via `.python-version` file — already pinned to 3.11 for scipy wheels)

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

## 8. Feature Completeness Matrix

### Done ✅
- Rich LLM enricher (passions, interests, personality, role-fit, achievement weight)
- Bulk resume ingest with rate-limiter + async job tracking
- Student / Drive / Company CRUD
- Demo mode (20 hand-crafted students, 4 drives, 5 companies — no setup needed)
- Full chatbot with 6 tool calls (search_students, semantic_rank, fetch_drive, check_eligibility, get_student_profile, explain_fit)
- Fallback chat (works even without Gemini)
- Shortlist management + 7-stage Kanban lifecycle
- Eligibility-rules-driven shortlist filtering
- Demographic filter compliance warnings
- Unified navigation across all campus pages
- Setup onboarding banner

### In progress 🟡 (needs code)
- Email drafting + sending (email_composer service exists in parent; campus wrapper TODO)
- Meeting link auto-generation (Google Meet / Zoom OAuth — deferred to v2)
- Student self-edit page (currently a stub)
- Recruiter signed-token view (schema + route exist; UI is a stub)
- Live bias-audit warnings on shortlists (backend module exists in parent)
- Audit log viewer UI

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
