import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Loader, AlertTriangle, MessageSquareText, Info,
  Briefcase, Filter, Compass, Copy, BookmarkPlus, CheckCircle2, Command,
} from 'lucide-react'
import {
  createChatSession, streamChat, listDrives, bulkShortlist,
} from '../api'
import CampusNav from '../components/CampusNav'
import CandidateCard from '../components/chat/CandidateCard'
import ToolCallBadge from '../components/chat/ToolCallBadge'
import MarkdownMessage, {
  parseCandidatesFromMarkdown, looksLikeRankingResponse,
} from '../components/chat/MarkdownMessage'

// ---------- sample queries (empty state) ----------

const QUERY_SECTIONS = [
  {
    key: 'drive',
    label: 'By drive',
    icon: Briefcase,
    accent: 'var(--sage)',
    bg: 'var(--sage-light)',
    queries: [
      'Top 5 candidates for the Goldman Quant Analyst drive',
      'Who would fit an ML Engineer role at Microsoft?',
      'Rank students by fit for a backend engineer role in Gurgaon',
      'Compare my top 3 picks against the JD requirements',
    ],
  },
  {
    key: 'filter',
    label: 'By filter',
    icon: Filter,
    accent: 'var(--accent-experience)',
    bg: 'rgba(123,143,168,0.10)',
    queries: [
      'Find unplaced CS students with CGPA above 8.5 and no backlogs',
      'Students with React and Node who have shipped projects',
      'CSE final-year with strong data science signal',
    ],
  },
  {
    key: 'explore',
    label: 'Just exploring',
    icon: Compass,
    accent: 'var(--accent-education)',
    bg: 'rgba(179,150,114,0.12)',
    queries: [
      'Who are my most versatile students this year?',
      'Surprise me — who is an under-the-radar strong candidate?',
      'Which passion areas are most represented in CSE?',
    ],
  },
]

// ---------- page ----------

