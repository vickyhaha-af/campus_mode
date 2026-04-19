import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Loader, Wrench, AlertTriangle, MessageSquareText,
  Search, BarChart3, CheckCircle, FileText, User, Info,
} from 'lucide-react'
import { createChatSession, streamChat, listDrives } from '../api'
import CampusNav from '../components/CampusNav'

const SAMPLE_QUERIES = [
  'Top 5 candidates for the Goldman Quant Analyst drive',
  'Who would fit an ML Engineer role at Microsoft?',
  'Rank students by fit for a backend engineer role in Gurgaon',
  'Find unplaced CS students with CGPA above 8.5 and no backlogs',
]

const TOOL_META = {
  search_students:    { icon: Search,     label: 'Searching students',  color: 'var(--sage)' },
  semantic_rank:      { icon: BarChart3,  label: 'Ranking candidates',  color: 'var(--accent-experience)' },
  fetch_drive:        { icon: FileText,   label: 'Loading drive',       color: 'var(--accent-education)' },
  check_eligibility:  { icon: CheckCircle, label: 'Checking eligibility', color: 'var(--moss)' },
  get_student_profile:{ icon: User,       label: 'Fetching profile',    color: 'var(--slate)' },
  explain_fit:        { icon: Sparkles,   label: 'Analysing fit',       color: 'var(--sage-dim)' },
}

