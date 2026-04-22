import React from 'react'
import { motion } from 'framer-motion'


/**
 * Circular progress ring showing a 0-100 score.
 * Colors grade: sage / moss for high, warm for mid, blush for low.
 */
export default function FitRing({ score = 0, size = 80, stroke = 6, label = null, accent = null }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  const color = accent || (
    clamped >= 70 ? 'var(--moss, #5e7a52)' :
    clamped >= 50 ? 'var(--sage, #4a7c6f)' :
    clamped >= 30 ? '#b97f4d' :
    'var(--blush, #c4756a)'
  )

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--cream-mid, #eee)" strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono, monospace)',
      }}>
        <span style={{
          fontSize: size * 0.32, fontWeight: 700, color: 'var(--ink)',
          lineHeight: 1,
        }}>
          {clamped}
        </span>
        {label && (
          <span style={{
            fontSize: Math.max(9, size * 0.13), color: 'var(--slate-mid)',
            marginTop: 2, letterSpacing: 0.4, textTransform: 'uppercase',
            fontWeight: 600,
          }}>{label}</span>
        )}
      </div>
    </div>
  )
}