export default function ChatPage() {
  const collegeId = typeof window !== 'undefined' ? localStorage.getItem('campus_college_id') : null
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])   // see shapes below
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [drives, setDrives] = useState([])
  const [pinnedDriveId, setPinnedDriveId] = useState(null)
  const [err, setErr] = useState('')
  const [fallbackActive, setFallbackActive] = useState(false)
  const abortRef = useRef(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // ---- boot ----
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

  // ---- auto scroll ----
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy])

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e) => {
      // "/" to focus input (unless already focused in an input/textarea)
      const tag = (e.target?.tagName || '').toLowerCase()
      const inField = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable
      if (e.key === '/' && !inField) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- send ----
  const send = (rawText) => {
    const text = (rawText || '').trim()
    if (!text || !sessionId || busy) return
    setErr('')
    setBusy(true)
    setFallbackActive(false)

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')

    abortRef.current = streamChat(
      { session_id: sessionId, message: text, college_id: collegeId, drive_context_id: pinnedDriveId },
      (ev) => {
        if (ev.type === 'user_message') return
        if (ev.type === 'fallback_triggered') {
          setFallbackActive(true)
          return
        }
        if (ev.type === 'thinking') {
          setMessages((prev) => {
            // Replace any existing transient thinking row
            const pruned = prev.filter((m) => !m.transient)
            return [...pruned, { role: 'thinking', iteration: ev.iteration, transient: true }]
          })
        } else if (ev.type === 'tool_call') {
          setMessages((prev) => {
            const pruned = prev.filter((m) => !m.transient)
            return [...pruned, { role: 'tool_call', name: ev.name, args: ev.args || {} }]
          })
        } else if (ev.type === 'tool_result') {
          setMessages((prev) => {
            // Attach to the latest matching pending tool_call
            const idx = [...prev].reverse().findIndex(
              (m) => m.role === 'tool_call' && m.name === ev.name && m.result === undefined
            )
            if (idx === -1) {
              return [...prev, { role: 'tool_call', name: ev.name, args: {}, result: ev.result }]
            }
            const realIdx = prev.length - 1 - idx
            const updated = [...prev]
            updated[realIdx] = { ...updated[realIdx], result: ev.result }

            // Surface semantic_rank results immediately as live candidate cards
            if (ev.name === 'semantic_rank' && Array.isArray(ev.result?.ranked)) {
              updated.push({
                role: 'live_cards',
                ranked: ev.result.ranked,
                source: 'semantic_rank',
              })
            }
            return updated
          })
        } else if (ev.type === 'assistant_message') {
          setMessages((prev) => {
            const pruned = prev.filter((m) => !m.transient)
            return [...pruned, {
              role: 'assistant',
              content: ev.content,
              fallback: ev.fallback === true || fallbackActive,
            }]
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

  const onSubmit = (e) => { e.preventDefault(); send(input) }

  // Cmd/Ctrl + Enter also sends (input is just a single <input>, but we keep parity with multi-line plans)
  const onInputKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send(input)
    }
  }

  if (!collegeId) return <RequireCollege />

  const pinnedDrive = drives.find((d) => d.id === pinnedDriveId)
  const empty = messages.length === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
      <CampusNav />

      {/* Sub-header */}
      <div style={{
        background: 'var(--white)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 14,
        flexWrap: 'wrap',
      }}>
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
          <span title="Gemini unavailable — using deterministic fallback plan" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: 'var(--accent-education)',
            background: 'var(--cream-deep)',
            padding: '3px 8px', borderRadius: 'var(--radius-pill)',
          }}>
            <Info size={10} /> fallback mode
          </span>
        )}
      </div>

      {/* Message stream */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '28px 20px 160px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {err && (
            <div style={errorBox}>
              <AlertTriangle size={14} /> {err}
            </div>
          )}

          {empty && !busy && (
            <EmptyChat drives={drives} pinnedDrive={pinnedDrive} onPick={(q) => send(q)} />
          )}

          <MessageList
            messages={messages}
            busy={busy}
            pinnedDriveId={pinnedDriveId}
          />
        </div>
      </div>

      {/* Sticky input */}
      <ChatInput
        ref={inputRef}
        value={input}
        setValue={setInput}
        onSubmit={onSubmit}
        onKey={onInputKey}
        busy={busy}
        disabled={!sessionId}
        pinnedDrive={pinnedDrive}
      />

      <style>{CSS}</style>
    </div>
  )
}

// ---------- message list ----------

