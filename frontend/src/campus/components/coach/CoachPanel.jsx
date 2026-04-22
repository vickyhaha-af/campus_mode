import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, AlertCircle, Loader, Target, Lightbulb, TrendingUp } from 'lucide-react'
import { getCoach } from '../../api'
import FitRing from './FitRing'
import DriveMatchCard from './DriveMatchCard'
import ResumeAudit from './ResumeAudit'
import ActionItemRow from './ActionItemRow'


/**
 * Top-level career-coach panel — composes FitRing + DriveMatchCard + ResumeAudit + ActionItemRow.
 * Fetches GET /api/campus/coach/{student_id} and renders the full coaching view.
 */
export default function CoachPanel({ studentId }) {
  const [state, setState] = useState('idle')   // idle | loading | ready | error
  const [coach, setCoach] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!studentId) return
    setState('loading')
    setError(null)
    ;(async () => {
      try {
        const { data } = await getCoach(studentId)
        setCoach(data)
        setState('ready')
      } catch (e) {
        setError(e.response?.data?.detail || e.message || 'Coach unavailable')
        setState('error')
      }
    })()
  }, [studentId])

  if (state === 'loading') return <Skeleton />
  if (state === 'error') return <ErrorCard message={error} />
  if (!coach) return null

  const readiness = coach.readiness_score || 0
  const recs = coach.top_drive_recommendations || []
  const quality = coach.resume_quality || null
  const skills = coach.skills_to_acquire || []
  const actions = coach.action_items || []
  const peer = coach.peer_ranking || null

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      style={{
        background: 'var(--gradient-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 28,
        marginBottom: 24,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Hero */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ flex: '1 1 320px' }}>
          <div className="text-eyebrow" style={{ color: 'var(--sage)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={12} /> Career Coach
          </div>
          <h2 className="text-display-lg" style={{ marginBottom: 10 }}>
            You're <span className="text-display-italic">well-positioned</span> for {recs.length || 'several'} role{recs.length === 1 ? '' : 's'}
          </h2>
          <p style={{ color: 'var(--slate)', fontSize: 14, lineHeight: 1.6, maxWidth: 560 }}>
            {coach.headline || 'Based on your profile + available drives, here\'s where to focus.'}
          </p>
          {peer && (
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--sage-light)', color: 'var(--sage-dim)', borderRadius: 'var(--radius-pill)', fontSize: 13 }}>
              <TrendingUp size={12} /> You rank {peer.rank} of {peer.total} {peer.branch} students
              {peer.percentile != null && <span style={{ color: 'var(--slate-mid)' }}>(top {100 - peer.percentile}%)</span>}
            </div>
          )}
        </div>
        <FitRing score={readiness} size={140} stroke={10} label="Ready" />
      </div>

      {/* Top drive matches */}
      {recs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionTitle icon={Target} label="Your best matches" />
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {recs.map((rec, i) => (
              <DriveMatchCard key={rec.drive?.id || i} rec={rec} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Resume audit */}
      {quality && (
        <div style={{ marginBottom: 28 }}>
          <SectionTitle icon={AlertCircle} label="Fix your resume" />
          <ResumeAudit quality={quality} />
        </div>
      )}

      {/* Skills to acquire */}
      {skills.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionTitle icon={Lightbulb} label="Skills to acquire" />
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {skills.map((s, i) => (
              <SkillRecommendation key={i} skill={s} />
            ))}
          </div>
        </div>
      )}

      {/* Action items */}
      {actions.length > 0 && (
        <div>
          <SectionTitle icon={Sparkles} label="Do this in the next 4 weeks" />
          <div>
            {actions.map((a, i) => (
              <ActionItemRow key={i} item={a} index={i} />
            ))}
          </div>
        </div>
      )}
    </motion.section>
  )
}


function SectionTitle({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--sage-light)', color: 'var(--sage-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
        {label}
      </h3>
    </div>
  )
}


function SkillRecommendation({ skill }) {
  const pri = (skill.priority || 'medium').toLowerCase()
  const priColor = pri === 'high' ? 'var(--blush)' : pri === 'low' ? 'var(--slate-mid)' : 'var(--accent-warm, #B39672)'
  return (
    <div style={{
      padding: 14, background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{ fontSize: 15, color: 'var(--ink)' }}>{skill.skill}</strong>
        <span style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5,
          padding: '2px 8px', borderRadius: 999,
          background: `${priColor}15`, color: priColor, fontWeight: 600,
        }}>{pri}</span>
      </div>
      {skill.for_roles?.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--slate-mid)' }}>
          For: {skill.for_roles.slice(0, 3).join(', ')}
        </div>
      )}
      {skill.effort_weeks != null && (
        <div style={{ fontSize: 12, color: 'var(--slate)' }}>
          ~{skill.effort_weeks} weeks to learn
        </div>
      )}
    </div>
  )
}


function Skeleton() {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
      padding: 28, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--slate-mid)', fontSize: 14 }}>
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}>
          <Loader size={14} />
        </motion.span>
        Analysing your profile and top drive matches…
      </div>
      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        <div className="skeleton" style={{ height: 16, width: '60%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 12, width: '70%', borderRadius: 4 }} />
      </div>
    </div>
  )
}


function ErrorCard({ message }) {
  return (
    <div style={{
      background: 'var(--blush-light, #fde7e3)', border: '1px solid var(--blush)', borderRadius: 12,
      padding: 16, marginBottom: 24, color: 'var(--blush)', fontSize: 14,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>Coach unavailable</strong>
        <div style={{ marginTop: 4, color: 'var(--slate)' }}>{message}</div>
      </div>
    </div>
  )
}
