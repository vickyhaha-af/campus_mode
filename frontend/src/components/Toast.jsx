import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: <CheckCircle size={16} />,
  error: <AlertCircle size={16} />,
  info: <Info size={16} />,
}
const COLORS = {
  success: { border: 'var(--moss)', icon: 'var(--moss)', bg: 'var(--moss-light)' },
  error: { border: 'var(--blush)', icon: 'var(--blush)', bg: 'var(--blush-light)' },
  info: { border: 'var(--sage)', icon: 'var(--sage)', bg: 'var(--sage-light)' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const toast = useCallback((message, type = 'info', duration = 2800) => {
    const id = ++counterRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 9000, pointerEvents: 'none'
      }}>
        <AnimatePresence>
          {toasts.map(t => {
            const col = COLORS[t.type] || COLORS.info
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.92 }}
                transition={{ duration: 0.2 }}
                style={{
                  pointerEvents: 'auto',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${col.border}`,
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-elevated)',
                  padding: '11px 14px',
                  minWidth: 260, maxWidth: 340,
                }}
              >
                <span style={{ color: col.icon, flexShrink: 0, display: 'flex' }}>
                  {ICONS[t.type]}
                </span>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13,
                  color: 'var(--ink)', flex: 1, lineHeight: 1.4
                }}>
                  {t.message}
                </span>
                <button
                  onClick={() => dismiss(t.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--slate-light)', padding: 2, flexShrink: 0, display: 'flex'
                  }}
                >
                  <X size={13} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
