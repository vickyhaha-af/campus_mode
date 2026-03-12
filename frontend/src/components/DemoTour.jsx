import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, ChevronRight, ChevronLeft, X, Sparkles, Shield, Scale, BarChart3, Download, Target } from 'lucide-react'

const STEPS = [
  {
    id: 'top-bar',
    icon: <Sparkles size={18} />,
    title: 'Screening Results',
    content: 'This is the main results dashboard. 15 candidates have been ranked semantically against the JD — not by keywords, but by meaning using Gemini embeddings.',
    highlight: null,
    position: 'bottom-center',
  },
  {
    id: 'candidate-list',
    icon: <Scale size={18} />,
    title: 'Ranked Candidates',
    content: 'Candidates are ranked by composite score (Skills × 50% + Experience × 30% + Education × 20%). Click any candidate to view their detailed AI reasoning. Use the ☐ checkbox to shortlist.',
    highlight: 'left-panel',
    position: 'right',
  },
  {
    id: 'score-breakdown',
    icon: <BarChart3 size={18} />,
    title: 'Explainable AI Scores',
    content: 'Every score comes with a plain-English explanation from Gemini Flash. Click the Skills, Experience or Education accordion to read exactly why the candidate was rated this way.',
    highlight: 'center-panel',
    position: 'left',
  },
  {
    id: 'skill-gap-tab',
    icon: <Target size={18} />,
    title: 'Skill Gap Analysis',
    content: 'Click the "Skill Gap" tab to see matched, adjacent, and missing skills for the selected candidate. This helps you understand fit at a glance without reading the resume.',
    highlight: 'tab-bar',
    position: 'bottom',
  },
  {
    id: 'jd-quality-tab',
    icon: <Target size={18} />,
    title: 'JD Quality Score',
    content: 'Click "JD Quality" to see how well-written the job description is. A vague JD leads to bad matches. Tech Vista scores it 0-100 and gives improvement suggestions.',
    highlight: 'tab-bar',
    position: 'bottom',
  },
  {
    id: 'bias-audit',
    icon: <Shield size={18} />,
    title: 'Statistical Bias Audit',
    content: 'The right panel shows the bias audit. Institution tier bias was detected (p=0.031) — scores from Tier 1 colleges were systematically higher. Tech Vista normalises scores to correct this.',
    highlight: 'right-panel',
    position: 'left',
  },
  {
    id: 'compare',
    icon: <Sparkles size={18} />,
    title: 'Compare Mode',
    content: 'Hit "Compare" in the top bar, then click "+" on up to 4 candidates. A radar chart lets you compare them side-by-side across all dimensions.',
    highlight: null,
    position: 'bottom-center',
  },
  {
    id: 'export',
    icon: <Download size={18} />,
    title: 'Export & Compliance',
    content: 'When ready, click "Export Results" to download a PDF report or CSV. All exports strip raw resume text — compliant with India\'s DPDPA 2023 data minimisation rules.',
    highlight: null,
    position: 'bottom-center',
  },
]

function DemoTour({ onDone }) {
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const current = STEPS[step]

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else { setDismissed(true); onDone?.() }
  }, [step, onDone])

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1)
  }, [step])

  const dismiss = useCallback(() => {
    setDismissed(true)
    onDone?.()
  }, [onDone])

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, dismiss])

  if (dismissed) return null

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        pointerEvents: 'none',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 32
      }}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.22 }}
          style={{
            pointerEvents: 'auto',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderLeft: '4px solid var(--sage)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-elevated)',
            width: 380, padding: 24,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--sage-pale)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--sage)'
              }}>
                {current.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    background: 'var(--sage-light)', color: 'var(--sage)',
                    borderRadius: 'var(--radius-pill)', padding: '2px 8px',
                    fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '0.06em'
                  }}>
                    ▶ Demo Tour {step + 1}/{STEPS.length}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginTop: 2 }}>
                  {current.title}
                </div>
              </div>
            </div>
            <button
              onClick={dismiss}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-light)', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate)',
            lineHeight: 1.65, marginBottom: 18
          }}>
            {current.content}
          </p>

          {/* Progress bar */}
          <div style={{
            height: 3, background: 'var(--cream-deep)',
            borderRadius: 2, marginBottom: 14, overflow: 'hidden'
          }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              style={{ height: '100%', background: 'var(--sage)', borderRadius: 2 }}
            />
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 16 }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? 20 : 7, height: 7,
                  borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: i === step ? 'var(--sage)' : i < step ? 'var(--cream-deep)' : 'var(--cream-deep)',
                  opacity: i < step ? 0.6 : 1,
                  transition: 'all 200ms', padding: 0
                }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="btn-ghost"
              onClick={prev}
              disabled={step === 0}
              style={{ visibility: step === 0 ? 'hidden' : 'visible', fontSize: 13, gap: 4 }}
            >
              <ChevronLeft size={13} /> Back
            </button>
            <button className="btn-ghost" onClick={dismiss} style={{ fontSize: 12, color: 'var(--slate-light)' }}>
              Skip tour
            </button>
            <button className="btn-primary" onClick={next} style={{ fontSize: 13, gap: 4, height: 34 }}>
              {step === STEPS.length - 1 ? 'Done!' : 'Next'} <ChevronRight size={13} />
            </button>
          </div>

          {/* Keyboard hint */}
          <p style={{
            textAlign: 'center', marginTop: 10,
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate-light)'
          }}>
            ← → to navigate · Esc to close
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default DemoTour