function MessageList({ messages, busy, pinnedDriveId }) {
  return (
    <AnimatePresence initial={false}>
      {messages.map((m, i) => (
        <motion.div
          key={`${i}-${m.role}`}
          layout
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{
            duration: 0.28,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ marginBottom: 16 }}
        >
          {m.role === 'user' && <UserBubble text={m.content} />}
          {m.role === 'assistant' && (
            <AssistantBubble
              text={m.content}
              fallback={m.fallback}
              pinnedDriveId={pinnedDriveId}
            />
          )}
          {m.role === 'thinking' && <ThinkingRow iteration={m.iteration} />}
          {m.role === 'tool_call' && (
            <ToolCallBadge name={m.name} args={m.args} result={m.result} />
          )}
          {m.role === 'live_cards' && (
            <LiveCandidateCards ranked={m.ranked} source={m.source} />
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

// ---------- user bubble ----------

function UserBubble({ text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        background: 'var(--sage)',
        color: 'var(--white)',
        padding: '10px 16px',
        borderRadius: 18,
        borderTopRightRadius: 6,
        maxWidth: '78%',
        fontSize: 14.5,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        boxShadow: '0 1px 2px rgba(74,124,111,0.25)',
      }}>
        {text}
      </div>
    </div>
  )
}

// ---------- assistant bubble ----------

function AssistantBubble({ text, fallback, pinnedDriveId }) {
  const parsedCandidates = useMemo(() => {
    if (!looksLikeRankingResponse(text)) return null
    return parseCandidatesFromMarkdown(text)
  }, [text])

  const [copied, setCopied] = useState(false)
  const [shortlisted, setShortlisted] = useState(false)
  const [shortlistErr, setShortlistErr] = useState('')

  const candidateNames = parsedCandidates?.map((c) => c.name).filter(Boolean) || []
  const candidateIds = parsedCandidates?.map((c) => c.id).filter(Boolean) || []

  const onCopy = async () => {
    const joined = candidateNames.join(', ')
    try {
      await navigator.clipboard.writeText(joined)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }

  const onShortlist = async () => {
    if (!pinnedDriveId || candidateIds.length === 0) return
    try {
      await bulkShortlist(pinnedDriveId, candidateIds)
      setShortlisted(true)
      setTimeout(() => setShortlisted(false), 2200)
    } catch (e) {
      setShortlistErr(e.response?.data?.detail || e.message || 'Failed to shortlist')
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <AvatarMark />
      <div style={{ flex: 1, minWidth: 0 }}>
        {fallback && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10.5, fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-education)',
            background: 'rgba(179,150,114,0.15)',
            border: '1px solid rgba(179,150,114,0.3)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            marginBottom: 8,
          }}>
            <Info size={10} /> Deterministic mode
          </div>
        )}

        {/* Rich candidate cards (parsed from markdown) */}
        {parsedCandidates && parsedCandidates.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {parsedCandidates.map((c, i) => {
              const raw = Number(c.fit_score) || 0
              // Normalize: scores often come as 0-100 already, but some backends
              // emit 0-40ish. Treat >60 as 0-100 scale; otherwise scale x2 for ring.
              const normalized = raw >= 60 ? raw : Math.min(100, raw * 2)
              return (
                <CandidateCard
                  key={`${c.name}-${i}`}
                  candidate={c}
                  index={i}
                  normalizedScore={normalized}
                />
              )
            })}
          </div>
        ) : (
          <div style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-card)',
          }}>
            <MarkdownMessage source={text} />
          </div>
        )}

        {/* Action row */}
        {parsedCandidates && parsedCandidates.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginTop: 4, flexWrap: 'wrap',
          }}>
            <ActionButton
              icon={copied ? CheckCircle2 : Copy}
              label={copied ? 'Copied' : 'Copy shortlist'}
              onClick={onCopy}
              tone={copied ? 'success' : 'default'}
              disabled={candidateNames.length === 0}
            />
            {pinnedDriveId && candidateIds.length > 0 && (
              <ActionButton
                icon={shortlisted ? CheckCircle2 : BookmarkPlus}
                label={shortlisted ? 'Added to shortlist' : 'Add to drive shortlist'}
                onClick={onShortlist}
                tone={shortlisted ? 'success' : 'primary'}
              />
            )}
            <span style={{ fontSize: 11, color: 'var(--slate-mid)', marginLeft: 'auto' }}>
              {parsedCandidates.length} candidate{parsedCandidates.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
        {shortlistErr && (
          <div style={{ fontSize: 11, color: 'var(--blush)', marginTop: 6 }}>
            {shortlistErr}
          </div>
        )}

        {/* If we rendered cards, still show the assistant's full prose below (collapsible) */}
        {parsedCandidates && parsedCandidates.length > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600,
              color: 'var(--slate-mid)',
              letterSpacing: '0.04em',
              userSelect: 'none',
            }}>
              Show original text
            </summary>
            <div style={{
              marginTop: 8,
              background: 'var(--cream-mid)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 16px',
            }}>
              <MarkdownMessage source={text} />
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function AvatarMark() {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'linear-gradient(135deg, var(--sage-light), var(--sage-pale))',
        border: '1px solid rgba(74,124,111,0.22)',
        color: 'var(--sage-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Sparkles size={15} />
    </motion.div>
  )
}

// ---------- live cards from tool_result ----------

function LiveCandidateCards({ ranked }) {
  const candidates = (ranked || []).map((r) => {
    const s = r.student || {}
    return {
      id: s.id,
      name: s.name,
      branch: s.branch,
      year: s.year,
      cgpa: s.cgpa,
      top_role: s.top_role || r.top_role,
      fit_score: r.fit_score,
      skills: s.skills || s.top_skills || [],
      rationale: r.rationale || r.reason || '',
      signals: r.signals,
    }
  })
  if (candidates.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 32, flexShrink: 0 }} />  {/* avatar spacer */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10.5, fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--sage)',
          marginBottom: 8,
        }}>
          <Sparkles size={10} /> Live ranking
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {candidates.slice(0, 10).map((c, i) => {
            const raw = Number(c.fit_score) || 0
            const normalized = raw >= 60 ? raw : Math.min(100, raw * 2)
            return (
              <CandidateCard
                key={c.id || `${c.name}-${i}`}
                candidate={c}
                index={i}
                normalizedScore={normalized}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------- thinking shimmer ----------

function ThinkingRow({ iteration }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingLeft: 0 }}>
      <AvatarMark />
      <div style={{
        position: 'relative',
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '8px 16px',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        <motion.span
          aria-hidden
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, width: '50%',
            background: 'linear-gradient(90deg, transparent, rgba(74,124,111,0.12), transparent)',
          }}
        />
        <ThinkDot delay={0} />
        <ThinkDot delay={0.15} />
        <ThinkDot delay={0.3} />
        <span style={{
          fontSize: 12.5,
          color: 'var(--slate)',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.02em',
          position: 'relative',
        }}>
          Thinking{iteration > 1 ? ` · step ${iteration}` : ''}
        </span>
      </div>
    </div>
  )
}

function ThinkDot({ delay }) {
  return (
    <motion.span
      animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 0.9, repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--sage)',
        display: 'inline-block',
        position: 'relative',
      }}
    />
  )
}

// ---------- action button ----------

function ActionButton({ icon: Icon, label, onClick, tone = 'default', disabled }) {
  const palette = tone === 'success' ? {
    bg: 'var(--moss-light)', color: 'var(--moss)',
    border: 'rgba(94,122,82,0.25)',
  } : tone === 'primary' ? {
    bg: 'var(--sage)', color: 'var(--white)', border: 'var(--sage)',
  } : {
    bg: 'var(--white)', color: 'var(--slate)', border: 'var(--border)',
  }
  return (
    <motion.button
      type="button"
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 12px',
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        borderRadius: 'var(--radius-btn)',
        fontSize: 12.5, fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {Icon && <Icon size={13} />}
      {label}
    </motion.button>
  )
}

// ---------- empty state ----------

function EmptyChat({ drives, pinnedDrive, onPick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '28px 0 60px' }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--sage-light), var(--sage-pale))',
            border: '1px solid rgba(74,124,111,0.22)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
            color: 'var(--sage-dim)',
          }}
        >
          <motion.div
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles size={22} />
          </motion.div>
        </motion.div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28, fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '-0.5px',
          marginBottom: 8,
        }}>
          Who would you like to find?
        </h2>
        <p style={{
          color: 'var(--slate)',
          fontSize: 14.5,
          lineHeight: 1.55,
          maxWidth: 520, margin: '0 auto',
        }}>
          Ask naturally. The agent searches, ranks, checks eligibility, and
          explains fit — then hands you candidate cards you can act on.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 18, maxWidth: 720, margin: '0 auto' }}>
        {QUERY_SECTIONS.map((sec, i) => (
          <QuerySection
            key={sec.key}
            section={sec}
            onPick={onPick}
            index={i}
          />
        ))}
      </div>

      {!pinnedDrive && drives.length > 0 && (
        <p style={{
          fontSize: 12,
          color: 'var(--slate-mid)',
          marginTop: 24,
          textAlign: 'center',
        }}>
          Tip: pin a drive from the dropdown above to skip JD pasting.
        </p>
      )}
    </motion.div>
  )
}

