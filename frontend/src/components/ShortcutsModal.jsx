import React from 'react'
import { X, Keyboard } from 'lucide-react'
import { getShortcutList } from '../utils/shortcuts'

function ShortcutsModal({ onClose }) {
  const shortcuts = getShortcutList()

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white)', borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-elevated)',
          width: 380, padding: 28
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Keyboard size={16} style={{ color: 'var(--sage)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
              Keyboard Shortcuts
            </span>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {shortcuts.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 12px',
              background: i % 2 === 0 ? 'var(--cream)' : 'var(--white)',
              borderRadius: 6
            }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate)' }}>
                {s.desc}
              </span>
              <kbd style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                background: 'var(--cream-deep)', color: 'var(--ink)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4, padding: '2px 8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
              }}>{s.key}</kbd>
            </div>
          ))}
        </div>

        <p style={{
          marginTop: 16, fontFamily: 'var(--font-sans)', fontSize: 11,
          color: 'var(--slate-light)', textAlign: 'center'
        }}>
          Shortcuts are disabled when typing in inputs
        </p>
      </div>
    </div>
  )
}

export default ShortcutsModal
