import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import {
  UploadCloud, Briefcase, Users, MessageSquareText, ArrowRight,
  TrendingUp, Sparkles, CheckCircle2, Clock, Award,
  AlertTriangle, UserX, Activity, Target, Inbox,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LabelList, Cell,
} from 'recharts'
import {
  listDrives, listStudents,
  getFunnel, getBranchBreakdown, getDrivesPerformance, getNeedsAttention,
} from '../api'
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

  // Analytics state
  const [funnel, setFunnel] = useState(null)
  const [branchSeries, setBranchSeries] = useState(null)
  const [drivesPerf, setDrivesPerf] = useState(null)
  const [attention, setAttention] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  useEffect(() => {
    if (!collegeId) { setLoading(false); setAnalyticsLoading(false); return }
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

    ;(async () => {
      try {
        const [f, b, dp, na] = await Promise.all([
          getFunnel(collegeId),
          getBranchBreakdown(collegeId),
          getDrivesPerformance(collegeId),
          getNeedsAttention(collegeId),
        ])
        setFunnel(f.data)
        setBranchSeries(b.data)
        setDrivesPerf(dp.data)
        setAttention(na.data)
      } catch (e) {
        // Surface but don't block main dashboard — analytics are best-effort.
        console.warn('[analytics]', e?.response?.data?.detail || e.message)
      } finally {
        setAnalyticsLoading(false)
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

        {/* ========== Analytics ========== */}
        <div className="text-eyebrow" style={{ marginBottom: 14 }}>Placement analytics</div>

        {/* A. Funnel */}
        <FunnelCard funnel={funnel} loading={analyticsLoading} />

        {/* B + C: half/half */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 16, marginBottom: 16,
          }}
        >
          <BranchCard data={branchSeries} loading={analyticsLoading} />
          <DrivesHeatmapCard data={drivesPerf} loading={analyticsLoading} />
        </div>

        {/* D. Needs attention */}
        <NeedsAttentionCard data={attention} loading={analyticsLoading} />

        {/* ========== Quick actions ========== */}
        <div className="text-eyebrow" style={{ marginBottom: 14, marginTop: 32 }}>Quick actions</div>
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

/* ============================================================================
 * Analytics cards
 * ==========================================================================*/

function AnalyticsCard({ title, icon: Icon, subtitle, children, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 16,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {Icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--gradient-sage-card)',
            border: '1px solid rgba(74,124,111,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} color="var(--sage)" strokeWidth={2.2} />
          </div>
        )}
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700,
          color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em',
        }}>{title}</h3>
      </div>
      {subtitle && (
        <div style={{ fontSize: 12.5, color: 'var(--slate-mid)', marginBottom: 14 }}>
          {subtitle}
        </div>
      )}
      {!subtitle && <div style={{ marginBottom: 10 }} />}
      {children}
    </motion.div>
  )
}

function ChartLoadingShell({ height = 180 }) {
  return <div className="skeleton" style={{ height, width: '100%', borderRadius: 10 }} />
}

