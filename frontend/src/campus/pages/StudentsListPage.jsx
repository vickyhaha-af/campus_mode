import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Users, UploadCloud, ArrowRight, Filter, X } from 'lucide-react'
import { listStudents } from '../api'
import CampusNav from '../components/CampusNav'

const BRANCHES = ['CSE', 'ECE', 'EE', 'ME', 'Civil', 'IT', 'Chem', 'MBA']
const STATUSES = [
  { v: 'unplaced',    label: 'Unplaced'   },
  { v: 'in_process',  label: 'In process' },
  { v: 'placed',      label: 'Placed'     },
  { v: 'withdrawn',   label: 'Withdrawn'  },
]

export default function StudentsListPage() {
  const collegeId = typeof window !== 'undefined' ? localStorage.getItem('campus_college_id') : null
  const [students, setStudents] = useState([])
  const [q, setQ] = useState('')
  const [branch, setBranch] = useState('')
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!collegeId) return
    setLoading(true); setErr('')
    try {
      const { data } = await listStudents({ college_id: collegeId, branch, placed_status: status, limit: 500 })
      setStudents(data)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [branch, status])

  const filtered = useMemo(() => students.filter((s) =>
    !q || s.name?.toLowerCase().includes(q.toLowerCase()) || s.email?.toLowerCase().includes(q.toLowerCase())
  ), [students, q])

  const activeFilters = [branch, status, q].filter(Boolean).length

  if (!collegeId) return <RequireCollege />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 28 }}
        >
          <div className="text-eyebrow" style={{ marginBottom: 10 }}>Students</div>
          <h1 className="text-display" style={{ marginBottom: 6 }}>
            The whole <span className="text-display-italic">class</span>, searchable.
          </h1>
          <p className="text-body" style={{ fontSize: 14.5 }}>
            Filter, scan, open — everything about everyone in one spot.
          </p>
        </motion.div>

        {/* Filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={16} style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--slate-mid)', pointerEvents: 'none',
            }} />
            <input
              className="input-field"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              style={{ paddingLeft: 40, fontSize: 14.5 }}
            />
            {q && (
              <button
                onClick={() => setQ('')}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'var(--cream-mid)', border: 'none', borderRadius: 6,
                  padding: 4, cursor: 'pointer', color: 'var(--slate-mid)',
                  display: 'flex', alignItems: 'center',
                }}
                aria-label="Clear"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filter chips — pill style */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            <FilterGroup label="Branch">
              <button className={`filter-pill ${!branch ? 'active' : ''}`} onClick={() => setBranch('')}>
                All
              </button>
              {BRANCHES.map((b) => (
                <button
                  key={b}
                  className={`filter-pill ${branch === b ? 'active' : ''}`}
                  onClick={() => setBranch(b)}
                >
                  {b}
                </button>
              ))}
            </FilterGroup>

            <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '2px 0' }} />

            <FilterGroup label="Status">
              <button className={`filter-pill ${!status ? 'active' : ''}`} onClick={() => setStatus('')}>
                Any
              </button>
              {STATUSES.map((s) => (
                <button
                  key={s.v}
                  className={`filter-pill ${status === s.v ? 'active' : ''}`}
                  onClick={() => setStatus(s.v)}
                >
                  {s.label}
                </button>
              ))}
            </FilterGroup>
          </div>
        </motion.div>

        {/* Summary line */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, fontSize: 13, color: 'var(--slate-mid)',
          flexWrap: 'wrap', gap: 8,
        }}>
          <span>
            Showing <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{filtered.length}</strong> of <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{students.length}</strong> students
            {activeFilters > 0 && (
              <>  ·  <Filter size={11} style={{ display: 'inline', verticalAlign: -1 }} /> {activeFilters} filter{activeFilters === 1 ? '' : 's'} active</>
            )}
          </span>
          <Link to="/campus/pc" className="btn-ghost" style={{ fontSize: 13 }}>
            ← Back to dashboard
          </Link>
        </div>

        {err && <ErrorBox>{err}</ErrorBox>}

        {/* List */}
        {loading ? (
          <StudentsSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyBlock hasFilter={activeFilters > 0} onClear={() => { setBranch(''); setStatus(''); setQ('') }} />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {filtered.map((s, i) => <StudentRow key={s.id} s={s} index={i} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--slate-mid)',
        letterSpacing: 0.6, textTransform: 'uppercase', marginRight: 4,
      }}>{label}</span>
      {children}
    </div>
  )
}

