import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import {
  UploadCloud, Briefcase, Users, MessageSquareText, ArrowRight,
  TrendingUp, Sparkles, CheckCircle2, Clock, Award,
} from 'lucide-react'
import { listDrives, listStudents } from '../api'
import CampusNav from '../components/CampusNav'
import SetupBanner from '../components/SetupBanner'

/* ---------- count-up number ---------- */
function CountUp({ to, duration = 1.1 }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v))
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (to == null) return
    const controls = animate(count, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    })
    const unsub = rounded.on('change', (v) => setDisplay(v))
    return () => { controls.stop(); unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to])

  return <>{display}</>
}

/* ---------- tier chip ---------- */
function TierChip({ tier }) {
  const cfg = {
    tier_1: { label: 'Tier 1', className: 'chip warm' },
    tier_2: { label: 'Tier 2', className: 'chip cool' },
    tier_3: { label: 'Tier 3', className: 'chip neutral' },
  }[tier] || { label: tier || '—', className: 'chip neutral' }
  return <span className={cfg.className} style={{ fontSize: 11 }}>{cfg.label}</span>
}

/* ---------- status dot ---------- */
function StatusDot({ status }) {
  const cfg = {
    open:      { color: 'var(--moss)',        label: 'Open'      },
    scheduled: { color: 'var(--accent-warm)', label: 'Scheduled' },
    closed:    { color: 'var(--slate-light)', label: 'Closed'    },
    draft:     { color: 'var(--slate-mid)',   label: 'Draft'     },
  }[status] || { color: 'var(--slate-mid)', label: status || 'unknown' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: 'var(--slate)', fontWeight: 500,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: cfg.color,
        boxShadow: `0 0 0 3px ${cfg.color}22`,
      }} />
      {cfg.label}
    </span>
  )
}

