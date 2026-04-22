import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'campus_theme'

function isSSR() {
  return typeof window === 'undefined'
}

function readInitial() {
  if (isSSR()) return 'light'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* ignore */
  }
  // Fall back to system preference on first visit.
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  } catch {
    /* ignore */
  }
  return 'light'
}

/** Apply the class synchronously so the page doesn't flash. Can be called on app boot. */
export function applyStoredTheme() {
  if (isSSR()) return
  const theme = readInitial()
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
}

export default function DarkModeToggle({ compact = false }) {
  const [theme, setTheme] = useState(() => (isSSR() ? 'light' : (document.documentElement.classList.contains('dark') ? 'dark' : 'light')))

  useEffect(() => {
    // Sync on mount in case applyStoredTheme wasn't called.
    const initial = readInitial()
    if (initial !== theme) setTheme(initial)
    if (!isSSR()) {
      document.documentElement.classList.toggle('dark', initial === 'dark')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      if (!isSSR()) {
        document.documentElement.classList.toggle('dark', next === 'dark')
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }

  const dark = theme === 'dark'
  const size = compact ? 28 : 32

  return (
    <motion.button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.92 }}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--white)',
        color: 'var(--slate)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {dark ? (
          <motion.span
            key="sun"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'inline-flex', color: 'var(--accent-warm)' }}
          >
            <Sun size={compact ? 13 : 15} strokeWidth={2.2} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'inline-flex', color: 'var(--sage-dim)' }}
          >
            <Moon size={compact ? 13 : 15} strokeWidth={2.2} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
