-- Campus RLS patch — allow writes from anon role (server-side anon key).
-- Apply in Supabase SQL Editor.
--
-- For MVP: backend is the trust boundary. Anon key is used server-side,
-- not exposed directly to the browser beyond what already exists.
-- Production-tier: swap to a service-role key server-side and tighten policies
-- to `authenticated` + college_id scoping.

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'campus_colleges','campus_students','campus_companies','campus_drives',
        'campus_shortlists','campus_ingest_jobs','campus_chat_sessions',
        'campus_communications','campus_recruiter_tokens','campus_audit_log'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "all_all" ON %I', t);
        EXECUTE format('CREATE POLICY "all_all" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;
