import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, GraduationCap, Briefcase, ArrowRight, Play, Loader,
  Sparkles, Target, ShieldCheck, MessageCircle,
} from 'lucide-react'
import { loadDemo } from '../api'

const ROLES = [
  {
    to: '/campus/pc',
    icon: Building2,
    title: 'Placement Committee',
    blurb: 'Ingest resumes, run drives, match students to visiting companies, track the full placement lifecycle.',
    accent: 'sage',
    cta: 'Open the war room',
  },
  {
    to: '/campus/student',
    icon: GraduationCap,
    title: 'Student',
    blurb: 'View your profile, see eligible drives, track shortlist status and interview invites.',
    accent: 'cool',
    cta: 'See my drives',
  },
  {
    to: '/campus/recruiter',
    icon: Briefcase,
    title: 'Recruiter',
    blurb: 'Review your drive shortlist, open candidate deep-dives, leave feedback for the placement team.',
    accent: 'warm',
    cta: 'Review shortlist',
  },
]

// accent styles keyed by role
const ACCENT = {
  sage: {
    icon: 'var(--sage)',
    text: 'var(--sage-dim)',
    bg: 'var(--gradient-sage-card)',
    ring: 'rgba(74,124,111,0.25)',
    glow: 'var(--shadow-glow)',
    chip: 'var(--sage-light)',
  },
  warm: {
    icon: 'var(--accent-warm)',
    text: 'var(--accent-warm-dim)',
    bg: 'var(--gradient-warm-card)',
    ring: 'rgba(199,138,62,0.25)',
    glow: 'var(--shadow-glow-warm)',
    chip: 'var(--accent-warm-light)',
  },
  cool: {
    icon: 'var(--accent-cool)',
    text: 'var(--accent-cool-dim)',
    bg: 'var(--gradient-cool-card)',
    ring: 'rgba(92,143,143,0.25)',
    glow: 'var(--shadow-glow-cool)',
    chip: 'var(--accent-cool-light)',
  },
}

