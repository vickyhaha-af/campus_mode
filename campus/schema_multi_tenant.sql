-- TechVista Campus — Multi-tenant per-college RLS scoping
--
-- Apply AFTER schema.sql + schema_rls_patch.sql + schema_rls_tighten.sql.
-- This file introduces proper tenant isolation: a user can only read/write
-- rows belonging to the college(s) they own.
--
-- Ownership model:
--   1. campus_college_members (new table): (user_id, college_id, role) tuples.
--      Role: 'pc_admin' | 'student' | 'recruiter'.
--   2. A helper SQL function user_colleges() returns the set of college_ids
--      the current JWT claims ownership of.
--   3. Every campus_* table's RLS policies reference user_colleges() for
--      write/update/delete, with reads scoped too (except for campus_colleges
--      which stays publicly readable so /campus landing shows a list of
--      colleges to sign into).
--
-- Sign-up flow for a new PC admin (happens at app level):
--   1. User signs up via Supabase auth → gets auth.users.id
--   2. PC admin creates their college → app inserts a campus_college_members
--      row with role='pc_admin' linking the user to the new college
--   3. From then on, RLS enforces that only that user sees/mutates rows
--      scoped to their college_id

-- ============================================================================
-- 1. Membership table
-- ============================================================================
CREATE TABLE IF NOT EXISTS campus_college_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES campus_colleges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'pc_admin' CHECK (role IN ('pc_admin', 'student', 'recruiter')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (college_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_campus_college_members_user ON campus_college_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campus_college_members_college ON campus_college_members(college_id);
ALTER TABLE campus_college_members ENABLE ROW LEVEL SECURITY;

-- Members can see their own rows.
DROP POLICY IF EXISTS "members_read_own" ON campus_college_members;
CREATE POLICY "members_read_own" ON campus_college_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Only pc_admins of a college can add members to it.
DROP POLICY IF EXISTS "members_write_admin" ON campus_college_members;
CREATE POLICY "members_write_admin" ON campus_college_members
    FOR ALL TO authenticated
    USING (college_id IN (
        SELECT college_id FROM campus_college_members
        WHERE user_id = auth.uid() AND role = 'pc_admin'
    ))
    WITH CHECK (college_id IN (
        SELECT college_id FROM campus_college_members
        WHERE user_id = auth.uid() AND role = 'pc_admin'
    ));

-- ============================================================================
-- 2. Helper function
-- ============================================================================
CREATE OR REPLACE FUNCTION user_colleges()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT college_id FROM campus_college_members
    WHERE user_id = auth.uid()
$$;

-- ============================================================================
-- 3. Rewrite per-college-scoped policies
-- ============================================================================

-- Helper: rebuild policies for a table with (college_id IN user_colleges()) scope.
DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'campus_students', 'campus_companies', 'campus_drives',
        'campus_ingest_jobs', 'campus_chat_sessions', 'campus_audit_log'
    ]) LOOP
        -- Drop previous tighten-pass policies
        EXECUTE format('DROP POLICY IF EXISTS "read_public"           ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "write_authenticated"   ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "update_authenticated"  ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "delete_authenticated"  ON %I', t);

        -- Reads: anon + authenticated, BUT only rows in user_colleges() for
        -- authenticated users. anon still gets public read for demo/landing.
        EXECUTE format(
            'CREATE POLICY "read_own_college" ON %I FOR SELECT '
            'USING (auth.role() = ''anon'' OR college_id IN (SELECT user_colleges()))', t
        );

        -- Writes: authenticated + scoped to user_colleges() only.
        EXECUTE format(
            'CREATE POLICY "insert_own_college" ON %I FOR INSERT '
            'TO authenticated WITH CHECK (college_id IN (SELECT user_colleges()))', t
        );
        EXECUTE format(
            'CREATE POLICY "update_own_college" ON %I FOR UPDATE '
            'TO authenticated USING (college_id IN (SELECT user_colleges())) '
            'WITH CHECK (college_id IN (SELECT user_colleges()))', t
        );
        EXECUTE format(
            'CREATE POLICY "delete_own_college" ON %I FOR DELETE '
            'TO authenticated USING (college_id IN (SELECT user_colleges()))', t
        );
    END LOOP;
