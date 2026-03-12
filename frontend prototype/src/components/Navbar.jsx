import React from 'react'
import { useSession } from '../App'
import MagneticButton from './MagneticButton'

const STEPS = [
  { n: 1, label: 'Upload' },
  { n: 2, label: 'Processing' },
  { n: 3, label: 'Results' },
  { n: 4, label: 'Export' },
]

export default function Navbar({ currentStep }) {
  const { goHome, startNew } = useSession()

  return (
    <nav className="navbar">
      {/* Logo */}
      <button
        onClick={goHome}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, padding: 0,
          textDecoration: 'none',
        }}
      >
        <div className="navbar-logo-mark">TV</div>
        <span className="navbar-logo-name">Tech Vista</span>
        <span className="navbar-logo-author">by M S Vikram</span>
      </button>

      {/* Step Indicator */}
      <div className="stepper">
        {STEPS.map((step, i) => {
          const state =
            currentStep > step.n ? 'complete' :
            currentStep === step.n ? 'active' : 'inactive'

          return (
            <React.Fragment key={step.n}>
              {i > 0 && (
                <div className="stepper-connector">
                  <div
                    className="stepper-connector-fill"
                    style={{ width: state === 'complete' || currentStep > step.n ? '100%' : '0%' }}
                  />
                </div>
              )}
              <div className="stepper-step">
                <div className={`stepper-circle ${state}`}>{step.n}</div>
                <span className={`stepper-label ${state}`}>{step.label}</span>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="api-status">
          <div className="api-status-dot" />
          <span className="api-status-text">API Online</span>
        </div>
        {currentStep > 1 && (
          <MagneticButton
            className="btn-ghost"
            onClick={startNew}
            style={{ fontSize: 13 }}
          >
            New Screening
          </MagneticButton>
        )}
      </div>
    </nav>
  )
}
