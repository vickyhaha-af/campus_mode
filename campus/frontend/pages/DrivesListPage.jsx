import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Briefcase, ArrowRight } from 'lucide-react'
import { listDrives, listCompanies, createCompany, createDrive } from '../api'
import CampusNav from '../components/CampusNav'

export default function DrivesListPage() {
  const collegeId = localStorage.getItem('campus_college_id')
  const [drives, setDrives] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [err, setErr] = useState('')

  const refresh = async () => {
    if (!collegeId) return
    try {
      const { data } = await listDrives({ college_id: collegeId })
      setDrives(data)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed to load drives')
    }
  }

  useEffect(() => { refresh() }, [])

  if (!collegeId) return <RequireCollege />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)' }}>
            Drives
          </motion.h1>
          <button onClick={() => setShowNew(true)} style={primaryBtn}>
            <Plus size={14} /> New drive
          </button>
        </div>

        {err && <ErrorBox>{err}</ErrorBox>}

        {drives.length === 0 ? (
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 48, textAlign: 'center' }}>
            <Briefcase size={32} color="var(--slate-light)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--slate)', marginBottom: 12 }}>No drives yet.</p>
            <button onClick={() => setShowNew(true)} style={primaryBtn}>
              <Plus size={14} /> Create first drive
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {drives.map((d) => (
              <Link key={d.id} to={`/campus/drives/${d.id}`} style={driveCard}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{d.role}</div>
                  <div style={{ fontSize: 13, color: 'var(--slate-mid)' }}>
                    {d.location || '—'} · {d.job_type} · {d.status}
                    {d.scheduled_date && ` · ${d.scheduled_date}`}
                  </div>
                </div>
                <ArrowRight size={16} color="var(--slate-light)" />
              </Link>
            ))}
          </div>
        )}

        {showNew && <NewDriveModal collegeId={collegeId} onClose={() => setShowNew(false)} onCreated={refresh} />}

      </div>
    </div>
  )
}

function NewDriveModal({ collegeId, onClose, onCreated }) {
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('')
  const [jdText, setJdText] = useState('')
  const [minCgpa, setMinCgpa] = useState('')
  const [maxBacklogs, setMaxBacklogs] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      // Get-or-create company
      const companies = await listCompanies(collegeId)
      let company = companies.data.find((c) => c.name.toLowerCase() === companyName.trim().toLowerCase())
      if (!company) {
        const { data } = await createCompany({ college_id: collegeId, name: companyName.trim() })
        company = data
      }
      await createDrive({
        college_id: collegeId,
        company_id: company.id,
        role: role.trim(),
        jd_text: jdText,
        location,
        eligibility_rules: {
          min_cgpa: minCgpa ? parseFloat(minCgpa) : null,
          max_active_backlogs: maxBacklogs ? parseInt(maxBacklogs) : null,
        },
      })
      onCreated()
      onClose()
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        style={modalCard}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', marginBottom: 20 }}>New drive</h3>
        <form onSubmit={submit}>
          <L label="Company" required><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={inputStyle} /></L>
          <L label="Role" required><input value={role} onChange={(e) => setRole(e.target.value)} required style={inputStyle} /></L>
          <L label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} /></L>
          <L label="Job description"><textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={5} style={inputStyle} /></L>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <L label="Min CGPA"><input type="number" step="0.1" value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} style={inputStyle} /></L>
            <L label="Max active backlogs"><input type="number" value={maxBacklogs} onChange={(e) => setMaxBacklogs(e.target.value)} style={inputStyle} /></L>
          </div>
          {err && <ErrorBox>{err}</ErrorBox>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
            <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.5 : 1 }}>
              {busy ? 'Creating…' : 'Create drive'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function L({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--blush)' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function RequireCollege() {
  return <div style={{ padding: 48, textAlign: 'center' }}><Link to="/campus/setup">Set up college first →</Link></div>
}

function ErrorBox({ children }) {
  return <div style={{ background: 'var(--blush-light)', color: 'var(--blush)', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{children}</div>
}

const driveCard = {
  display: 'flex', alignItems: 'center', padding: '16px 20px',
  background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
  textDecoration: 'none', color: 'var(--ink)', transition: 'all 0.15s',
}
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)',
  fontFamily: 'var(--font-sans)', fontSize: 14, background: 'var(--cream)', color: 'var(--ink)', outline: 'none',
}
const primaryBtn = { background: 'var(--sage)', color: 'var(--white)', border: 'none', padding: '8px 14px', borderRadius: 'var(--radius-btn)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
const secondaryBtn = { background: 'transparent', color: 'var(--slate)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 'var(--radius-btn)', fontSize: 13, cursor: 'pointer' }
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }
const modalCard = { background: 'var(--white)', borderRadius: 'var(--radius-card)', padding: 28, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }
