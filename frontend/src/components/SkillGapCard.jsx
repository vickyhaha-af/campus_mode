import React from 'react'
import { CheckCircle2, AlertCircle, XCircle, Target } from 'lucide-react'

function SkillGapCard({ candidate }) {
  if (!candidate) return null

  const matched = candidate.matched_skills || []
  const partial = candidate.partial_skills || []
  const missing = candidate.missing_skills || []

  const sections = [
    {
      title: `Matched (${matched.length})`,
      items: matched,
      Icon: CheckCircle2,
      color: 'var(--moss)',
      bg: 'var(--moss-light)',
      chipBg: 'var(--moss-light)',
      chipColor: 'var(--moss)',
    },
    {
      title: `Adjacent (${partial.length})`,
      items: partial,
      Icon: AlertCircle,
      color: '#92660A',
      bg: '#FFF8E7',
      chipBg: '#FFF8E7',
      chipColor: '#92660A',
    },
    {
      title: `Gaps (${missing.length})`,
      items: missing,
      Icon: XCircle,
      color: 'var(--blush)',
      bg: 'var(--blush-light)',
      chipBg: 'var(--blush-light)',
      chipColor: 'var(--blush)',
    },
  ].filter(s => s.items.length > 0)

  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)', padding: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Target size={15} style={{ color: 'var(--sage)' }} />
        <span className="section-label" style={{ marginBottom: 0 }}>SKILL GAP ANALYSIS</span>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 16 }}>
        {candidate.candidate_name}
      </p>

      {sections.length === 0 && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-light)' }}>
          No skill data available.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map(({ title, items, Icon, color, chipBg, chipColor }) => (
          <div key={title}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Icon size={13} style={{ color }} />
              <span style={{
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: '0.07em', color
              }}>{title}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {items.map((s, i) => (
                <span key={i} style={{
                  background: chipBg, color: chipColor,
                  border: `1px solid ${chipColor}33`,
                  borderRadius: 'var(--radius-tag)',
                  fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 12,
                  padding: '3px 8px'
                }}>{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* AI Reasoning */}
      <div style={{
        marginTop: 16, paddingTop: 14,
        borderTop: '1px solid var(--cream-deep)'
      }}>
        <div className="section-label" style={{ marginBottom: 8 }}>AI REASONING</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Skills', val: candidate.skills_explanation },
            { label: 'Experience', val: candidate.experience_explanation },
            { label: 'Education', val: candidate.education_explanation },
          ].map(r => r.val ? (
            <p key={r.label} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--slate)', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--ink)' }}>{r.label}: </strong>{r.val}
            </p>
          ) : null)}
        </div>
      </div>
    </div>
  )
}

export default SkillGapCard
