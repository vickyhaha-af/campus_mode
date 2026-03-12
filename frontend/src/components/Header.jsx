import React from 'react'
import { Sun, Moon, ArrowLeft, Keyboard } from 'lucide-react'

function Header({ theme, onToggleTheme, onBack, sessionData }) {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {onBack && (
          <button className="btn btn-ghost btn-sm" onClick={onBack} title="Back to Upload">
            <ArrowLeft size={18} />
          </button>
        )}
        <a href="/" className="header-logo" onClick={e => { e.preventDefault(); onBack?.() }}>
          <div className="header-logo-icon">TV</div>
          <span className="header-logo-text">Tech Vista</span>
        </a>
        {sessionData?.is_demo && (
          <span className="badge badge-info">DEMO MODE</span>
        )}
      </div>
      <div className="header-actions">
        <button
          className="btn btn-ghost btn-sm tooltip"
          onClick={onToggleTheme}
          data-tip={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="btn btn-ghost btn-sm tooltip"
          data-tip="Keyboard shortcuts (?)"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
        >
          <Keyboard size={18} />
        </button>
      </div>
    </header>
  )
}

export default Header