function StudentRow({ s, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.4) }}
      whileHover={{ x: 2, boxShadow: 'var(--shadow-md)' }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 1.5fr) auto 1fr auto',
        gap: 16,
        alignItems: 'center',
        padding: '14px 18px',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow 220ms, border-color 200ms',
      }}
    >
      {/* Name + email */}
      <div>
        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14.5, marginBottom: 2 }}>
          {s.name || '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--slate-mid)', fontFamily: 'var(--font-mono)' }}>
          {s.email || '—'}
        </div>
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {s.branch && <span className="chip">{s.branch}</span>}
        {s.year && <span className="chip cool">Year {s.year}</span>}
        {s.cgpa != null && (
          <span className="chip warm" style={{ fontFamily: 'var(--font-mono)' }}>
            CGPA {typeof s.cgpa === 'number' ? s.cgpa.toFixed(2) : s.cgpa}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div />

      {/* Status pill */}
      <StatusPill status={s.placed_status} />
    </motion.div>
  )
}

function StatusPill({ status }) {
  const cfg = {
    unplaced:   { bg: 'var(--cream-deep)',  color: 'var(--slate)',            ring: 'var(--border)' },
    in_process: { bg: 'var(--sage-light)',  color: 'var(--sage-dim)',         ring: 'rgba(74,124,111,0.3)' },
    placed:     { bg: 'var(--moss-light)',  color: 'var(--moss)',             ring: 'rgba(94,122,82,0.3)' },
    withdrawn:  { bg: 'var(--blush-light)', color: 'var(--blush)',            ring: 'rgba(196,117,106,0.3)' },
  }
  const c = cfg[status] || cfg.unplaced
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: c.bg, color: c.color,
      padding: '4px 12px', borderRadius: 'var(--radius-pill)',
      fontSize: 12, fontWeight: 600,
      border: `1px solid ${c.ring}`,
      textTransform: 'capitalize',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
      {(status || 'unplaced').replace('_', ' ')}
    </span>
  )
}

function EmptyBlock({ hasFilter, onClear }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--white)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 18,
        padding: '60px 24px',
        textAlign: 'center',
      }}
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 72, height: 72, borderRadius: 18,
          background: 'var(--gradient-cool-card)',
          border: '1px solid rgba(92,143,143,0.25)',
          margin: '0 auto 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Users size={32} color="var(--accent-cool)" strokeWidth={1.8} />
      </motion.div>
      <h3 className="text-display" style={{ marginBottom: 8 }}>
        {hasFilter ? 'No matches' : 'No students yet'}
      </h3>
      <p style={{ color: 'var(--slate-mid)', fontSize: 14, marginBottom: 22, maxWidth: 400, margin: '0 auto 22px' }}>
        {hasFilter
          ? 'No students match these filters. Try clearing them.'
          : 'Bulk-ingest resumes to populate your student roster — 100 in under 5 minutes.'}
      </p>
      {hasFilter ? (
        <button className="btn-secondary" onClick={onClear}>Clear filters</button>
      ) : (
        <Link to="/campus/ingest" className="btn-primary btn-lg">
          <UploadCloud size={16} /> Ingest students <ArrowRight size={14} />
        </Link>
      )}
    </motion.div>
  )
}

function StudentsSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr auto 1fr auto',
          gap: 16, alignItems: 'center',
          padding: '14px 18px',
          background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12,
        }}>
          <div>
            <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 10, width: '80%' }} />
          </div>
          <div className="skeleton" style={{ height: 22, width: 160, borderRadius: 999 }} />
          <div />
          <div className="skeleton" style={{ height: 22, width: 90, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  )
}

function RequireCollege() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link to="/campus/setup" className="btn-primary btn-lg">
        Set up college first <ArrowRight size={16} />
      </Link>
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{
      background: 'var(--blush-light)', color: 'var(--blush)',
      padding: 12, borderRadius: 10, marginBottom: 16,
      fontSize: 13, border: '1px solid rgba(196,117,106,0.25)',
    }}>
      {children}
    </div>
  )
}
