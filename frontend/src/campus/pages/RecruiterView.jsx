import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase, AlertTriangle, MapPin, DollarSign, Calendar,
  Building2, Lock, Users, ChevronRight,
} from 'lucide-react'
import { getRecruiterView } from '../api'


function fmtDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}


const STAGE_LABEL = {
  shortlisted: 'Shortlisted', interview_1: 'Interview 1', interview_2: 'Interview 2',
  interview_3: 'Interview 3', offered: 'Offered', accepted: 'Accepted',
  joined: 'Joined', rejected: 'Rejected', withdrawn: 'Withdrawn',
}


export default function RecruiterView() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setErr('Missing token. This link is invalid.')
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        const { data } = await getRecruiterView(token)
        setData(data)
      } catch (e) {
        setErr(e.response?.data?.detail || e.message || 'Could not load view')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="skeleton" style={{ height: 20, width: 140, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 44, width: '55%', marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 80, width: '100%', borderRadius: 12, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 240, width: '100%', borderRadius: 14 }} />
        </div>
      </div>
    )
  }

  if (err || !data) {
    return <InvalidLink message={err || 'This link is invalid.'} />
  }

  const drive = data.drive || {}
  const company = data.company || drive.company || {}
  const shortlists = data.shortlists || []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px 80px' }}>
        {/* Recruiter banner */}
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'linear-gradient(135deg, var(--cream-mid), var(--white))',
            border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 16px',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Lock size={15} color="var(--sage-dim)" />
          <div style={{ flex: 1, fontSize: 13, color: 'var(--slate)', lineHeight: 1.5 }}>
            You&apos;re viewing as a recruiter. This view is <strong>read-only</strong>.
            Link expires <strong>{fmtDate(data.expires_at)}</strong>.
          </div>
          <span className="chip" style={{
            background: 'var(--sage-light)', color: 'var(--sage-dim)',
            fontSize: 11, fontWeight: 600,
          }}>Recruiter view</span>
        </motion.div>

        {/* Drive hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ marginBottom: 24 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'var(--slate-mid)', fontWeight: 600,
            letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10,
          }}>
            <Briefcase size={12} /> Campus placement drive
          </div>
          <h1 className="text-display-lg" style={{ marginBottom: 4 }}>
            {drive.role}
          </h1>
          {company?.name && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 17, color: 'var(--slate)', fontWeight: 500, marginBottom: 20,
            }}>
              <Building2 size={15} color="var(--slate-mid)" />
              {company.name}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {drive.location && <InfoChip icon={MapPin} label={drive.location} />}
            {drive.ctc_offered && (
              <InfoChip
                icon={DollarSign}
                label={typeof drive.ctc_offered === 'number'
                  ? `₹${(drive.ctc_offered / 100000).toFixed(1)}L` : drive.ctc_offered}
              />
            )}
            {drive.scheduled_date && <InfoChip icon={Calendar} label={drive.scheduled_date} />}
          </div>
        </motion.div>

        {/* Shortlist table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 14, padding: 24,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
            color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.015em',
          }}>
            <Users size={17} color="var(--sage)" />
            Shortlisted candidates
          </h3>
          <p style={{ fontSize: 13, color: 'var(--slate-mid)', marginBottom: 18 }}>
            {shortlists.length} candidate{shortlists.length === 1 ? '' : 's'} presented by the placement cell.
          </p>

          {shortlists.length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center',
              fontSize: 13.5, color: 'var(--slate-mid)',
              background: 'var(--cream)', borderRadius: 10,
              border: '1px dashed var(--border)',
            }}>
              No candidates shortlisted yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shortlists.map((s, i) => (
                <ShortlistCard key={s.student_compact?.id || i} item={s} />
              ))}
            </div>
          )}
        </motion.div>

        <div style={{
          marginTop: 24, fontSize: 12,
          color: 'var(--slate-mid)', textAlign: 'center',
        }}>
          Powered by TechVista Campus · Data shared with {data.recruiter_email || 'the recruiter'}
        </div>
      </div>
    </div>
  )
}


function InfoChip({ icon: Icon, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', background: 'var(--cream-mid)',
      color: 'var(--ink-soft, var(--ink))', fontSize: 13,
      borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
    }}>
      <Icon size={12} color="var(--slate-mid)" />{label}
    </span>
  )
}


function ShortlistCard({ item }) {
  const s = item.student_compact || {}
  const fit = item.fit_score
  const fitPct = fit != null
    ? Math.round(fit * (fit > 1 ? 1 : 100))
    : null
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        padding: 16,
        background: 'var(--cream)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{s.name || 'Candidate'}</span>
          {s.branch && <span className="chip cool" style={{ fontSize: 11 }}>{s.branch}</span>}
          {s.year && <span className="chip neutral" style={{ fontSize: 11 }}>Year {s.year}</span>}
          {s.cgpa != null && <span className="chip warm" style={{ fontSize: 11 }}>CGPA {s.cgpa}</span>}
        </div>
        {s.summary && (
          <p style={{
            fontSize: 13, color: 'var(--slate)', lineHeight: 1.55,
            margin: 0, marginBottom: item.fit_rationale ? 8 : 0,
          }}>
            {s.summary}
          </p>
        )}
        {item.fit_rationale && (
          <div style={{
            marginTop: 8, padding: '8px 10px',
            background: 'var(--sage-light, var(--cream-mid))',
            borderLeft: '3px solid var(--sage)', borderRadius: 6,
            fontSize: 12.5, color: 'var(--slate)', lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--sage-dim)' }}>Why this fit: </strong>
            {item.fit_rationale}
          </div>
        )}
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', justifyContent: 'space-between', gap: 10,
      }}>
        {fitPct != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 11, color: 'var(--slate-mid)', fontWeight: 600,
              letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
            }}>Fit</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
              color: 'var(--sage-dim)',
            }}>{fitPct}%</div>
          </div>
        )}
        <span className="chip neutral" style={{ fontSize: 11 }}>
          {STAGE_LABEL[item.stage] || item.stage || 'shortlisted'}
        </span>
      </div>
    </motion.div>
  )
}


function InvalidLink({ message }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '72px 24px' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{
          maxWidth: 480, margin: '0 auto',
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 14, padding: 32, textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'var(--blush-pale)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <AlertTriangle size={24} color="var(--blush)" />
        </div>
        <h2 className="text-display" style={{ fontSize: 22, marginBottom: 8 }}>
          This link is invalid or expired
        </h2>
        <p style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 20, lineHeight: 1.55 }}>
          {message} Recruiter links expire 30 days after creation. Ask your placement
          contact to generate a new one.
        </p>
        <Link to="/" className="btn-secondary btn-sm">Go to TechVista home</Link>
      </motion.div>
    </div>
  )
}
