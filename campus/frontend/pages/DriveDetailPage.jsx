import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Calendar, DollarSign, AlertTriangle } from 'lucide-react'
import { getDrive } from '../api'
import CampusNav from '../components/CampusNav'
import DriveShortlist from '../components/DriveShortlist'

export default function DriveDetailPage() {
  const { driveId } = useParams()
  const [drive, setDrive] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      try { const { data } = await getDrive(driveId); setDrive(data) }
      catch (e) { setErr(e.response?.data?.detail || e.message) }
    })()
  }, [driveId])

  if (err) return <div style={{ padding: 48 }}>Error: {err}</div>
  if (!drive) return <div style={{ padding: 48, color: 'var(--slate-mid)' }}>Loading…</div>

  const rules = drive.eligibility_rules || {}
  const hasDemoFilter = rules.gender_restriction

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Link to="/campus/drives" style={{ color: 'var(--slate)', fontSize: 13 }}>← All drives</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', marginTop: 8, marginBottom: 6 }}>
            {drive.role}
          </h1>
          <div style={{ display: 'flex', gap: 16, color: 'var(--slate-mid)', fontSize: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            {drive.location && <span style={pill}><MapPin size={13} />{drive.location}</span>}
            {drive.scheduled_date && <span style={pill}><Calendar size={13} />{drive.scheduled_date}</span>}
            {drive.ctc_offered && <span style={pill}><DollarSign size={13} />{drive.ctc_offered}</span>}
            <span style={{ ...pill, background: 'var(--sage-light)', color: 'var(--sage-dim)' }}>{drive.status}</span>
          </div>
        </motion.div>

        {hasDemoFilter && (
          <div style={{ background: 'var(--blush-pale)', border: '1px solid var(--blush-light)', color: 'var(--blush)', padding: 14, borderRadius: 8, marginBottom: 20, display: 'flex', gap: 10 }}>
            <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}>
              <strong>Demographic filter active:</strong> gender = {rules.gender_restriction}.
              {rules.gender_restriction_justification && <div style={{ marginTop: 4, color: 'var(--slate)' }}>Justification: {rules.gender_restriction_justification}</div>}
            </div>
          </div>
        )}

        <Section title="Job description">
          <pre style={{
            whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: 14,
            color: 'var(--slate)', lineHeight: 1.6, margin: 0,
          }}>{drive.jd_text || '(no JD text yet)'}</pre>
        </Section>

        <Section title="Eligibility rules">
          <Rule label="Min CGPA" val={rules.min_cgpa ?? '—'} />
          <Rule label="Max active backlogs" val={rules.max_active_backlogs ?? '—'} />
          <Rule label="Max total backlogs" val={rules.max_total_backlogs ?? '—'} />
          <Rule label="Allowed branches" val={rules.allowed_branches?.join(', ') || 'all'} />
          <Rule label="Allowed years" val={rules.allowed_years?.join(', ') || 'all'} />
          <Rule label="Location flexibility required" val={rules.location_flexibility_required ? 'yes' : 'no'} />
        </Section>

        <Section title="Shortlist">
          <DriveShortlist drive={drive} />
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24, marginBottom: 16 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)', marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  )
}

function Rule({ label, val }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
      <span style={{ color: 'var(--slate-mid)' }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{val}</span>
    </div>
  )
}

const pill = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 10px', background: 'var(--cream-mid)', borderRadius: 'var(--radius-pill)', fontSize: 12,
}
