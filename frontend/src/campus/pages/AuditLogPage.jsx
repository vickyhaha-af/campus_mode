import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, ShieldAlert, Search, Download, RefreshCw,
  ChevronDown, ChevronRight, Filter, X, Hash,
} from 'lucide-react'
import CampusNav from '../components/CampusNav'
import { listAuditLog, verifyAuditChain, listAuditActions } from '../api'

const PAGE_SIZE = 25

function ChainStatusBanner({ verifying, result }) {
  if (verifying) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 12,
        background: 'var(--cream-mid)', border: '1px solid var(--border)',
        color: 'var(--slate)', fontSize: 13,
      }}>
        <RefreshCw size={14} className="spin" />
        Verifying chain…
      </div>
    )
  }
  if (!result) return null
  const ok = result.valid
  const color = ok ? 'var(--moss)' : '#b03a3a'
  const bg = ok
    ? 'linear-gradient(135deg, rgba(74,124,111,0.08), rgba(74,124,111,0.02))'
    : 'linear-gradient(135deg, rgba(176,58,58,0.09), rgba(176,58,58,0.02))'
  const Icon = ok ? ShieldCheck : ShieldAlert
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px', borderRadius: 14,
        background: bg,
        border: `1px solid ${ok ? 'rgba(74,124,111,0.25)' : 'rgba(176,58,58,0.3)'}`,
        color,
      }}
    >
      <Icon size={20} strokeWidth={2} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.2 }}>
          {ok
            ? `Chain verified (${result.total_entries} entries)`
            : `Chain broken at entry #${result.broken_at}`}
        </div>
        <div style={{ fontSize: 12, color: 'var(--slate-mid)', marginTop: 2 }}>
          {ok
            ? 'Every entry\u2019s SHA-256 hash reconciles with the previous one.'
            : 'One or more entries disagree with their recomputed hash — tampering or data loss detected.'}
        </div>
      </div>
    </motion.div>
  )
}

function ActionBadge({ action }) {
  // Colour by action family
  const family = (
    action?.startsWith('drive')     ? 'drive' :
    action?.startsWith('shortlist') || action === 'bulk_shortlist' ? 'shortlist' :
    action?.startsWith('ingest')    ? 'ingest' :
    action?.startsWith('recruiter') ? 'recruiter' :
    action?.startsWith('chat')      ? 'chat' :
    'other'
  )
  const cfg = {
    drive:     { color: 'var(--accent-cool-dim)', bg: 'var(--accent-cool-light)' },
    shortlist: { color: 'var(--sage-dim)',        bg: 'var(--sage-light)'        },
    ingest:    { color: 'var(--accent-warm-dim)', bg: 'var(--accent-warm-light)' },
    recruiter: { color: '#6b4c93',                bg: 'rgba(107,76,147,0.09)'    },
    chat:      { color: 'var(--slate)',           bg: 'var(--cream-mid)'         },
    other:     { color: 'var(--slate)',           bg: 'var(--cream-mid)'         },
  }[family]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 'var(--radius-pill)',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
    }}>
      {action}
    </span>
  )
}

