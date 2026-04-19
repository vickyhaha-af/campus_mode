-- TechVista Campus — Supabase schema
-- Run in the Supabase SQL editor after the parent schema (supabase_schema.sql).
-- Tables are prefixed `campus_` to keep them logically separate from parent
-- Tech Vista tables while living in the same `public` schema (simpler RLS + supabase-py).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- COLLEGES  (admin-configurable; supports multi-tenant readiness)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    branches JSONB DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STUDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID REFERENCES campus_colleges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    roll_no TEXT,
    branch TEXT,
    year INTEGER,
    cgpa NUMERIC(4,2),
    backlogs_active INTEGER DEFAULT 0,
    backlogs_cleared INTEGER DEFAULT 0,
    gender TEXT,
    date_of_birth DATE,
    hometown TEXT,
    current_city TEXT,
    phone TEXT,
    placed_status TEXT DEFAULT 'unplaced' CHECK (placed_status IN ('unplaced','in_process','placed','withdrawn')),
    placed_drive_id UUID,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    resume_text TEXT,
    profile_enriched JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    embedding_skills VECTOR(768),
    embedding_projects VECTOR(768),
    embedding_summary VECTOR(768),
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (college_id, email)
);

CREATE INDEX IF NOT EXISTS idx_campus_students_college ON campus_students(college_id);
CREATE INDEX IF NOT EXISTS idx_campus_students_placed ON campus_students(placed_status);
CREATE INDEX IF NOT EXISTS idx_campus_students_cgpa ON campus_students(cgpa);
CREATE INDEX IF NOT EXISTS idx_campus_students_branch ON campus_students(branch);
CREATE INDEX IF NOT EXISTS idx_campus_students_emb_summary ON campus_students USING ivfflat (embedding_summary vector_cosine_ops);

-- ============================================================================
-- COMPANIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID REFERENCES campus_colleges(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT,
    tier TEXT,
    website TEXT,
    added_by UUID REFERENCES auth.users(id),
    first_visit_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (college_id, name)
);

CREATE INDEX IF NOT EXISTS idx_campus_companies_college ON campus_companies(college_id);

-- ============================================================================
-- DRIVES  (one row per company-visit / role)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID REFERENCES campus_colleges(id) ON DELETE CASCADE,
    company_id UUID REFERENCES campus_companies(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    jd_text TEXT,
    jd_parsed JSONB DEFAULT '{}',
    jd_embedding VECTOR(768),
    ctc_offered NUMERIC(12,2),
    location TEXT,
    job_type TEXT CHECK (job_type IN ('full_time','internship','ppi','other')),
    eligibility_rules JSONB DEFAULT '{}',
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','in_progress','closed','cancelled')),
    scheduled_date DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_drives_college ON campus_drives(college_id);
CREATE INDEX IF NOT EXISTS idx_campus_drives_company ON campus_drives(company_id);
CREATE INDEX IF NOT EXISTS idx_campus_drives_status ON campus_drives(status);

-- ============================================================================
-- SHORTLISTS  (drive <-> student with stage tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_shortlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID REFERENCES campus_drives(id) ON DELETE CASCADE,
    student_id UUID REFERENCES campus_students(id) ON DELETE CASCADE,
    stage TEXT DEFAULT 'shortlisted' CHECK (stage IN (
        'shortlisted','interview_1','interview_2','interview_3','offered','accepted','joined','rejected','withdrawn'
    )),
    rank INTEGER,
    fit_score NUMERIC(5,2),
    fit_rationale TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (drive_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_campus_shortlists_drive ON campus_shortlists(drive_id);
CREATE INDEX IF NOT EXISTS idx_campus_shortlists_student ON campus_shortlists(student_id);
CREATE INDEX IF NOT EXISTS idx_campus_shortlists_stage ON campus_shortlists(stage);

-- ============================================================================
-- INGEST JOBS  (async resume bulk-ingest status tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_ingest_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID REFERENCES campus_colleges(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    total INTEGER NOT NULL,
    processed INTEGER DEFAULT 0,
    succeeded INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
    errors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_ingest_jobs_status ON campus_ingest_jobs(status);

-- ============================================================================
-- CHAT SESSIONS  (multi-turn agent memory)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id UUID REFERENCES campus_colleges(id) ON DELETE CASCADE,
    role_scope TEXT CHECK (role_scope IN ('pc','student','recruiter')),
    context_drive_id UUID REFERENCES campus_drives(id) ON DELETE SET NULL,
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_chat_user ON campus_chat_sessions(user_id);

-- ============================================================================
-- COMMUNICATIONS  (emails drafted / sent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID REFERENCES campus_drives(id) ON DELETE CASCADE,
    student_id UUID REFERENCES campus_students(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('shortlist_notify','interview_invite','offer','rejection','custom')),
    channel TEXT DEFAULT 'email',
    subject TEXT,
    body TEXT,
    meeting_link TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','bounced','opened','failed')),
    sent_by UUID REFERENCES auth.users(id),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_comms_drive ON campus_communications(drive_id);
CREATE INDEX IF NOT EXISTS idx_campus_comms_student ON campus_communications(student_id);

-- ============================================================================
-- RECRUITER ACCESS TOKENS  (signed view-only links)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_recruiter_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID REFERENCES campus_drives(id) ON DELETE CASCADE,
    recruiter_email TEXT NOT NULL,
    signed_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG  (immutable, SHA-256 chained — campus-scoped)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    college_id UUID REFERENCES campus_colleges(id),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    details JSONB DEFAULT '{}',
    entry_hash TEXT NOT NULL,
    prev_hash TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_campus_audit_timestamp ON campus_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_campus_audit_college ON campus_audit_log(college_id);
CREATE INDEX IF NOT EXISTS idx_campus_audit_user ON campus_audit_log(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
--   PC admins (users with role metadata "pc") see all rows for their college.
--   Students see only their own row in campus_students.
--   Recruiter access is token-based (no direct DB access in v1).
-- NOTE: Role scoping is enforced at the application layer in MVP;
--   RLS here is permissive for authenticated users so the API can serve
--   all three personas. Tighten when multi-tenant mode ships.
-- ============================================================================
ALTER TABLE campus_colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_ingest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_recruiter_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'campus_colleges','campus_students','campus_companies','campus_drives',
        'campus_shortlists','campus_ingest_jobs','campus_chat_sessions',
        'campus_communications','campus_recruiter_tokens','campus_audit_log'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', t);
        EXECUTE format('CREATE POLICY "authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- Updated-at trigger for students and drives
CREATE OR REPLACE FUNCTION campus_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campus_students_touch ON campus_students;
CREATE TRIGGER trg_campus_students_touch BEFORE UPDATE ON campus_students
    FOR EACH ROW EXECUTE FUNCTION campus_touch_updated_at();

DROP TRIGGER IF EXISTS trg_campus_drives_touch ON campus_drives;
CREATE TRIGGER trg_campus_drives_touch BEFORE UPDATE ON campus_drives
    FOR EACH ROW EXECUTE FUNCTION campus_touch_updated_at();

DROP TRIGGER IF EXISTS trg_campus_ingest_touch ON campus_ingest_jobs;
CREATE TRIGGER trg_campus_ingest_touch BEFORE UPDATE ON campus_ingest_jobs
    FOR EACH ROW EXECUTE FUNCTION campus_touch_updated_at();
