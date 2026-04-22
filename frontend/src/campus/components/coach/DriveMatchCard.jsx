import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, ChevronDown, MapPin, DollarSign, Calendar } from 'lucide-react'
import FitRing from './FitRing'


export default function DriveMatchCard({ rec, index = 0 }) {
  const [open, setOpen] = useState(index === 0)
  const drv = rec.drive || {}
  const eligible = rec.eligible !== false
  const fit = Math.round(rec.fit_score || 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          padding: 16,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: '60px 1fr auto',
          gap: 14,
          alignItems: 'center',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <FitRing score={fit} size={56} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
            textTransform: 'uppercase', color: 'var(--slate-mid)',
            marginBottom: 3,
          }}>
            {drv.company || 'Company'}
            {drv.tier && (
              <span style={{
                marginLeft: 8, padding: '1px 6px', borderRadius: 4,
                background: 'var(--cream-deep)', color: 'var(--slate)',
                fontWeight: 600, fontSize: 10,
              }}>
                {drv.tier}
              </span>
            )}
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            {drv.role}
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 12,
            fontSize: 12, color: 'var(--slate)',
          }}>
            {drv.location && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={10} color="var(--slate-mid)" />{drv.location}
              </span>
            )}
            {drv.ctc_offered && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <DollarSign size={10} color="var(--slate-mid)" />
                {typeof drv.ctc_offered === 'number' ? `₹${(drv.ctc_offered / 100000).toFixed(1)}L` : drv.ctc_offered}
              </span>
            )}
            {drv.scheduled_date && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={10} color="var(--slate-mid)" />{drv.scheduled_date}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: eligible ? 'var(--moss-light)' : 'var(--blush-light)',
              color: eligible ? 'var(--moss)' : 'var(--blush)',
              border: `1px solid ${eligible ? 'rgba(94,122,82,0.3)' : 'rgba(196,117,106,0.3)'}`,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            {eligible ? <Check size={11} /> : <X size={11} />}
            {eligible ? 'Eligible' : 'Gap'}
          </span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ display: 'inline-flex' }}>
            <ChevronDown size={16} color="var(--slate-mid)" />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 16px 18px 16px',
              borderTop: '1px solid var(--border)',
              display: 'grid', gridTemplateColumns: '1fr', gap: 14,
            }}>
              {rec.violations?.length > 0 && (
                <div style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  background: 'var(--blush-pale, var(--blush-light))',
                  border: '1px solid rgba(196,117,106,0.25)',
                  borderRadius: 8,
                  fontSize: 12.5, color: 'var(--blush)',
                }}>
                  <strong>Not yet eligible:</strong> {rec.violations.join(' · ')}
                </div>
              )}
              <BulletBlock
                label="Why you fit"
                kind="good"
                items={rec.why_fit}
                empty="Coach couldn't extract specific fit signals."
                marginTop={14}
              />
              <BulletBlock
                label="What to close"
                kind="warn"
                items={rec.gap}
                empty="No obvious gaps — just apply."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}


function BulletBlock({ label, items, kind, empty, marginTop = 0 }) {
  const color = kind === 'good' ? 'var(--moss)' : 'var(--accent-warm, #b97f4d)'
  const dotBg = kind === 'good' ? 'var(--moss-light)' : 'var(--cream-deep)'
  return (
    <div style={{ marginTop }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
        textTransform: 'uppercase', color: 'var(--slate-mid)',
        marginBottom: 8,
      }}>{label}</div>
      {items?.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)' }}>
              <span style={{
                flexShrink: 0, marginTop: 6,
                width: 7, height: 7, borderRadius: '50%',
                background: color, boxShadow: `0 0 0 3px ${dotBg}`,
              }} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--slate-mid)', fontStyle: 'italic', margin: 0 }}>{empty}</p>
      )}
    </div>
  )
}
