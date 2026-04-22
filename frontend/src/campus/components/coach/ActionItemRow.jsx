import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Flame } from 'lucide-react'


const PRIORITY_STYLE = {
  high:   { bg: 'var(--blush-light)',  color: 'var(--blush)',   ring: 'rgba(196,117,106,0.3)' },
  medium: { bg: 'var(--cream-deep)',   color: '#b97f4d',        ring: 'rgba(185,127,77,0.3)'  },
  low:    { bg: 'var(--moss-light)',   color: 'var(--moss)',    ring: 'rgba(94,122,82,0.25)'  },
}


export default function ActionItemRow({ item, index = 0 }) {
  const [done, setDone] = useState(false)
  const pr = (item.priority || 'medium').toLowerCase()
  const pStyle = PRIORITY_STYLE[pr] || PRIORITY_STYLE.medium
  const deadline = item.deadline_weeks

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: done ? 0.55 : 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 14,
        alignItems: 'start',
        padding: '12px 14px',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <button
        onClick={() => setDone((v) => !v)}
        aria-label={done ? 'Unmark done' : 'Mark done'}
        style={{
          width: 20, height: 20, borderRadius: 5,
          marginTop: 2,
          background: done ? 'var(--moss)' : 'transparent',
          border: done ? 'none' : '1.5px solid var(--border-strong, var(--slate-mid))',
          cursor: 'pointer',
          padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 180ms, border 180ms',
          flexShrink: 0,
        }}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.2L4.7 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div>
        <div style={{
          fontSize: 14.5, fontWeight: 600, color: 'var(--ink)',
          textDecoration: done ? 'line-through' : 'none',
          marginBottom: 4, lineHeight: 1.4,
        }}>
          {item.title}
        </div>
        {item.why && (
          <div style={{ fontSize: 12.5, color: 'var(--slate)', lineHeight: 1.55 }}>
            {item.why}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', borderRadius: 999,
          background: pStyle.bg, color: pStyle.color,
          border: `1px solid ${pStyle.ring}`,
          fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
        }}>
          {pr === 'high' && <Flame size={10} />}
          {pr}
        </span>
        {deadline != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: 'var(--slate-mid)',
          }}>
            <Clock size={10} />{deadline}w
          </span>
        )}
      </div>
    </motion.div>
  )
}