export default function PCDashboard() {
  const collegeId = typeof window !== 'undefined' ? localStorage.getItem('campus_college_id') : null
  const [stats, setStats] = useState({ students: null, drives: null, unplaced: null, placed: null })
  const [recentDrives, setRecentDrives] = useState([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!collegeId) { setLoading(false); return }
    ;(async () => {
      try {
        const [s, d, u, p] = await Promise.all([
          listStudents({ college_id: collegeId, limit: 1000 }),
          listDrives({ college_id: collegeId }),
          listStudents({ college_id: collegeId, placed_status: 'unplaced', limit: 1000 }),
          listStudents({ college_id: collegeId, placed_status: 'placed', limit: 1000 }),
        ])
        setStats({
          students: s.data.length,
          drives: d.data.length,
          unplaced: u.data.length,
          placed: p.data.length,
        })
        setRecentDrives(d.data.slice(0, 5))
      } catch (e) {
        setErr(e.response?.data?.detail || e.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    })()
  }, [collegeId])

  if (!collegeId) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No college configured yet"
        subtitle="Set one up to unlock drives, ingest, and matching."
        cta={{ to: '/campus/setup', label: 'Set up college' }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 80px' }}>
        <SetupBanner />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 32 }}
        >
          <div className="text-eyebrow" style={{ marginBottom: 10 }}>Placement cell</div>
          <h1 className="text-display" style={{ marginBottom: 8 }}>
            Your placement, <span className="text-display-italic">at a glance.</span>
          </h1>
          <p className="text-body" style={{ fontSize: 15 }}>
            Every drive, every student, every shortlist — one view.
          </p>
        </motion.div>

        {err && <ErrorBox>{err}</ErrorBox>}

        {/* ========== Stats ========== */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16, marginBottom: 36,
        }}>
          <StatCard
            label="Students in pool" value={stats.students} loading={loading}
            icon={Users} accent="sage" trend="Active roster"
            delay={0}
          />
          <StatCard
            label="Active drives" value={stats.drives} loading={loading}
            icon={Briefcase} accent="cool" trend="Open + scheduled"
            delay={0.08}
          />
          <StatCard
            label="Placed" value={stats.placed} loading={loading}
            icon={Award} accent="warm" trend="Offer accepted"
            delay={0.16}
          />
          <StatCard
            label="Unplaced" value={stats.unplaced} loading={loading}
            icon={Clock} accent="blush" trend="Still looking"
            delay={0.24}
          />
        </div>

        {/* ========== Quick actions ========== */}
        <div className="text-eyebrow" style={{ marginBottom: 14 }}>Quick actions</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14, marginBottom: 40,
        }}>
          <ActionCard to="/campus/ingest"   icon={UploadCloud}       label="Ingest resumes"   hint="Bulk upload 60–100"   accent="sage"  />
          <ActionCard to="/campus/drives"   icon={Briefcase}         label="Manage drives"    hint="View, create, track"  accent="warm"  />
          <ActionCard to="/campus/students" icon={Users}             label="Browse students"  hint="Filter + deep-dive"   accent="cool"  />
          <ActionCard to="/campus/chat"     icon={MessageSquareText} label="Matching chat"    hint="Ask the bot anything" accent="blush" sparkle />
        </div>

        {/* ========== Recent drives ========== */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div className="text-eyebrow">Recent drives</div>
          <Link to="/campus/drives" className="btn-ghost" style={{ fontSize: 13 }}>
            View all <ArrowRight size={13} />
          </Link>
        </div>
        {loading ? (
          <DriveSkeleton />
        ) : recentDrives.length === 0 ? (
          <div style={{
            background: 'var(--white)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 14,
            padding: '40px 24px',
            textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'var(--gradient-sage-card)',
              margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Briefcase size={24} color="var(--sage)" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>
              No drives yet
            </div>
            <div style={{ fontSize: 14, color: 'var(--slate-mid)', marginBottom: 16 }}>
              Your first drive will change everything — start the fun.
            </div>
            <Link to="/campus/drives" className="btn-primary btn-sm">
              Create first drive <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {recentDrives.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
              >
                <Link to={`/campus/drives/${d.id}`} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
                    transition={{ duration: 0.2 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 20px',
                      background: 'var(--white)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'border-color 200ms',
                    }}
                  >
                    {/* Left rail - color dot */}
                    <div style={{
                      width: 4, alignSelf: 'stretch',
                      borderRadius: 2,
                      background: d.company?.tier === 'tier_1'
                        ? 'var(--accent-warm)'
                        : d.company?.tier === 'tier_2'
                        ? 'var(--accent-cool)'
                        : 'var(--sage)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                          {d.role}
                        </span>
                        {d.company?.tier && <TierChip tier={d.company.tier} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--slate-mid)' }}>
                        {d.company?.name && <span>{d.company.name}</span>}
                        {d.location && <span>· {d.location}</span>}
                        <StatusDot status={d.status} />
                      </div>
                    </div>
                    <ArrowRight size={16} color="var(--slate-light)" />
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ========== Components ========== */
const ACCENT_MAP = {
  sage:  { icon: 'var(--sage)',        bg: 'var(--gradient-sage-card)',  ring: 'rgba(74,124,111,0.2)' },
  warm:  { icon: 'var(--accent-warm)', bg: 'var(--gradient-warm-card)',  ring: 'rgba(199,138,62,0.25)' },
  cool:  { icon: 'var(--accent-cool)', bg: 'var(--gradient-cool-card)',  ring: 'rgba(92,143,143,0.25)' },
  blush: { icon: 'var(--blush)',       bg: 'var(--gradient-blush-card)', ring: 'rgba(196,117,106,0.25)' },
}

function StatCard({ label, value, loading, icon: Icon, accent, trend, delay = 0 }) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.sage
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
      style={{
        position: 'relative',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        transition: 'box-shadow 240ms',
      }}
    >
      {/* gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: a.bg,
        opacity: 0.8, pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--slate-mid)', fontWeight: 600, letterSpacing: 0.3 }}>
            {label}
          </span>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--white)',
            border: `1px solid ${a.ring}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <Icon size={15} color={a.icon} strokeWidth={2.2} />
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 38, fontWeight: 700,
          color: 'var(--ink)',
          lineHeight: 1,
          marginBottom: 6,
          letterSpacing: '-0.02em',
        }}>
          {loading || value == null
            ? <span className="skeleton" style={{ display: 'inline-block', width: 50, height: 30 }} />
            : <CountUp to={value} />}
        </div>
        {trend && (
          <div style={{ fontSize: 11.5, color: 'var(--slate-mid)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <TrendingUp size={11} color={a.icon} />
            {trend}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ActionCard({ to, icon: Icon, label, hint, accent, sparkle }) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.sage
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        style={{
          position: 'relative',
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 18,
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          overflow: 'hidden',
          transition: 'border-color 200ms, box-shadow 240ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = a.ring; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11,
            background: a.bg,
            border: `1px solid ${a.ring}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={18} color={a.icon} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontWeight: 600, fontSize: 14.5, color: 'var(--ink)',
              marginBottom: 3,
            }}>
              {label}
              {sparkle && <Sparkles size={12} color="var(--accent-warm)" />}
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate-mid)' }}>{hint}</div>
          </div>
          <ArrowRight size={14} color="var(--slate-light)" />
        </div>
      </motion.div>
    </Link>
  )
}

function DriveSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          display: 'flex', gap: 16, padding: '16px 20px',
          background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14,
        }}>
          <div className="skeleton" style={{ width: 4 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 10, width: '65%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, title, subtitle, cta }) {
  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 24,
      background: 'var(--cream)',
    }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{
          width: 96, height: 96, borderRadius: 24,
          background: 'var(--gradient-sage-card)',
          border: '1px solid rgba(74,124,111,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {Icon && <Icon size={36} color="var(--sage)" strokeWidth={1.8} />}
      </motion.div>
      <h2 className="text-display" style={{ margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ color: 'var(--slate)', fontSize: 15, textAlign: 'center', maxWidth: 420 }}>{subtitle}</p>}
      {cta && <Link to={cta.to} className="btn-primary">{cta.label} <ArrowRight size={14} /></Link>}
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{
      background: 'var(--blush-light)', color: 'var(--blush)',
      padding: 14, borderRadius: 10, marginBottom: 20,
      fontSize: 14, border: '1px solid rgba(196,117,106,0.25)',
      display: 'flex', gap: 10, alignItems: 'center',
    }}>
      <CheckCircle2 size={16} style={{ transform: 'rotate(45deg)' }} />
      {children}
    </div>
  )
}