const FLOATING_PILLS = [
  { icon: Target,        text: 'Match by fit',    accent: 'sage',  delay: 0 },
  { icon: ShieldCheck,   text: 'Bias-aware',      accent: 'warm',  delay: 0.4 },
  { icon: MessageCircle, text: 'Conversational',  accent: 'cool',  delay: 0.8 },
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
    <div style={{
      minHeight: '100vh',
      background: 'var(--gradient-hero)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* ambient background blobs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: -160, left: -80,
            width: 520, height: 520, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(74,124,111,0.18) 0%, transparent 65%)',
            filter: 'blur(18px)',
          }}
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          style={{
            position: 'absolute', top: '20%', right: -120,
            width: 460, height: 460, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(199,138,62,0.14) 0%, transparent 65%)',
            filter: 'blur(18px)',
          }}
        />
      </div>

      <div style={{
        maxWidth: 1180, margin: '0 auto',
        padding: '88px 24px 40px',
        position: 'relative', zIndex: 1,
      }}>
        {/* ========== HERO ========== */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
          style={{ maxWidth: 860, marginBottom: 64 }}
        >
          {/* Eyebrow */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            style={{ marginBottom: 20 }}
          >
            <span className="text-eyebrow">
              TechVista · Campus edition
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="text-display-xl"
            style={{ marginBottom: 20 }}
          >
            Placement season,{' '}
            <span style={{
              fontStyle: 'italic',
              background: 'linear-gradient(120deg, var(--sage) 0%, var(--accent-cool) 50%, var(--accent-warm) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>finally</span> under control.
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            className="text-body-lg"
            style={{ maxWidth: 660, marginBottom: 28, color: 'var(--slate)' }}
          >
            Ingest a class, run every drive, match students by actual fit — not keywords — and
            explain every shortlist with a paragraph, not a spreadsheet.
          </motion.p>

          {/* Floating feature pills */}
          <motion.div
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}
          >
            {FLOATING_PILLS.map((p) => (
              <motion.div
                key={p.text}
                animate={{ y: [0, -5, 0] }}
                transition={{
                  duration: 3.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: p.delay,
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px',
                  background: 'var(--white)',
                  border: `1.5px solid ${ACCENT[p.accent].ring}`,
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
                  color: ACCENT[p.accent].text,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <p.icon size={14} style={{ color: ACCENT[p.accent].icon }} />
                {p.text}
              </motion.div>
            ))}
          </motion.div>

          {/* Demo CTA */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}
          >
            <button
              onClick={startDemo}
              disabled={demoLoading}
              className={`btn-shimmer ${demoLoading ? 'is-loading' : ''}`}
            >
              {demoLoading ? (
                <><Loader size={16} style={{ animation: 'spin 1.2s linear infinite' }} /> Loading demo…</>
              ) : (
                <>
                  <Sparkles size={16} style={{ color: 'var(--accent-warm)' }} />
                  Try live demo
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <span style={{ fontSize: 13, color: 'var(--slate-mid)', maxWidth: 360 }}>
              20 pre-seeded students · 4 drives · full chatbot · no signup.
            </span>
          </motion.div>

          {demoErr && (
            <div style={{
              marginTop: 16, padding: 12,
              background: 'var(--blush-light)', color: 'var(--blush)',
              borderRadius: 10, fontSize: 13,
              border: '1px solid rgba(196,117,106,0.3)',
            }}>
              {demoErr}
            </div>
          )}
        </motion.div>

        {/* ========== ROLE PICKER ========== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ marginBottom: 20 }}
        >
          <div className="text-eyebrow" style={{ marginBottom: 12 }}>Pick your lane</div>
          <h2 className="text-display" style={{ marginBottom: 28 }}>
            Three roles. <span className="text-display-italic">One placement season.</span>
          </h2>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 20,
          marginBottom: 72,
        }}>
          {ROLES.map((r, i) => {
            const a = ACCENT[r.accent]
            return (
              <motion.div
                key={r.to}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.08 }}
                whileHover={{ y: -4 }}
              >
                <Link to={r.to} style={{ textDecoration: 'none', display: 'block' }}>
                  <motion.div
                    whileHover="hover"
                    initial="rest"
                    animate="rest"
                    style={{
                      position: 'relative',
                      background: 'var(--white)',
                      border: '1px solid var(--border)',
                      borderRadius: 18,
                      padding: 28,
                      height: '100%',
                      boxShadow: 'var(--shadow-sm)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color 220ms var(--ease-out), box-shadow 260ms var(--ease-out)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = a.glow
                      e.currentTarget.style.borderColor = 'transparent'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    {/* accent gradient overlay */}
                    <motion.div
                      variants={{
                        rest: { opacity: 0.4 },
                        hover: { opacity: 1 },
                      }}
                      transition={{ duration: 0.4 }}
                      style={{
                        position: 'absolute', inset: 0,
                        background: a.bg,
                        pointerEvents: 'none',
                      }}
                    />

                    <div style={{ position: 'relative' }}>
                      {/* Icon plate */}
                      <motion.div
                        variants={{
                          rest: { scale: 1, rotate: 0 },
                          hover: { scale: 1.08, rotate: -4 },
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                        style={{
                          width: 56, height: 56,
                          borderRadius: 14,
                          background: a.chip,
                          border: `1px solid ${a.ring}`,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          marginBottom: 22,
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
                        }}
                      >
                        <r.icon size={26} style={{ color: a.icon }} />
                      </motion.div>

                      <h3 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 24, fontWeight: 700,
                        color: 'var(--ink)', marginBottom: 10,
                        letterSpacing: '-0.015em',
                      }}>
                        {r.title}
                      </h3>

                      <p style={{
                        fontSize: 14, lineHeight: 1.55,
                        color: 'var(--slate)',
                        marginBottom: 20,
                        minHeight: 68,
                      }}>
                        {r.blurb}
                      </p>

                      <motion.div
                        variants={{
                          rest:  { x: 0 },
                          hover: { x: 4 },
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          color: a.text,
                          fontSize: 14, fontWeight: 600,
                        }}
                      >
                        {r.cta} <ArrowRight size={16} />
                      </motion.div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* ========== FOOTER-LITE ========== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 24,
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: 12,
          }}
        >
          <div style={{ color: 'var(--slate-mid)', fontSize: 13 }}>
            First-time setup?{' '}
            <Link to="/campus/setup" style={{
              color: 'var(--sage-dim)', fontWeight: 600, textDecoration: 'none',
              borderBottom: '1.5px solid var(--sage-light)',
              paddingBottom: 1,
            }}>
              Create your college →
            </Link>
          </div>
          <Link to="/" style={{
            color: 'var(--slate)', fontSize: 13, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            ← Back to Tech Vista
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