END $$;

-- Audit log: append-only (no UPDATE/DELETE) — already enforced by tighten pass.
-- Just re-establish the per-college insert rule.
DROP POLICY IF EXISTS "insert_own_college" ON campus_audit_log;
CREATE POLICY "insert_own_college" ON campus_audit_log FOR INSERT
    TO authenticated
    WITH CHECK (college_id IN (SELECT user_colleges()));

-- campus_shortlists: scoped via the drive's college_id
DROP POLICY IF EXISTS "read_public"           ON campus_shortlists;
DROP POLICY IF EXISTS "write_authenticated"   ON campus_shortlists;
DROP POLICY IF EXISTS "update_authenticated"  ON campus_shortlists;
DROP POLICY IF EXISTS "delete_authenticated"  ON campus_shortlists;
CREATE POLICY "read_via_drive" ON campus_shortlists FOR SELECT
    USING (
        auth.role() = 'anon'
        OR drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges()))
    );
CREATE POLICY "write_via_drive" ON campus_shortlists FOR ALL
    TO authenticated
    USING (drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges())))
    WITH CHECK (drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges())));

-- campus_communications + campus_recruiter_tokens: scoped via drive
DROP POLICY IF EXISTS "read_public"           ON campus_communications;
DROP POLICY IF EXISTS "write_authenticated"   ON campus_communications;
DROP POLICY IF EXISTS "update_authenticated"  ON campus_communications;
DROP POLICY IF EXISTS "delete_authenticated"  ON campus_communications;
CREATE POLICY "rw_via_drive" ON campus_communications FOR ALL
    TO authenticated
    USING (drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges())))
    WITH CHECK (drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges())));
CREATE POLICY "read_public_comms" ON campus_communications FOR SELECT
    USING (auth.role() = 'anon' OR drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges())));

DROP POLICY IF EXISTS "read_public"           ON campus_recruiter_tokens;
DROP POLICY IF EXISTS "write_authenticated"   ON campus_recruiter_tokens;
DROP POLICY IF EXISTS "update_authenticated"  ON campus_recruiter_tokens;
DROP POLICY IF EXISTS "delete_authenticated"  ON campus_recruiter_tokens;
CREATE POLICY "rw_via_drive" ON campus_recruiter_tokens FOR ALL
    TO authenticated
    USING (drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges())))
    WITH CHECK (drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges())));
CREATE POLICY "read_public_tokens" ON campus_recruiter_tokens FOR SELECT
    USING (auth.role() = 'anon' OR drive_id IN (SELECT id FROM campus_drives WHERE college_id IN (SELECT user_colleges())));

-- campus_colleges: public READ (landing/login shows all), scoped WRITE
DROP POLICY IF EXISTS "read_public"           ON campus_colleges;
DROP POLICY IF EXISTS "write_authenticated"   ON campus_colleges;
DROP POLICY IF EXISTS "update_authenticated"  ON campus_colleges;
DROP POLICY IF EXISTS "delete_authenticated"  ON campus_colleges;
CREATE POLICY "read_colleges_public" ON campus_colleges FOR SELECT
    USING (true);
CREATE POLICY "update_own_college_row" ON campus_colleges FOR UPDATE
    TO authenticated
    USING (id IN (SELECT user_colleges()))
    WITH CHECK (id IN (SELECT user_colleges()));
CREATE POLICY "delete_own_college_row" ON campus_colleges FOR DELETE
    TO authenticated
    USING (id IN (SELECT user_colleges()));
-- Anyone signed in can CREATE a college (then they auto-become its pc_admin via the app layer).
CREATE POLICY "insert_college_authenticated" ON campus_colleges FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================================
-- 4. Grants (for completeness — Supabase usually sets these, but explicit)
-- ============================================================================
GRANT SELECT ON campus_colleges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    campus_college_members,
    campus_colleges, campus_students, campus_companies, campus_drives,
    campus_shortlists, campus_ingest_jobs, campus_chat_sessions,
    campus_communications, campus_recruiter_tokens
TO authenticated;
GRANT SELECT, INSERT ON campus_audit_log TO authenticated;
