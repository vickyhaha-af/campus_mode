-- TechVista Campus — RLS tightening for production
--
-- Apply AFTER schema.sql and schema_rls_patch.sql (which opened everything up
-- while auth wasn't wired). This file closes write access to the authenticated
-- role only while keeping read access public so demo + landing surfaces work.
--
-- REMAINING GAP (documented in campus/PRODUCTION_READINESS.md):
--   These policies do NOT yet scope writes to the user's own college_id.
--   For multi-tenant isolation, add a per-table policy that checks
--     college_id IN (SELECT id FROM campus_colleges WHERE owner_id = auth.uid())
--   once we wire college ownership to auth.users. Application layer currently
--   enforces this via `require_auth` on campus write endpoints.
--
-- To apply: paste into Supabase SQL Editor and Run.

DO $$
DECLARE t TEXT;
BEGIN
    -- Drop the permissive policies from schema_rls_patch.sql
    FOR t IN SELECT unnest(ARRAY[
        'campus_colleges', 'campus_students', 'campus_companies', 'campus_drives',
        'campus_shortlists', 'campus_ingest_jobs', 'campus_chat_sessions',
        'campus_communications', 'campus_recruiter_tokens', 'campus_audit_log'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "all_all" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', t);

        -- Reads: public (anon + authenticated) — enables demo landing + student lookups
        EXECUTE format(
            'CREATE POLICY "read_public" ON %I FOR SELECT '
            'TO anon, authenticated USING (true)', t
        );
        -- Writes: authenticated role only
        EXECUTE format(
            'CREATE POLICY "write_authenticated" ON %I FOR INSERT '
            'TO authenticated WITH CHECK (true)', t
        );
        EXECUTE format(
            'CREATE POLICY "update_authenticated" ON %I FOR UPDATE '
            'TO authenticated USING (true) WITH CHECK (true)', t
        );
        EXECUTE format(
            'CREATE POLICY "delete_authenticated" ON %I FOR DELETE '
            'TO authenticated USING (true)', t
        );
    END LOOP;
END $$;

-- Audit log is append-only — block UPDATE + DELETE entirely at the RLS layer.
DROP POLICY IF EXISTS "update_authenticated" ON campus_audit_log;
DROP POLICY IF EXISTS "delete_authenticated" ON campus_audit_log;
-- (INSERT + SELECT policies above still apply.)

-- Grant explicit table permissions to anon/authenticated roles to match policy
-- intent (Supabase usually does this, but spell it out for clarity).
GRANT SELECT ON
    campus_colleges, campus_students, campus_companies, campus_drives,
    campus_shortlists, campus_ingest_jobs, campus_chat_sessions,
    campus_communications, campus_recruiter_tokens, campus_audit_log
TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    campus_colleges, campus_students, campus_companies, campus_drives,
    campus_shortlists, campus_ingest_jobs, campus_chat_sessions,
    campus_communications, campus_recruiter_tokens
TO authenticated;

GRANT SELECT, INSERT ON campus_audit_log TO authenticated;
