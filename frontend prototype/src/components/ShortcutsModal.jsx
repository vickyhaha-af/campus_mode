import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useModalContext } from './ModalContext'

export default function ShortcutsModal({ isOpen, onClose }) {
  const { setModalOpen } = useModalContext()
  
  useEffect(() => {
    setModalOpen(isOpen)
    return () => setModalOpen(false)
  }, [isOpen, setModalOpen])
  const shortcuts = [
    { key: '↑ / ↓', action: 'Navigate candidates' },
    { key: 'E', action: 'Export results' },
    { key: 'C', action: 'Compare selected' },
    { key: 'T', action: 'Toggle dark theme' },
    { key: '?', action: 'Show this help' },
    { key: 'Esc', action: 'Close modals' },
  ]

  return (
    <motion.div
      initial={false}
      animate={isOpen ? 'open' : 'closed'}
      variants={{
        open: { opacity: 1, pointerEvents: 'auto' },
        closed: { opacity: 0, pointerEvents: 'none' },
      }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
      }}
    >
      {/* Spatial takeover backdrop */}
      <motion.div
        initial={false}
        animate={isOpen ? 'open' : 'closed'}
        variants={{
          open: { opacity: 1 },
          closed: { opacity: 0 },
        }}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(20px)',
        }}
      />

      {/* Modal Content - slides up from bottom */}
      <motion.div
        initial={false}
        animate={isOpen ? 'open' : 'closed'}
        variants={{
          open: { y: 0, opacity: 1 },
          closed: { y: '100%', opacity: 0 },
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'white',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.1)',
          maxHeight: '80vh',
          overflowY: 'auto',
          zIndex: 10,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'white',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--ink)',
            }}
          >
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--slate-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Shortcuts List */}
        <div style={{ padding: '24px' }}>
          {shortcuts.map((shortcut, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < shortcuts.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  color: 'var(--slate-mid)',
                }}
              >
                {shortcut.action}
              </span>
              <kbd
                style={{
                  background: 'var(--cream-mid)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              >
                {shortcut.key}
              </kbd>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--cream-pale)',
            fontSize: 12,
            color: 'var(--slate-mid)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Press <kbd style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 6px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}>Esc</kbd> to close
        </div>
      </motion.div>
    </motion.div>
  )
}