export default function ChatPage() {
  const collegeId = localStorage.getItem('campus_college_id')
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])   // { role, content, tool_calls?, tool_result? }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [drives, setDrives] = useState([])
  const [pinnedDriveId, setPinnedDriveId] = useState(null)
  const [err, setErr] = useState('')
  const [fallbackActive, setFallbackActive] = useState(false)
  const abortRef = useRef(null)
  const scrollRef = useRef(null)

  // Bootstrap: load drives, create chat session
  useEffect(() => {
    if (!collegeId) return
    ;(async () => {
      try {
        const [dRes, sRes] = await Promise.all([
          listDrives({ college_id: collegeId }),
          createChatSession(collegeId),
        ])
        setDrives(dRes.data || [])
        setSessionId(sRes.data.id)
      } catch (e) {
        setErr(e.response?.data?.detail || e.message || 'Failed to start chat')
      }
    })()
  }, [collegeId])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy])

  const send = (text) => {
    if (!text.trim() || !sessionId || busy) return
    setErr('')
    setBusy(true)
    setFallbackActive(false)

    // Optimistically append the user message
    setMessages((prev) => [...prev, { role: 'user', content: text.trim() }])
    setInput('')

    abortRef.current = streamChat(
      { session_id: sessionId, message: text.trim(), college_id: collegeId, drive_context_id: pinnedDriveId },
      (ev) => {
        if (ev.type === 'user_message') return  // already optimistically added
        if (ev.type === 'fallback_triggered') {
          setFallbackActive(true)
          return
        }
        if (ev.type === 'thinking') {
          setMessages((prev) => [...prev, { role: 'thinking', iteration: ev.iteration, transient: true }])
        } else if (ev.type === 'tool_call') {
          setMessages((prev) => {
            const pruned = prev.filter((m) => !m.transient)
            return [...pruned, { role: 'tool_call', name: ev.name, args: ev.args }]
          })
        } else if (ev.type === 'tool_result') {
          setMessages((prev) => {
            const idx = [...prev].reverse().findIndex((m) => m.role === 'tool_call' && m.name === ev.name && !m.result)
            if (idx === -1) return [...prev, { role: 'tool_result', name: ev.name, result: ev.result }]
            const realIdx = prev.length - 1 - idx
            const updated = [...prev]
            updated[realIdx] = { ...updated[realIdx], result: ev.result }
            return updated
          })
        } else if (ev.type === 'assistant_message') {
          setMessages((prev) => {
            const pruned = prev.filter((m) => !m.transient)
            return [...pruned, { role: 'assistant', content: ev.content }]
          })
        } else if (ev.type === 'error') {
          setErr(ev.message || 'Agent error')
          setMessages((prev) => prev.filter((m) => !m.transient))
        } else if (ev.type === 'done') {
          setBusy(false)
          setMessages((prev) => prev.filter((m) => !m.transient))
        }
      }
    )
  }

  if (!collegeId) return <RequireCollege />

  const pinnedDrive = drives.find((d) => d.id === pinnedDriveId)
  const empty = messages.length === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
      <CampusNav />

      {/* Sub-header: drive context pin + fallback badge */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <MessageSquareText size={14} color="var(--sage)" />
        <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>Matching chat</span>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: 'var(--slate-mid)' }}>Pin drive:</label>
        <select
          value={pinnedDriveId || ''}
          onChange={(e) => setPinnedDriveId(e.target.value || null)}
          style={selectStyle}
        >
          <option value="">— none —</option>
          {drives.map((d) => (
            <option key={d.id} value={d.id}>{d.role}</option>
          ))}
        </select>
        {fallbackActive && (
          <span title="Gemini unavailable — using deterministic fallback plan"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent-education)', background: 'var(--cream-deep)', padding: '3px 8px', borderRadius: 'var(--radius-pill)' }}>
            <Info size={10} /> fallback mode
          </span>
        )}
      </div>

      {/* Message list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {err && (
            <div style={errorBox}>
              <AlertTriangle size={14} /> {err}
            </div>
          )}

          {empty && !busy && (
            <EmptyChat drives={drives} pinnedDrive={pinnedDrive} onPick={(q) => send(q)} />
          )}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                style={{ marginBottom: 14 }}
              >
                {m.role === 'user' && <UserBubble text={m.content} />}
                {m.role === 'assistant' && <AssistantBubble text={m.content} />}
                {m.role === 'thinking' && <ThinkingRow iteration={m.iteration} />}
                {m.role === 'tool_call' && <ToolRow name={m.name} args={m.args} result={m.result} />}
                {m.role === 'tool_result' && <ToolRow name={m.name} args={{}} result={m.result} />}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Input */}
      <div style={inputBar}>
        <form onSubmit={(e) => { e.preventDefault(); send(input) }} style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={pinnedDrive
              ? `Ask about fits for ${pinnedDrive.role}…`
              : 'Ask about students, rank, filter, or paste a JD…'}
            disabled={busy || !sessionId}
            style={{ ...textInput, flex: 1 }}
          />
          <button type="submit" disabled={busy || !input.trim() || !sessionId} style={sendBtn(busy || !input.trim())}>
            {busy ? <Loader size={14} className="spin" /> : <Send size={14} />}
          </button>
        </form>
      </div>

      <style>{`.spin { animation: spin 1.2s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ background: 'var(--sage)', color: 'var(--white)', padding: '10px 14px', borderRadius: 16, maxWidth: '78%', fontSize: 14, whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({ text }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--sage-light)', color: 'var(--sage-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Sparkles size={14} />
      </div>
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', color: 'var(--ink)', padding: '12px 16px', borderRadius: 12, maxWidth: '85%', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        {text}
      </div>
    </div>
  )
}

function ThinkingRow({ iteration }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--slate-mid)', fontSize: 13, paddingLeft: 38 }}>
      <Loader size={12} className="spin" /> thinking{iteration > 1 ? ` (step ${iteration})` : ''}…
    </div>
  )
}

function ToolRow({ name, args, result }) {
  const meta = TOOL_META[name] || { icon: Wrench, label: name, color: 'var(--slate)' }
  const Icon = meta.icon
  const [expanded, setExpanded] = useState(false)
  const hasResult = result && Object.keys(result).length > 0
  const isError = result?.error
  const summary = result
    ? (isError ? `error: ${result.error}` : summariseToolResult(name, result))
    : 'running…'

  return (
    <div style={{ paddingLeft: 38 }}>
      <div
        onClick={() => hasResult && setExpanded(!expanded)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', background: 'var(--cream-mid)', borderRadius: 8,
          fontSize: 12, color: 'var(--slate)',
          cursor: hasResult ? 'pointer' : 'default',
          border: `1px solid ${isError ? 'var(--blush-light)' : 'transparent'}`,
        }}
      >
        <Icon size={12} color={isError ? 'var(--blush)' : meta.color} />
        <span style={{ fontWeight: 500, color: isError ? 'var(--blush)' : 'var(--ink-soft)' }}>{meta.label}</span>
        <span style={{ color: isError ? 'var(--blush)' : 'var(--slate-mid)' }}>· {summary}</span>
      </div>
      {expanded && hasResult && (
        <pre style={{ marginTop: 6, background: 'var(--cream-mid)', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', maxHeight: 240, fontFamily: 'var(--font-mono)' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

function summariseToolResult(name, r) {
  if (name === 'search_students' && r.count !== undefined) {
    const w = r.warnings?.length ? ' ⚠' : ''
    return `${r.count} match${r.count === 1 ? '' : 'es'}${w}`
  }
  if (name === 'semantic_rank' && r.ranked) {
    return `top fit: ${r.ranked[0]?.student?.name || '?'} (${r.ranked[0]?.fit_score})`
  }
  if (name === 'fetch_drive' && r.role) {
    return r.role
  }
  if (name === 'check_eligibility') {
    return r.eligible ? 'eligible ✓' : `${r.violations?.length || 0} violation(s)`
  }
  if (name === 'get_student_profile' && r.name) {
    return r.name
  }
  if (name === 'explain_fit' && r.signals) {
    return `${r.signals.skill_overlap_with_jd?.length || 0} skill matches`
  }
  return 'done'
}

function EmptyChat({ drives, pinnedDrive, onPick }) {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <Sparkles size={28} color="var(--sage)" style={{ margin: '0 auto 12px' }} />
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginBottom: 10 }}>
        Who would you like to find?
      </h2>
      <p style={{ color: 'var(--slate)', marginBottom: 28, fontSize: 14 }}>
        Ask naturally. The agent uses tools (search / rank / check eligibility / explain) to find fits.
      </p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 560, margin: '0 auto' }}>
        {SAMPLE_QUERIES.map((q) => (
          <button key={q} onClick={() => onPick(q)} style={sampleBtn}>
            {q}
          </button>
        ))}
      </div>
      {!pinnedDrive && drives.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--slate-mid)', marginTop: 20 }}>
          Tip: pin a drive context from the dropdown above to skip JD pasting.
        </p>
      )}
    </div>
  )
}

function RequireCollege() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <Link to="/campus/setup" style={{ background: 'var(--sage)', color: 'var(--white)', padding: '10px 16px', borderRadius: 8, textDecoration: 'none' }}>
        Set up college first →
      </Link>
      <div style={{ marginTop: 12 }}>
        <Link to="/campus" style={{ color: 'var(--slate)', fontSize: 13 }}>
          …or try demo mode from the campus landing page
        </Link>
      </div>
    </div>
  )
}

const headerBar = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 20px', background: 'var(--white)', borderBottom: '1px solid var(--border)',
  position: 'sticky', top: 0, zIndex: 10,
}
const inputBar = {
  padding: '14px 20px', background: 'var(--white)', borderTop: '1px solid var(--border)',
  position: 'sticky', bottom: 0,
}
const textInput = {
  padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)',
  fontSize: 14, background: 'var(--cream)', color: 'var(--ink)', outline: 'none',
  fontFamily: 'var(--font-sans)',
}
const selectStyle = {
  padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6,
  fontSize: 13, background: 'var(--cream)', color: 'var(--ink)',
}
const sampleBtn = {
  padding: '10px 16px', background: 'var(--white)', border: '1px solid var(--border)',
  borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--ink)',
  textAlign: 'left',
  transition: 'border-color 0.15s',
}
const sendBtn = (disabled) => ({
  background: disabled ? 'var(--slate-light)' : 'var(--sage)', color: 'var(--white)',
  border: 'none', padding: '0 18px', borderRadius: 'var(--radius-btn)',
  cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
})
const errorBox = {
  background: 'var(--blush-light)', color: 'var(--blush)', padding: 10, borderRadius: 8,
  display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, fontSize: 13,
}
