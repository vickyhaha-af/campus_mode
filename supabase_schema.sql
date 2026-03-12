-- Tech Vista Supabase Database Schema
-- Run this in Supabase SQL Editor to set up tables

-- Enable pgvector extension for embeddings (must be first!)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- SESSIONS TABLE (replaces /tmp file storage)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster user session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_saved_at ON sessions(saved_at);

-- Row Level Security (RLS) - users can only see their own sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert own sessions" ON sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON sessions
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions" ON sessions
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- TALENT POOL TABLE (for resume rediscovery)
-- ============================================
CREATE TABLE IF NOT EXISTS talent_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    original_role TEXT,
    resume_text TEXT,
    skills JSONB DEFAULT '[]',
    embedding VECTOR(768), -- Gemini embedding dimension
    original_score FLOAT,
    stage_reached TEXT DEFAULT 'new',
    screened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable pgvector extension (run this first in Supabase)
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS idx_talent_pool_user_id ON talent_pool(user_id);
CREATE INDEX IF NOT EXISTS idx_talent_pool_embedding ON talent_pool USING ivfflat (embedding vector_cosine_ops);

ALTER TABLE talent_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own talent pool" ON talent_pool
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert to own talent pool" ON talent_pool
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- AUDIT LOG TABLE (immutable compliance log)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    candidate_id TEXT,
    details JSONB DEFAULT '{}',
    entry_hash TEXT NOT NULL,
    prev_hash TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_session_id ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs" ON audit_log
    FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- AUTO-CLEANUP EXPIRED SESSIONS (24 hours)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions 
    WHERE saved_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule with pg_cron (if available)
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions()');
