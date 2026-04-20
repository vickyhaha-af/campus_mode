import React from 'react'
import { motion } from 'framer-motion'

/**
 * Circular SVG progress ring for a fit score.
 *
 * Score ranges:
 *   0-60   sage gradient (tepid)
 *   60-80  amber gradient (good)
 *   80+    emerald gradient (excellent)
 *
 * Accepts either the 0-100 scale score or the raw fit (e.g. 35.4). If the
 * value is <= 1.5x of 60 we assume a 0-100 scale already; otherwise the caller
 * should pre-normalize. We render the original value in the center though, so
 * UX stays honest.
 */
export default function FitRing({ score, size = 64, stroke = 6, displayValue }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0))
  const palette = paletteFor(clamped)
  const gradId = React.useId()

  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)

  // Value shown in middle. Prefer explicit displayValue (e.g. raw fit 35.4),
  // otherwise show the normalized integer score.
  const label = displayValue != null ? displayValue : Math.round(clamped)

  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      flexShrink: 0,
    }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.from} />
            <stop offset="100%" stopColor={palette.to} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="var(--cream-deep)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        color: palette.text,
        lineHeight: 1,
      }}>
        <span style={{ fontSize: size * 0.28 }}>{label}</span>
        <span style={{ fontSize: size * 0.14, color: 'var(--slate-mid)', marginTop: 2, letterSpacing: '0.04em' }}>FIT</span>
      </div>
    </div>
  )
}

function paletteFor(v) {
  if (v >= 80) return { from: '#4E8B6A', to: '#2F6B4A', text: '#2F6B4A' }          // emerald
  if (v >= 60) return { from: '#D1A15B', to: '#B3814E', text: '#8A6030' }          // amber
  return { from: '#6B9A8C', to: '#4A7C6F', text: 'var(--sage-dim)' }                // sage
}
