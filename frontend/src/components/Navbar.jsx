import React, { useState, useEffect } from 'react'
import { Check, Sun, Moon } from 'lucide-react'
import { healthCheck } from '../utils/api'

const STEPS = [
  { num: 1, label: 'Upload', path: '/upload' },
  { num: 2, label: 'Processing', path: '/processing' },
  { num: 3, label: 'Results', path: '/results' },
  { num: 4, label: 'Export', path: '/export' },
]

function Navbar({ currentStep = 1 }) {
  const [apiOnline, setApiOnline] = useState(null) // null=checking, true=online, false=offline
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('tv-dark') === 'true'
  })

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('tv-dark', darkMode)
  }, [darkMode])

  // Live health check on mount and every 30s
  useEffect(() => {
    const check = async () => {
      try {
        await healthCheck()
        setApiOnline(true)
      } catch {
        setApiOnline(false)
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  const statusColor = apiOnline === null
    ? 'var(--slate-light)'
    : apiOnline
      ? 'var(--moss)'
      : 'var(--blush)'
  const statusText = apiOnline === null ? 'Connecting...' : apiOnline ? 'API Connected' : 'API Offline'

  return (
    <nav className="navbar">
      {/* Logo */}
      <div className="navbar-logo">
        <div className="navbar-logo-mark">TV</div>
        <span className="navbar-logo-name">Tech Vista</span>
        <span className="navbar-logo-author">by M S Vikram</span>
      </div>

      {/* Stepper */}
      <div className="stepper">
        {STEPS.map((step, i) => {
          const isActive = step.num === currentStep
          const isComplete = step.num < currentStep
          const circleClass = isComplete ? 'complete' : isActive ? 'active' : 'inactive'
          const labelClass = isComplete ? 'complete' : isActive ? 'active' : ''

          return (
            <React.Fragment key={step.num}>
              <div className="stepper-step">
                <div className={`stepper-circle ${circleClass}`}>
                  {isComplete ? <Check size={12} /> : step.num}
                </div>
                <span className={`stepper-label ${labelClass}`}>{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="stepper-connector">
                  <div
                    className="stepper-connector-fill"
                    style={{ width: isComplete ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Right side: dark mode + API status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(d => !d)}
          className="btn-ghost"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ padding: '6px 8px', borderRadius: 6 }}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* API Status */}
        <div className="api-status">
          <div className="api-status-dot" style={{ background: statusColor }} />
          <span className="api-status-text">{statusText}</span>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
