import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, GraduationCap, Briefcase, ArrowRight, Play, Loader } from 'lucide-react'
import { loadDemo } from '../api'

const ROLES = [
  {
    to: '/campus/pc',
    icon: Building2,
    title: 'Placement Committee',
    blurb: 'Ingest resumes, run drives, match students to visiting companies, track the full placement lifecycle.',
    accent: 'var(--sage)',
  },
  {
    to: '/campus/student',
    icon: GraduationCap,
    title: 'Student',
    blurb: 'View your profile, see eligible drives, track shortlist status and interview invites.',
    accent: 'var(--accent-experience)',
  },
  {
    to: '/campus/recruiter',
    icon: Briefcase,
    title: 'Recruiter',
    blurb: 'Review your drive shortlist, open candidate deep-dives, leave feedback for the placement team.',
    accent: 'var(--accent-education)',
  },
]

export default function CampusLanding() {
  const nav = useNavigate()
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoErr, setDemoErr] = useState('')

  const startDemo = async () => {
    setDemoErr(''); setDemoLoading(true)
    try {
      const { data } = await loadDemo()
      localStorage.setItem('campus_college_id', data.college_id)
      localStorage.setItem('campus_college_slug', data.college_slug)
      localStorage.setItem('campus_demo_mode', '1')
      nav('/campus/pc')
    } catch (e) {
      setDemoErr(e.response?.data?.detail || e.message || 'Failed to load demo')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 56px)', color: 'var(--ink)', marginBottom: 8 }}>
            TechVista Campus
          </h1>
          <p style={{ fontSize: 18, color: 'var(--slate)', maxWidth: 620, marginBottom: 28 }}>
            AI-powered placement management for college placement cells. Match students to the right companies with context, not keywords.
          </p>

          {/* Demo entry */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={startDemo} disabled={demoLoading} style={{
              background: 'var(--sage)', color: 'var(--white)', border: 'none',
              padding: '12px 20px', borderRadius: 'var(--radius-btn)',
              fontSize: 14, fontWeight: 500, cursor: demoLoading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {demoLoading
                ? <><Loader size={14} style={{ animation: 'spin 1.2s linear infinite' }} /> Loading demo…</>
                : <><Play size={14} /> Try demo mode</>}
            </button>
            <span style={{ fontSize: 13, color: 'var(--slate-mid)' }}>
              20 pre-seeded students, 4 drives, full chatbot — no signup, no Supabase needed.
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>

          {demoErr && (
            <div style={{ background: 'var(--blush-light)', color: 'var(--blush)', padding: 10, borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
              {demoErr}
            </div>
          )}
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 48 }}>
          {ROLES.map((r, i) => (
            <motion.div
              key={r.to}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
            >
              <Link to={r.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--white)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)', padding: 28, height: '100%',
                  boxShadow: 'var(--shadow-card)', transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <r.icon size={28} style={{ color: r.accent, marginBottom: 16 }} />
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginBottom: 10 }}>
                    {r.title}
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 20, minHeight: 66 }}>
                    {r.blurb}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: r.accent, fontSize: 14, fontWeight: 500 }}>
                    Enter <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, color: 'var(--slate-mid)', fontSize: 13 }}>
          First-time setup?{' '}
          <Link to="/campus/setup" style={{ color: 'var(--sage)', fontWeight: 500 }}>
            Create your college
          </Link>
          {' '}to get started.
          {' · '}
          <Link to="/" style={{ color: 'var(--slate)' }}>
            Back to Tech Vista
          </Link>
        </div>
      </div>
    </div>
  )
}