/* ------ A. Funnel ------- */
function FunnelCard({ funnel, loading }) {
  if (loading) {
    return (
      <AnalyticsCard title="Placement funnel" icon={Target} subtitle="Loading…">
        <ChartLoadingShell height={240} />
      </AnalyticsCard>
    )
  }
  const series = funnel?.series || []
  const empty = !funnel || funnel.empty || series.every((s) => !s.count)

  if (empty) {
    return (
      <AnalyticsCard
        title="Placement funnel"
        icon={Target}
        subtitle="Shortlisted → Interview → Offered → Accepted → Joined"
      >
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '28px 16px', textAlign: 'center',
        }}>
          <Inbox size={28} color="var(--slate-light)" strokeWidth={1.6} />
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 16,
            color: 'var(--ink)', marginTop: 10, marginBottom: 4,
          }}>
            No shortlists yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--slate-mid)', marginBottom: 14, maxWidth: 360 }}>
            Once you create a drive and shortlist students, the funnel will fill in automatically.
          </div>
          <Link to="/campus/drives" className="btn-primary btn-sm">
            Create a drive <ArrowRight size={13} />
          </Link>
        </div>
      </AnalyticsCard>
    )
  }

  // Preserve stage order for the chart.
  const chartData = series.map((r) => ({
    stage: r.label,
    count: r.count,
    conversion: r.conversion_from_prev,
  }))

  return (
    <AnalyticsCard
      title="Placement funnel"
      icon={Target}
      subtitle={`${funnel.total_shortlists} shortlist row(s) across all drives. Percentages show stage-to-stage conversion.`}
    >
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: 560, height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 24, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 11, fill: 'var(--slate-mid)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--slate-mid)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                width={28}
              />
              <Tooltip
                cursor={{ fill: 'rgba(74,124,111,0.08)' }}
                contentStyle={{
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12,
                }}
                formatter={(v, _, p) => {
                  const conv = p?.payload?.conversion
                  return [
                    `${v}${conv != null ? ` · ${conv}% from prev` : ''}`,
                    'Candidates',
                  ]
                }}
              />
              <Bar dataKey="count" fill="var(--sage)" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="conversion"
                  position="top"
                  formatter={(v) => (v == null ? '' : `${v}%`)}
                  style={{ fontSize: 10.5, fill: 'var(--slate-mid)' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AnalyticsCard>
  )
}

/* ------ B. Branch breakdown ------- */
function BranchCard({ data, loading }) {
  if (loading) {
    return (
      <AnalyticsCard title="Branch placement" icon={Users} subtitle="Loading…">
        <ChartLoadingShell height={220} />
      </AnalyticsCard>
    )
  }
  const series = data?.series || []
  if (!series.length) {
    return (
      <AnalyticsCard title="Branch placement" icon={Users} subtitle="No student roster yet.">
        <div style={{ padding: 24, fontSize: 13, color: 'var(--slate-mid)' }}>
          Add students to see branch-wise placement rates.
        </div>
      </AnalyticsCard>
    )
  }

  const chartData = series.map((r) => ({
    branch: r.branch,
    placed: r.placed,
    unplaced: r.unplaced,
    rate: r.placement_rate,
  }))

  return (
    <AnalyticsCard
      title="Branch placement"
      icon={Users}
      subtitle="Placed vs unplaced, per branch"
    >
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: 320, height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="branch"
                tick={{ fontSize: 11, fill: 'var(--slate-mid)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--slate-mid)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                width={28}
              />
              <Tooltip
                cursor={{ fill: 'rgba(74,124,111,0.08)' }}
                contentStyle={{
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12,
                }}
                formatter={(v, name, p) => {
                  if (name === 'placed') {
                    const rate = p?.payload?.rate
                    return [`${v}${rate != null ? ` · ${rate}% placed` : ''}`, 'Placed']
                  }
                  return [v, 'Unplaced']
                }}
              />
              <Bar dataKey="placed" stackId="a" fill="var(--sage)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="unplaced" stackId="a" fill="var(--blush)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AnalyticsCard>
  )
}

/* ------ C. Drive conversion heatmap table ------- */
function convColor(pct) {
  if (pct == null) return { bg: 'var(--cream-mid)', fg: 'var(--slate-mid)' }
  if (pct > 30) return { bg: 'rgba(74,124,111,0.14)', fg: 'var(--sage-dim)' }
  if (pct >= 10) return { bg: 'rgba(199,138,62,0.14)', fg: 'var(--accent-warm-dim)' }
  return { bg: 'rgba(196,117,106,0.14)', fg: 'var(--blush)' }
}

function DrivesHeatmapCard({ data, loading }) {
  if (loading) {
    return (
      <AnalyticsCard title="Drive conversion" icon={Activity} subtitle="Loading…">
        <ChartLoadingShell height={220} />
      </AnalyticsCard>
    )
  }
  const rows = data?.series || []
  if (!rows.length) {
    return (
      <AnalyticsCard title="Drive conversion" icon={Activity} subtitle="No drives yet.">
        <div style={{ padding: 24, fontSize: 13, color: 'var(--slate-mid)' }}>
          Conversion percentages will show here as drives move through stages.
        </div>
      </AnalyticsCard>
    )
  }
  return (
    <AnalyticsCard
      title="Drive conversion"
      icon={Activity}
      subtitle="Shortlist → offer rate per drive"
    >
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{
          width: '100%', minWidth: 420,
          borderCollapse: 'separate', borderSpacing: 0,
          fontSize: 12.5,
        }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--slate-mid)' }}>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Role · Company</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>SL</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Off</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Conv</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((r) => {
              const col = convColor(r.conversion_pct)
              return (
                <tr key={r.drive_id}>
                  <td style={{
                    padding: '8px', borderTop: '1px solid var(--border)',
                    color: 'var(--ink)',
                  }}>
                    <Link
                      to={`/campus/drives/${r.drive_id}`}
                      style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {r.role || '—'}
                      {r.company_name && (
                        <span style={{ color: 'var(--slate-mid)', fontWeight: 400 }}>
                          {' · '}{r.company_name}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td style={{
                    padding: '8px', borderTop: '1px solid var(--border)',
                    textAlign: 'right', color: 'var(--slate)',
                    fontFamily: 'var(--font-mono)',
                  }}>{r.shortlisted}</td>
                  <td style={{
                    padding: '8px', borderTop: '1px solid var(--border)',
                    textAlign: 'right', color: 'var(--slate)',
                    fontFamily: 'var(--font-mono)',
                  }}>{r.offered}</td>
                  <td style={{
                    padding: '8px', borderTop: '1px solid var(--border)',
                    textAlign: 'right',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                      background: col.bg, color: col.fg,
                      fontWeight: 600, fontFamily: 'var(--font-mono)',
                    }}>
                      {r.conversion_pct == null ? '—' : `${r.conversion_pct}%`}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </AnalyticsCard>
  )
}

/* ------ D. Needs attention ------- */
const ATTENTION_ICON = {
  AlertTriangle, UserX, Clock, Users,
}

function NeedsAttentionCard({ data, loading }) {
  if (loading) {
    return (
      <AnalyticsCard title="Needs attention" icon={AlertTriangle} subtitle="Loading…">
        <ChartLoadingShell height={160} />
      </AnalyticsCard>
    )
  }
  const items = data?.items || []
  if (!items.length) {
    return (
      <AnalyticsCard title="Needs attention" icon={CheckCircle2}>
        <div style={{
          padding: '20px 16px', fontSize: 13.5,
          color: 'var(--slate)', textAlign: 'center',
        }}>
          All clear — no stale drives, no struggling students flagged today.
        </div>
      </AnalyticsCard>
    )
  }

  return (
    <AnalyticsCard
      title="Needs attention"
      icon={AlertTriangle}
      subtitle={`${items.length} item(s) that want a placement admin's eye today`}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((it, i) => {
          const Icon = ATTENTION_ICON[it.icon] || AlertTriangle
          const severityColor = it.severity === 'high' ? 'var(--blush)'
            : it.severity === 'medium' ? 'var(--accent-warm)'
            : 'var(--sage)'
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '12px 14px',
                background: 'var(--cream)',
                border: '1px solid var(--border)',
                borderRadius: 10,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${severityColor}1a`,
                border: `1px solid ${severityColor}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={14} color={severityColor} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, color: 'var(--ink)', fontWeight: 600,
                  marginBottom: 2, lineHeight: 1.35,
                }}>
                  {it.headline}
                </div>
                {it.detail && (
                  <div style={{ fontSize: 12.5, color: 'var(--slate-mid)', lineHeight: 1.5 }}>
                    {it.detail}
                  </div>
                )}
              </div>
              {it.action?.to && (
                <Link
                  to={it.action.to}
                  className="btn-ghost btn-sm"
                  style={{ flexShrink: 0, fontSize: 12, padding: '6px 10px' }}
                >
                  {it.action.label} <ArrowRight size={12} />
                </Link>
              )}
            </motion.div>
          )
        })}
      </div>
    </AnalyticsCard>
  )
}
