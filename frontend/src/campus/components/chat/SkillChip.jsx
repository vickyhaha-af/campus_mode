import React from 'react'

/**
 * Small skill chip. `tone` controls palette:
 *   - 'match' (default) — sage, indicates skill overlaps JD
 *   - 'neutral'         — cream, general skill
 *   - 'gap'             — blush, missing skill
 */
export default function SkillChip({ children, tone = 'match', title }) {
  const palette = TONES[tone] || TONES.match
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px',
      fontFamily: 'var(--font-sans)',
      fontSize: 11.5, fontWeight: 500,
      lineHeight: 1.5,
      borderRadius: 'var(--radius-tag)',
      background: palette.bg,
      color: palette.fg,
      border: `1px solid ${palette.border}`,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

const TONES = {
  match: {
    bg: 'var(--sage-light)',
    fg: 'var(--sage)',
    border: 'rgba(74,124,111,0.22)',
  },
  neutral: {
    bg: 'var(--cream-mid)',
    fg: 'var(--slate)',
    border: 'var(--border)',
  },
  gap: {
    bg: 'var(--blush-light)',
    fg: 'var(--blush)',
    border: 'rgba(196,117,106,0.25)',
  },
  accent: {
    bg: 'rgba(179,150,114,0.12)',
    fg: 'var(--accent-education)',
    border: 'rgba(179,150,114,0.3)',
  },
}
