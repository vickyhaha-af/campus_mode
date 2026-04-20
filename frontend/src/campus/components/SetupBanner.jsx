import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import campus from '../api'

/**
 * Shows a friendly "setup needed" banner when Supabase is not configured.
 * Pings the /api/campus/colleges endpoint and checks for 503. If OK, hides.
 * In demo mode, stays hidden (demo doesn't need Supabase).
 */
export default function SetupBanner() {
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('campus_demo_mode') === '1'
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
          setState('ok')
        }
      }
    })()
  }, [isDemo])

  if (state !== 'needs_env' && state !== 'needs_schema') return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, var(--blush-pale) 0%, var(--accent-warm-pale) 100%)',
        border: '1px solid rgba(196,117,106,0.25)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
          style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'var(--blush-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={15} color="var(--blush)" />
        </motion.div>
        <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, flex: 1 }}>
          {state === 'needs_schema'
            ? 'Supabase connected — tables missing. Run campus/schema.sql to finish setup.'
            : 'Supabase not configured — set it up to enable real persistence.'}
        </span>
        <button
          className="btn-ghost"
          style={{ padding: 6, fontSize: 12 }}
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: 14, paddingTop: 14,
              borderTop: '1px solid rgba(196,117,106,0.25)',
              color: 'var(--slate)', fontSize: 13, lineHeight: 1.7,
            }}>
              {state === 'needs_schema' && (
                <>
                  <p style={{ marginBottom: 12 }}>
                    Your keys work and the connection is live — you just need to create the tables. Two files, one Supabase SQL Editor tab:
                  </p>
                  <Step n={1}>Open Supabase → <em>SQL Editor</em> → paste <code style={code}>supabase_schema.sql</code> → Run.</Step>
                  <Step n={2}>New query tab → paste <code style={code}>campus/schema.sql</code> → Run.</Step>
                  <Step n={3}>Reload. Real persistence is now live.</Step>
                </>
              )}
              {state === 'needs_env' && (
                <>
                  <p style={{ marginBottom: 10 }}>
                    Demo mode works without any setup. To create real colleges, ingest resumes, or persist chat sessions, you need a free Supabase project (~5 minutes).
                  </p>
                  <Step n={1}>
                    Create a free project at{' '}
                    <a href="https://supabase.com" target="_blank" rel="noreferrer" style={link}>
                      supabase.com <ExternalLink size={11} />
                    </a>
                  </Step>
                  <Step n={2}>In SQL Editor, run <code style={code}>supabase_schema.sql</code> then <code style={code}>campus/schema.sql</code>.</Step>
                  <Step n={3}>Copy <code style={code}>Project URL</code> and <code style={code}>anon key</code> from <em>Project Settings → API</em>.</Step>
                  <Step n={4}>
                    Paste into <code style={code}>.env</code>:
                    <pre style={{
                      background: 'var(--cream-mid)', padding: 10, borderRadius: 8,
                      fontSize: 12, marginTop: 6, overflowX: 'auto',
                      fontFamily: 'var(--font-mono)',
                    }}>
{`SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...`}
                    </pre>
                  </Step>
                  <Step n={5}>Restart the backend and this banner disappears.</Step>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'var(--blush)', color: '#fff',
        fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>{n}</span>
      <div>{children}</div>
    </div>
  )
}

const code = {
  background: 'var(--cream-mid)',
  padding: '2px 6px',
  borderRadius: 4,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink)',
  border: '1px solid var(--border)',
}
const link = {
  color: 'var(--sage-dim)', fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', gap: 3,
  textDecoration: 'none',
  borderBottom: '1.5px solid var(--sage-light)',
}
