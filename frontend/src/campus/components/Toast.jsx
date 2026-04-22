import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, AlertCircle, X } from 'lucide-react'

/**
 * Campus-scoped toast system.
 *
 * Usage:
 *   // at the app root (or at least above every campus page):
 *   <CampusToastProvider>
 *     <App />
 *   </CampusToastProvider>
 *
 *   // inside a component:
 *   const toast = useToast()
 *   toast.success('Shortlist created')
 *   toast.error('Ingest failed: ...')
 *   toast.info('Demo mode is read-only')
 *   toast.warning('Heads up...')
 *
 * Mount <ToastHost /> once at the top of <CampusNav /> or <App /> — it renders the stack.
 * If the provider already mounts its own host (it does), you don't need to call <ToastHost />.
 */

const CampusToastContext = createContext(null)

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    border: 'var(--moss)',
    iconColor: 'var(--moss)',
    bg: 'var(--moss-light)',
  },
  error: {
    icon: AlertCircle,
    border: 'var(--blush)',
    iconColor: 'var(--blush)',
    bg: 'var(--blush-light)',
  },
  info: {
    icon: Info,
    border: 'var(--sage)',
    iconColor: 'var(--sage)',
    bg: 'var(--sage-light)',
  },
  warning: {
    icon: AlertTriangle,
    border: 'var(--accent-warm)',
    iconColor: 'var(--accent-warm)',
    bg: 'var(--accent-warm-light)',
  },
}

export function CampusToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++counterRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  // Expose a stable API with variant shortcuts.
  const apiRef = useRef(null)
  if (!apiRef.current) {
    apiRef.current = {
      show: (msg, type, duration) => push(msg, type, duration),
      success: (msg, duration) => push(msg, 'success', duration),
      error: (msg, duration) => push(msg, 'error', duration ?? 5500),
      info: (msg, duration) => push(msg, 'info', duration),
      warning: (msg, duration) => push(msg, 'warning', duration),
      dismiss,
    }
  }

  return (
    <CampusToastContext.Provider value={apiRef.current}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </CampusToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(CampusToastContext)
  // Graceful no-op if provider isn't mounted — keeps pages that don't depend on it safe.
  if (!ctx) {
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
      dismiss: () => {},
    }
  }
  return ctx
}

/**
 * ToastHost — stackable top-right viewport container.
 * The provider mounts this automatically; exported so it can also be
 * mounted explicitly (e.g. at the top of CampusNav or App) if the
 * provider is applied outside the main React root.
 */
export function ToastHost({ toasts = [], onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 9000,
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const v = VARIANTS[t.type] || VARIANTS.info
          const Icon = v.icon
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.94 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: 'var(--white)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${v.border}`,
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-elevated)',
                padding: '12px 14px',
                minWidth: 260,
                maxWidth: 360,
              }}
            >
              <span
                style={{
                  background: v.bg,
                  color: v.iconColor,
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                <Icon size={14} />
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13.5,
                  color: 'var(--ink)',
                  flex: 1,
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}
              >
                {t.message}
              </span>
              <button
                onClick={() => onDismiss?.(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--slate-light)',
                  padding: 2,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default CampusToastProvider
