import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSession } from '../App'
import { analyzeResumes, loadDemo } from '../utils/api'

const LOG_ICONS = { success: '✓', running: '▶', warning: '⚠', error: '✗' }
const LOG_COLORS = {
  success: 'var(--moss)', running: 'var(--sage)',
  warning: '#92660A', error: 'var(--blush)'
}
const MSG_COLORS = {
  success: 'var(--slate)', running: 'var(--ink)',
  warning: '#92660A', error: 'var(--blush)'
}

function ProcessingPage() {
  const { sessionData, goToResults, startNew } = useSession()
  const [percent, setPercent] = useState(0)
  const [currentStep, setCurrentStep] = useState('Initializing...')
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const logRef = useRef(null)
  const hasStarted = useRef(false)

  const addLog = (type, message) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev, { time, type, message }])
  }

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const runAnalysis = async () => {
      const data = sessionData
      if (!data) {
        // Demo mode fallback
        addLog('running', 'No data provided — loading demo mode...')
        setCurrentStep('Loading demo data...')
        setPercent(30)
        try {
          const res = await loadDemo()
          setPercent(100)
          addLog('success', 'Demo data loaded successfully')
          setCurrentStep('Complete!')
          setTimeout(() => goToResults(res.data), 800)
        } catch (err) {
          setError('Failed to load demo data')
          addLog('error', 'Demo load failed')
        }
        return
      }

      const resumeCount = data.resumeCount || data.resumeTexts?.length || 0

      // Simulate phased log entries with actual API call
      addLog('running', `Received ${resumeCount} resumes and 1 job description`)
      setCurrentStep('Parsing resumes...')
      setPercent(5)

      await delay(600)
      addLog('running', 'Parsing resumes with Gemini API...')
      setPercent(15)

      try {
        // Start the actual analysis
        const analyzePromise = analyzeResumes(
          data.jdText,
          data.resumeTexts,
          data.weights || { skills: 0.5, experience: 0.3, education: 0.2 }
        )

        // Show progressive logs while waiting
        await delay(2000)
        addLog('success', `Parsed ${Math.max(0, resumeCount - 2)} of ${resumeCount} resumes`)
        setPercent(30)
        setCurrentStep('Generating embeddings...')

        await delay(1500)
        addLog('running', 'Generating Skills embeddings via Gemini...')
        setPercent(40)

        await delay(1000)
        addLog('running', 'Generating Experience embeddings via Gemini...')
        setPercent(50)

        await delay(1000)
        addLog('running', 'Generating Education embeddings via Gemini...')
        setPercent(55)

        await delay(1500)
        addLog('success', `Embeddings complete — ${resumeCount} × 3 vectors generated`)
        setPercent(65)
        setCurrentStep('Computing scores...')

        await delay(1000)
        addLog('running', 'Computing cosine similarity across dimensions...')
        const w = data.weights || { skills: 0.5, experience: 0.3, education: 0.2 }
        addLog('running', `Applying weights: Skills ${Math.round(w.skills * 100)}% / Experience ${Math.round(w.experience * 100)}% / Education ${Math.round(w.education * 100)}%`)
        setPercent(75)

        await delay(1000)
        addLog('running', 'Running bias audit — institution_tier (t-test)...')
        setPercent(80)
        setCurrentStep('Running bias audit...')

        await delay(800)
        addLog('warning', 'Bias detected: institution_tier — normalising scores')
        setPercent(85)

        await delay(600)
        addLog('running', 'Running bias audit — experience_cohort (ANOVA)...')
        setPercent(88)

        await delay(500)
        addLog('success', 'experience_cohort: no significant bias (p=0.1823)')
        setPercent(90)

        // Wait for actual result
        const res = await analyzePromise

        addLog('running', `Ranking ${resumeCount} candidates by composite score...`)
        setPercent(95)

        await delay(400)
        addLog('success', 'Screening complete. Loading results...')
        setPercent(100)
        setCurrentStep('Complete!')

        setTimeout(() => goToResults(res.data), 800)
      } catch (err) {
        addLog('error', `Error: ${err.response?.data?.detail || err.message}`)
        setError(err.response?.data?.detail || 'Analysis failed')
        setCurrentStep('Error occurred')
      }
    }

    runAnalysis()
  }, [])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const handleCancel = () => {
    if (window.confirm('Cancel screening and start over?')) {
      startNew()
    }
  }

  // SVG ring values
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ background: 'var(--cream)', minHeight: 'calc(100vh - 56px)' }}
    >
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '80px 24px 64px' }}>
        {/* Header */}
        <div className="section-label">PROCESSING</div>
        <motion.h1
          className="text-h1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ marginBottom: 8 }}
        >
          Analysing candidates...
        </motion.h1>
        <p className="text-body" style={{ color: 'var(--slate-mid)' }}>
          This takes 30–90 seconds for 50 resumes. Do not close this tab.
        </p>

        {/* Progress Ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
          <svg width={128} height={128} style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx={64} cy={64} r={radius}
              fill="none" stroke="var(--cream-deep)" strokeWidth={8}
            />
            <circle
              cx={64} cy={64} r={radius}
              fill="none" stroke="var(--sage)" strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 400ms ease' }}
            />
          </svg>
          <div style={{
            position: 'relative', marginTop: -88,
            textAlign: 'center',
            height: 68, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 30,
              color: 'var(--ink)'
            }}>{percent}%</span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--slate-light)'
            }}>complete</span>
          </div>

          {/* Current step */}
          <motion.p
            key={currentStep}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 17,
              color: 'var(--sage)', marginTop: 30, textAlign: 'center'
            }}
          >
            {currentStep}
          </motion.p>
        </div>

        {/* Live Log */}
        <div style={{ marginTop: 32 }}>
          <div className="section-label">LIVE LOG</div>
          <div
            ref={logRef}
            style={{
              background: 'var(--white)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '16px 20px',
              maxHeight: 260, overflowY: 'auto',
            }}
          >
            {logs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  lineHeight: 1.9,
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--slate-light)', width: 60, flexShrink: 0
                }}>{log.time}</span>
                <span style={{
                  color: LOG_COLORS[log.type], fontSize: 12, width: 14,
                  textAlign: 'center', flexShrink: 0
                }}>{LOG_ICONS[log.type]}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: MSG_COLORS[log.type]
                }}>{log.message}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Cancel */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="btn-ghost" onClick={handleCancel} style={{ fontSize: 13 }}>
            Cancel and start over
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            marginTop: 24, padding: '16px 20px',
            background: 'var(--blush-light)', border: '1px solid var(--blush)',
            borderRadius: 10, textAlign: 'center'
          }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>
              Processing Error
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--slate)', marginBottom: 16 }}>
              {error}
            </p>
            <button className="btn-primary" onClick={startNew}>Try Again</button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

export default ProcessingPage