function QuerySection({ section, onPick, index }) {
  const { label, icon: Icon, accent, bg, queries } = section
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 + index * 0.08 }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8,
        fontSize: 11, fontWeight: 600,
        letterSpacing: '0.1em',
        color: 'var(--slate-mid)',
        textTransform: 'uppercase',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: bg,
          color: accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={12} />
        </span>
        {label}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {queries.map((q, j) => (
          <motion.button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            whileHover={{ y: -1, borderColor: accent }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, delay: 0.2 + index * 0.08 + j * 0.04 }}
            style={{
              padding: '11px 14px',
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14, color: 'var(--ink-soft)',
              fontFamily: 'var(--font-sans)',
              textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 10,
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: accent,
              flexShrink: 0,
            }} />
            {q}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

// ---------- sticky input bar ----------

const ChatInput = React.forwardRef(function ChatInput(
  { value, setValue, onSubmit, onKey, busy, disabled, pinnedDrive },
  ref,
) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      position: 'sticky', bottom: 0,
      padding: '14px 20px 18px',
      background: 'linear-gradient(to bottom, rgba(250,248,244,0) 0%, var(--cream) 28%)',
      pointerEvents: 'none',
      zIndex: 5,
    }}>
      <form
        onSubmit={onSubmit}
        style={{
          maxWidth: 820,
          margin: '0 auto',
          display: 'flex', gap: 10,
          background: 'var(--white)',
          border: `1px solid ${focused ? 'var(--sage)' : 'var(--border)'}`,
          borderRadius: 14,
          padding: '8px 8px 8px 14px',
          boxShadow: focused ? 'var(--shadow-elevated)' : 'var(--shadow-card)',
          transition: 'border-color 0.18s, box-shadow 0.18s',
          pointerEvents: 'auto',
          alignItems: 'center',
        }}
      >
        <motion.span
          animate={busy || value
            ? { opacity: 0.35, scale: 0.9 }
            : { opacity: [0.5, 1, 0.5], scale: [1, 1.08, 1] }}
          transition={busy || value
            ? { duration: 0.2 }
            : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display: 'inline-flex', alignItems: 'center',
            color: 'var(--sage)',
          }}
        >
          <Sparkles size={15} />
        </motion.span>
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKey}
          placeholder={pinnedDrive
            ? `Ask about fits for ${pinnedDrive.role}…`
            : 'Ask about students, rank, filter, or paste a JD…'}
          disabled={busy || disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14.5,
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink)',
            padding: '8px 4px',
          }}
        />
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--slate-light)',
          padding: '3px 6px',
          border: '1px solid var(--border)',
          borderRadius: 5,
          userSelect: 'none',
        }} title="Cmd/Ctrl+Enter to send · / to focus">
          <Command size={9} /> ↵
        </span>
        <motion.button
          type="submit"
          whileHover={{ scale: busy || !value.trim() ? 1 : 1.04 }}
          whileTap={{ scale: 0.95 }}
          disabled={busy || !value.trim() || disabled}
          style={{
            background: busy || !value.trim() ? 'var(--cream-deep)' : 'var(--sage)',
            color: busy || !value.trim() ? 'var(--slate-light)' : 'var(--white)',
            border: 'none',
            borderRadius: 10,
            padding: '0 14px',
            height: 36,
            cursor: busy || !value.trim() ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          {busy ? <Loader size={14} className="cv-spin" /> : <Send size={14} />}
        </motion.button>
      </form>
    </div>
  )
})

// ---------- require college ----------

function RequireCollege() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <Link to="/campus/setup" style={{
        background: 'var(--sage)', color: 'var(--white)',
        padding: '10px 16px', borderRadius: 8, textDecoration: 'none',
      }}>
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

// ---------- styles ----------

const selectStyle = {
  padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6,
  fontSize: 13, background: 'var(--cream)', color: 'var(--ink)',
  fontFamily: 'var(--font-sans)',
}

const errorBox = {
  background: 'var(--blush-light)', color: 'var(--blush)',
  padding: 10, borderRadius: 8,
  display: 'flex', gap: 8, alignItems: 'center',
  marginBottom: 16, fontSize: 13,
  border: '1px solid rgba(196,117,106,0.25)',
}

const CSS = `
.cv-spin { animation: cv-spin 1.2s linear infinite; }
@keyframes cv-spin { to { transform: rotate(360deg); } }
`
