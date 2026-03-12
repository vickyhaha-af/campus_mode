import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, TrendingUp, FileText } from 'lucide-react'

function JDQualityCard({ jdQuality }) {
  if (!jdQuality) return null

  const score = jdQuality.score || 0
  const color = score >= 80 ? 'var(--moss)' : score >= 50 ? '#92660A' : 'var(--blush)'
  const bg = score >= 80 ? 'var(--moss-light)' : score >= 50 ? '#FFF8E7' : 'var(--blush-light)'
  const label = score >= 80 ? 'Well-structured JD' : score >= 50 ? 'Needs improvement' : 'Sparse JD'

  // SVG ring
  const r = 36
  const circum = 2 * Math.PI * r
  const filled = (score / 100) * circum

  const checks = [
    { label: 'Responsibilities', ok: jdQuality.has_responsibilities },
    { label: 'Requirements', ok: jdQuality.has_requirements },
    { label: 'Nice-to-Haves', ok: jdQuality.has_nice_to_haves },
  ]

  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)', padding: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <FileText size={14} style={{ color: 'var(--sage)' }} />
        <span className="section-label" style={{ marginBottom: 0 }}>JD QUALITY</span>
      </div>

      {/* Score ring + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <svg width={84} height={84} style={{ flexShrink: 0 }}>
          <circle cx={42} cy={42} r={r} fill="none" stroke="var(--cream-deep)" strokeWidth={7} />
          <motion.circle
            cx={42} cy={42} r={r} fill="none"
            stroke={color} strokeWidth={7} strokeLinecap="round"
            strokeDasharray={`${filled} ${circum}`}
            transform="rotate(-90 42 42)"
            initial={{ strokeDasharray: `0 ${circum}` }}
            animate={{ strokeDasharray: `${filled} ${circum}` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <text x={42} y={42} textAnchor="middle" dominantBaseline="central"
            style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 16, fill: 'var(--ink)' }}>
            {score}
          </text>
        </svg>
        <div>
          <div style={{
            background: bg, color, borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '3px 10px', display: 'inline-block', marginBottom: 6
          }}>{label}</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--slate-mid)', lineHeight: 1.5 }}>
            {jdQuality.specificity_analysis}
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {checks.map(({ label, ok }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {ok
              ? <CheckCircle2 size={14} style={{ color: 'var(--moss)', flexShrink: 0 }} />
              : <AlertCircle size={14} style={{ color: '#92660A', flexShrink: 0 }} />
            }
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {jdQuality.improvement_suggestions?.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <TrendingUp size={12} style={{ color: 'var(--sage)' }} />
            <span className="section-label" style={{ marginBottom: 0 }}>SUGGESTIONS</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {jdQuality.improvement_suggestions.slice(0, 4).map((s, i) => (
              <li key={i} style={{
                fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--slate)',
                paddingLeft: 12, position: 'relative', lineHeight: 1.5
              }}>
                <span style={{ position: 'absolute', left: 0, color: 'var(--sage)' }}>·</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default JDQualityCard
