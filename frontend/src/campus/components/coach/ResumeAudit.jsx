import React from 'react'
import { motion } from 'framer-motion'
import { Check, AlertCircle, Hash, Zap } from 'lucide-react'


export default function ResumeAudit({ quality }) {
  if (!quality) return null
  const { score = 0, strengths = [], weaknesses = [], verb_diversity = {}, quantified_impact_ratio = 0 } = quality
  const diversityPct = Math.round((verb_diversity.score || 0) * 100)
  const quantPct = Math.round((quantified_impact_ratio || 0) * 100)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(200px, 260px) 1fr',
      gap: 24,
      alignItems: 'start',
    }}>
      {/* Score + metrics panel */}
      <div style={{
        background: 'var(--cream)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            textTransform: 'uppercase', color: 'var(--slate-mid)',
            marginBottom: 6,
          }}>Resume score</div>
          <div style={{
            fontSize: 48, fontWeight: 700, lineHeight: 1,
            color: scoreColor(score),
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {score}
            <span style={{ fontSize: 18, color: 'var(--slate-mid)', marginLeft: 4 }}>/100</span>
          </div>
        </div>
        <Metric
          label="Quantified bullets"
          icon={Hash}
          pct={quantPct}
          hint={`${quantPct}% of bullets include numbers`}
          goodAt={40}
        />
        <Metric
          label="Verb diversity"
          icon={Zap}
          pct={diversityPct}
          hint={
            verb_diversity.top_overused_verbs?.length
              ? `Overused: ${verb_diversity.top_overused_verbs.join(', ')}`
              : 'Varied vocabulary'
          }
          goodAt={60}
        />
      </div>

      {/* Strengths + weaknesses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Block
          title="What's working"
          icon={Check}
          items={strengths}
          tone="good"
          empty="Coach didn't call out specific strengths yet."
        />
        <Block
          title="Fix these"
          icon={AlertCircle}
          items={weaknesses}
          tone="warn"
          empty="No specific weaknesses flagged."
        />
      </div>
    </div>
  )
}


function scoreColor(score) {
  if (score >= 75) return 'var(--moss, #5e7a52)'
  if (score >= 55) return 'var(--sage, #4a7c6f)'
  if (score >= 35) return '#b97f4d'
  return 'var(--blush, #c4756a)'
}


function Metric({ label, icon: Icon, pct, hint, goodAt = 50 }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const color = clamped >= goodAt ? 'var(--moss)' : clamped >= goodAt - 20 ? 'var(--sage)' : 'var(--blush)'
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--ink)', fontWeight: 500, marginBottom: 5,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {Icon && <Icon size={11} color="var(--slate-mid)" />}{label}
        </span>
        <span style={{
          color, fontFamily: 'var(--font-mono, monospace)',
          fontSize: 11.5, fontWeight: 700,
        }}>{clamped}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--cream-mid, #eee)', overflow: 'hidden', marginBottom: 4 }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.7 }}
          style={{ height: '100%', background: color }}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--slate-mid)' }}>{hint}</div>
    </div>
  )
}


function Block({ title, icon: Icon, items, tone, empty }) {
  if (!items?.length) {
    return (
      <div>
        <Header title={title} Icon={Icon} tone={tone} />
        <p style={{ fontSize: 13, color: 'var(--slate-mid)', fontStyle: 'italic', margin: 0 }}>{empty}</p>
      </div>
    )
  }
  const bg = tone === 'good' ? 'var(--moss-light)' : 'var(--cream-deep)'
  const border = tone === 'good' ? 'rgba(94,122,82,0.25)' : 'rgba(196,117,106,0.25)'
  return (
    <div>
      <Header title={title} Icon={Icon} tone={tone} count={items.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              padding: '10px 12px',
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 9,
              fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)',
            }}
          >
            {it}
          </motion.div>
        ))}
      </div>
    </div>
  )
}


function Header({ title, Icon, tone, count }) {
  const color = tone === 'good' ? 'var(--moss)' : 'var(--blush)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 10, color,
    }}>
      {Icon && <Icon size={14} />}
      <span style={{
        fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>{title}</span>
      {typeof count === 'number' && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '1px 6px', borderRadius: 10,
          background: 'var(--cream)', color: 'var(--slate-mid)',
          border: '1px solid var(--border)',
        }}>{count}</span>
      )}
    </div>
  )
}
