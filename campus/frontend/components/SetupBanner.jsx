import React, { useState, useEffect } from 'react'
import { AlertTriangle, ExternalLink, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import campus from '../api'

/**
 * Shows a friendly "setup needed" banner when Supabase is not configured.
 * Pings the /api/campus/colleges endpoint and checks for 503. If OK, hides.
 * In demo mode, stays hidden (demo doesn't need Supabase).
 */
export default function SetupBanner() {
  const isDemo = localStorage.getItem('campus_demo_mode') === '1'
  const [state, setState] = useState('checking') // checking | ok | needs_env | needs_schema
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (isDemo) { setState('ok'); return }
    ;(async () => {
      try {
        await campus.get('/colleges')
        setState('ok')
      } catch (e) {
        if (e.response?.status === 503) {
          const detail = (e.response.data?.detail || '').toLowerCase()
          if (detail.includes('tables') || detail.includes('schema')) setState('needs_schema')
          else setState('needs_env')
        } else {
          setState('ok')  // other errors shouldn't block the UI
        }
      }
    })()
  }, [isDemo])

  if (state !== 'needs_env' && state !== 'needs_schema') return null

  return (
    <div style={{
      background: 'var(--blush-pale)', border: '1px solid var(--blush-light)',
      borderRadius: 'var(--radius-card)', padding: 14, marginBottom: 24,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      >
        <AlertTriangle size={16} color="var(--blush)" />
        <span style={{ fontSize: 14, color: 'var(--blush)', fontWeight: 500, flex: 1 }}>
          {state === 'needs_schema'
            ? 'Supabase connected — tables missing. Run campus/schema.sql to finish setup.'
            : 'Supabase not configured — set it up to enable real persistence'}
        </span>
        {expanded ? <ChevronUp size={14} color="var(--blush)" /> : <ChevronDown size={14} color="var(--blush)" />}
      </div>
      {expanded && state === 'needs_schema' && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--blush-light)', color: 'var(--slate)', fontSize: 13, lineHeight: 1.6 }}>
          <p style={{ marginBottom: 12 }}>Your keys work and the connection is live — you just need to create the tables. Two files, one Supabase SQL Editor tab:</p>
          <Step n={1}>
            Open your Supabase project → <em>SQL Editor</em> → paste the contents of <code style={code}>supabase_schema.sql</code> (parent Tech Vista tables) → Run.
          </Step>
          <Step n={2}>
            New query tab → paste <code style={code}>campus/schema.sql</code> (campus vertical tables + RLS + pgvector indexes) → Run.
          </Step>
          <Step n={3}>
            Reload this page. Real persistence is now live — you can create a college, upload resumes, and the chatbot's session memory will survive restarts.
          </Step>
        </div>
      )}
      {expanded && state === 'needs_env' && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--blush-light)', color: 'var(--slate)', fontSize: 13, lineHeight: 1.6 }}>
          <p style={{ marginBottom: 10 }}>
            Demo mode works without any setup. To create real colleges, ingest resumes, or persist chat sessions, you need a free Supabase project (~5 minutes).
          </p>
          <Step n={1}>
            Create a free project at{' '}
            <a href="https://supabase.com" target="_blank" rel="noreferrer" style={link}>supabase.com <ExternalLink size={11} /></a>
          </Step>
          <Step n={2}>
            In the SQL Editor, run <code style={code}>supabase_schema.sql</code> (parent Tech Vista tables) then <code style={code}>campus/schema.sql</code> (campus tables).
          </Step>
          <Step n={3}>
            Copy <code style={code}>Project URL</code> and <code style={code}>anon key</code> from <em>Project Settings → API</em>.
          </Step>
          <Step n={4}>
            Paste into <code style={code}>.env</code> at repo root:
            <pre style={{ background: 'var(--cream-mid)', padding: 10, borderRadius: 6, fontSize: 12, marginTop: 6, overflowX: 'auto' }}>
{`SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...`}
            </pre>
          </Step>
          <Step n={5}>Restart the backend and this banner disappears.</Step>
        </div>
      )}
    </div>
  )
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
      <span style={{
        width: 18, height: 18, borderRadius: 9, background: 'var(--blush-light)', color: 'var(--blush)',
        fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontWeight: 500, marginTop: 1,
      }}>{n}</span>
      <div>{children}</div>
    </div>
  )
}

const code = { background: 'var(--cream-mid)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 12 }
const link = { color: 'var(--sage-dim)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 2 }
