import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Filter } from 'lucide-react'
import { listStudents } from '../api'
import CampusNav from '../components/CampusNav'

export default function StudentsListPage() {
  const collegeId = localStorage.getItem('campus_college_id')
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

  useEffect(() => { load() }, [branch, status])

  const filtered = students.filter((s) =>
    !q || s.name?.toLowerCase().includes(q.toLowerCase()) || s.email?.toLowerCase().includes(q.toLowerCase())
  )

  if (!collegeId) return <RequireCollege />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', marginBottom: 24 }}>
          Students
        </motion.h1>

        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-mid)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email"
              style={{ ...inputStyle, paddingLeft: 34 }} />
          </div>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} style={inputStyle}>
            <option value="">All branches</option>
            {['CSE', 'ECE', 'EE', 'ME', 'Civil', 'IT', 'Chem', 'MBA'].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="">All statuses</option>
            <option value="unplaced">Unplaced</option>
            <option value="in_process">In process</option>
            <option value="placed">Placed</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>

        {err && <div style={{ background: 'var(--blush-light)', color: 'var(--blush)', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 0.6fr 1fr', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--cream-mid)', fontSize: 12, color: 'var(--slate-mid)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <div>Name</div><div>Branch</div><div>Year</div><div>CGPA</div><div>Status</div>
          </div>
          {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-mid)' }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-mid)' }}>
              No students. <Link to="/campus/ingest" style={{ color: 'var(--sage)' }}>Ingest some →</Link>
            </div>
          )}
          {filtered.map((s) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 0.6fr 1fr', padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 14, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--slate-mid)' }}>{s.email}</div>
              </div>
              <div style={{ color: 'var(--slate)' }}>{s.branch || '—'}</div>
              <div style={{ color: 'var(--slate)' }}>{s.year || '—'}</div>
              <div style={{ color: 'var(--slate)' }}>{s.cgpa ?? '—'}</div>
              <div>
                <StatusPill status={s.placed_status} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, color: 'var(--slate-mid)', fontSize: 13 }}>
          Showing {filtered.length} of {students.length} · <Link to="/campus/pc" style={{ color: 'var(--slate)' }}>← back</Link>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const styles = {
    unplaced: { bg: 'var(--cream-deep)', color: 'var(--slate)' },
    in_process: { bg: 'var(--sage-light)', color: 'var(--sage-dim)' },
    placed: { bg: 'var(--moss-light)', color: 'var(--moss)' },
    withdrawn: { bg: 'var(--blush-pale)', color: 'var(--blush)' },
  }
  const s = styles[status] || styles.unplaced
  return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12 }}>{status || 'unplaced'}</span>
}

function RequireCollege() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link to="/campus/setup" style={{ background: 'var(--sage)', color: 'var(--white)', padding: '10px 16px', borderRadius: 8, textDecoration: 'none' }}>
        Set up college first →
      </Link>
    </div>
  )
}

const inputStyle = {
  padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)',
  fontFamily: 'var(--font-sans)', fontSize: 14, background: 'var(--cream)', color: 'var(--ink)',
  outline: 'none',
}