function EntryRow({ entry, index, expanded, onToggle }) {
  const when = useMemo(() => {
    const d = new Date(entry.timestamp)
    if (isNaN(d)) return entry.timestamp
    return d.toLocaleString()
  }, [entry.timestamp])
  const target = entry.target_type
    ? `${entry.target_type}${entry.target_id ? ` · ${String(entry.target_id).slice(0, 8)}…` : ''}`
    : '—'
  const actor = entry.user_id ? String(entry.user_id).slice(0, 8) + '…' : 'system'

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          borderTop: '1px solid var(--border)',
          background: expanded ? 'var(--cream-mid)' : 'transparent',
          transition: 'background 120ms',
        }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = 'rgba(74,124,111,0.04)' }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <td style={{ padding: '10px 12px', width: 32, color: 'var(--slate-mid)' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--slate-mid)', whiteSpace: 'nowrap' }}>
          #{index + 1}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--slate)', whiteSpace: 'nowrap' }}>
          {when}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <ActionBadge action={entry.action} />
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--slate)' }}>
          {actor}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--slate)', fontFamily: 'var(--font-mono, monospace)' }}>
          {target}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--slate-mid)', fontFamily: 'var(--font-mono, monospace)' }}>
          <Hash size={10} style={{ marginRight: 4, verticalAlign: -1 }} />
          {String(entry.entry_hash || '').slice(0, 10)}…
        </td>
      </tr>
      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={7} style={{ padding: 0, background: 'var(--cream-mid)', borderTop: '1px solid var(--border)' }}>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '14px 18px', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--slate-mid)' }}>entry_hash</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--slate)', wordBreak: 'break-all' }}>
                      {entry.entry_hash || '—'}
                    </span>
                    <span style={{ color: 'var(--slate-mid)' }}>prev_hash</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--slate)', wordBreak: 'break-all' }}>
                      {entry.prev_hash || '(genesis)'}
                    </span>
                    <span style={{ color: 'var(--slate-mid)' }}>target</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--slate)' }}>
                      {entry.target_type || '—'} / {entry.target_id || '—'}
                    </span>
                    <span style={{ color: 'var(--slate-mid)' }}>user_id</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--slate)' }}>
                      {entry.user_id || 'system'}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--slate-mid)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
                      details
                    </div>
                    <pre style={{
                      margin: 0, padding: 12, borderRadius: 8,
                      background: 'var(--white)', border: '1px solid var(--border)',
                      fontSize: 11.5, lineHeight: 1.55, color: 'var(--slate)',
                      overflow: 'auto', maxHeight: 280,
                      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                    }}>
                      {JSON.stringify(entry.details || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}

function toCSV(rows) {
  const cols = ['timestamp', 'action', 'target_type', 'target_id', 'user_id', 'entry_hash', 'prev_hash', 'details']
  const escape = (s) => {
    const v = (s === null || s === undefined) ? '' : String(s)
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const header = cols.join(',')
  const body = rows.map((r) => cols.map((c) =>
    escape(c === 'details' ? JSON.stringify(r.details || {}) : r[c])
  ).join(',')).join('\n')
  return header + '\n' + body + '\n'
}

export default function AuditLogPage() {
  const collegeId = typeof window !== 'undefined' ? localStorage.getItem('campus_college_id') : null

  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [actions, setActions] = useState([])
  const [actionType, setActionType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [q, setQ] = useState('')

  const [expanded, setExpanded] = useState(() => new Set())

  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)

  const loadActions = async () => {
    if (!collegeId) return
    try {
      const { data } = await listAuditActions(collegeId)
      setActions(data.actions || [])
    } catch { /* non-fatal */ }
  }

  const load = async ({ reset = true } = {}) => {
    if (!collegeId) return
    setLoading(true); setErr('')
    const newOffset = reset ? 0 : offset
    try {
      const filters = {
        college_id: collegeId,
        limit: PAGE_SIZE,
        offset: newOffset,
      }
      if (actionType) filters.action_type = actionType
      if (fromDate) filters.from = new Date(fromDate).toISOString()
      if (toDate)   filters.to   = new Date(toDate).toISOString()
      const { data } = await listAuditLog(filters)
      setTotal(data.total || 0)
      setEntries(reset ? (data.entries || []) : [...entries, ...(data.entries || [])])
      setOffset(newOffset + PAGE_SIZE)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    if (!collegeId) return
    setVerifying(true)
    try {
      const { data } = await verifyAuditChain(collegeId)
      setVerifyResult(data)
    } catch (e) {
      setVerifyResult({ valid: false, broken_at: null, total_entries: 0 })
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    loadActions()
    load({ reset: true })
    verify()
    // eslint-disable-next-line
  }, [])

  useEffect(() => {
    load({ reset: true })
    // eslint-disable-next-line
  }, [actionType, fromDate, toDate])

  const searched = useMemo(() => {
    if (!q) return entries
    const needle = q.toLowerCase()
    return entries.filter((e) => {
      const blob = JSON.stringify(e).toLowerCase()
      return blob.includes(needle)
    })
  }, [entries, q])

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const downloadCSV = () => {
    const csv = toCSV(searched)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_log_${collegeId?.slice(0, 8) || 'campus'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }

  const clearFilters = () => { setActionType(''); setFromDate(''); setToDate(''); setQ('') }
  const anyFilter = !!(actionType || fromDate || toDate || q)

  if (!collegeId) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <CampusNav />
        <div style={{ maxWidth: 720, margin: '80px auto', padding: 24, textAlign: 'center' }}>
          <h2 className="text-display" style={{ marginBottom: 12 }}>No college selected</h2>
          <p className="text-body">Pick a college (or load the demo) to see its audit trail.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 24 }}
        >
          <div className="text-eyebrow" style={{ marginBottom: 10 }}>Audit</div>
          <h1 className="text-display" style={{ marginBottom: 6 }}>
            Every action, <span className="text-display-italic">chained</span>.
          </h1>
          <p className="text-body" style={{ fontSize: 14.5 }}>
            Tamper-evident log of drives, shortlists, ingest jobs, recruiter tokens and chat responses.
          </p>
        </motion.div>

        {/* Chain integrity */}
        <div style={{ marginBottom: 18 }}>
          <ChainStatusBanner verifying={verifying} result={verifyResult} />
        </div>

        {/* Filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            boxShadow: 'var(--shadow-sm)',
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto auto auto',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--slate-mid)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="Search details, target, hash…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px',
                border: '1px solid var(--border)', borderRadius: 10,
                fontSize: 13, background: 'var(--cream-mid)',
              }}
            />
          </div>

          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--cream-mid)', fontSize: 12.5 }}
          >
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--cream-mid)', fontSize: 12.5 }}
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--cream-mid)', fontSize: 12.5 }}
          />

          {anyFilter && (
            <button onClick={clearFilters} className="btn-ghost" style={{ fontSize: 12, padding: '7px 10px' }}>
              <X size={12} /> Clear
            </button>
          )}

          <button
            onClick={downloadCSV}
            disabled={!searched.length}
            className="btn-secondary"
            style={{ fontSize: 12.5, padding: '7px 12px', opacity: searched.length ? 1 : 0.5 }}
          >
            <Download size={13} /> Export CSV
          </button>
        </motion.div>

        {err && (
          <div style={{
            padding: '10px 14px', marginBottom: 14, borderRadius: 10,
            background: 'rgba(176,58,58,0.08)', color: '#b03a3a',
            border: '1px solid rgba(176,58,58,0.25)', fontSize: 13,
          }}>
            {err}
          </div>
        )}

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          style={{
            background: 'var(--white)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--cream-mid)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', width: 32 }}></th>
                <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--slate-mid)', textTransform: 'uppercase', letterSpacing: 0.6 }}>#</th>
                <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--slate-mid)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Timestamp</th>
                <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--slate-mid)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Action</th>
                <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--slate-mid)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Actor</th>
                <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--slate-mid)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Target</th>
                <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--slate-mid)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Hash</th>
              </tr>
            </thead>
            <tbody>
              {searched.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--slate-mid)', fontSize: 13 }}>
                    <Filter size={18} style={{ opacity: 0.5, marginBottom: 6 }} />
                    <div>No audit entries yet{anyFilter ? ' for these filters' : ''}.</div>
                    {anyFilter && (
                      <button onClick={clearFilters} className="btn-ghost" style={{ fontSize: 12, marginTop: 10 }}>
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {searched.map((e, i) => (
                <EntryRow
                  key={e.id || `${e.entry_hash}-${i}`}
                  entry={e}
                  index={i}
                  expanded={expanded.has(e.id)}
                  onToggle={() => toggle(e.id)}
                />
              ))}
            </tbody>
          </table>

          {/* Footer / load more */}
          <div style={{
            padding: '12px 14px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--cream-mid)',
            fontSize: 12, color: 'var(--slate-mid)',
          }}>
            <span>
              Showing <strong style={{ color: 'var(--slate)' }}>{searched.length}</strong> of {total}
              {q ? ' (after search filter)' : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={verify} className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}>
                <ShieldCheck size={12} /> Re-verify
              </button>
              {entries.length < total && (
                <button
                  onClick={() => load({ reset: false })}
                  disabled={loading}
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        .spin { animation: auditSpin 0.9s linear infinite; }
        @keyframes auditSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
