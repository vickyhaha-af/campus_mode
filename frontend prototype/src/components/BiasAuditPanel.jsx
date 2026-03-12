import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════
// TEXT SCRAMBLE HOOK — Matrix-style number decode effect
// ═══════════════════════════════════════════════════════════════════
function useTextScramble(finalValue, duration = 500, delay = 0) {
  const [display, setDisplay] = useState('')
  const [isScrambling, setIsScrambling] = useState(true)
  
  useEffect(() => {
    if (finalValue == null) {
      setDisplay('-')
      setIsScrambling(false)
      return
    }
    
    const chars = '0123456789.'
    const finalStr = typeof finalValue === 'number' ? finalValue.toFixed(3) : String(finalValue)
    const frameInterval = 30
    const totalFrames = Math.floor(duration / frameInterval)
    let frame = 0
    
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        frame++
        const progress = frame / totalFrames
        
        // Progressively reveal characters from left to right
        const revealedLength = Math.floor(progress * finalStr.length)
        let result = ''
        
        for (let i = 0; i < finalStr.length; i++) {
          if (i < revealedLength) {
            result += finalStr[i]
          } else {
            result += chars[Math.floor(Math.random() * chars.length)]
          }
        }
        
        setDisplay(result)
        
        if (frame >= totalFrames) {
          clearInterval(interval)
          setDisplay(finalStr)
          setIsScrambling(false)
        }
      }, frameInterval)
      
      return () => clearInterval(interval)
    }, delay)
    
    return () => clearTimeout(timeout)
  }, [finalValue, duration, delay])
  
  return { display, isScrambling }
}

// ═══════════════════════════════════════════════════════════════════
// PULSE RING — Radar ping animation
// ═══════════════════════════════════════════════════════════════════
function PulseRing({ color, size = 24 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${color}`,
          }}
          initial={{ scale: 0.5, opacity: 0.8 }}
          animate={{
            scale: [0.5, 1.8],
            opacity: [0.8, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeOut',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: '30%',
          borderRadius: '50%',
          background: color,
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SCRAMBLE VALUE CELL — Animated p-value display
// ═══════════════════════════════════════════════════════════════════
function ScrambleValue({ value, isFlagged, delay = 0 }) {
  const { display, isScrambling } = useTextScramble(value, 500, delay)
  
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: isFlagged ? 'var(--blush)' : 'var(--moss)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: isScrambling ? '0.05em' : '0',
        transition: 'letter-spacing 150ms',
      }}
    >
      {display}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SCANNER LINE — Aceternity-style sweep effect
// ═══════════════════════════════════════════════════════════════════
function ScannerLine({ onComplete }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        background: 'linear-gradient(90deg, transparent 0%, var(--sage) 20%, var(--sage) 80%, transparent 100%)',
        boxShadow: '0 0 20px var(--sage), 0 0 40px var(--sage), 0 0 60px rgba(74,124,111,0.5)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
      initial={{ top: 0, opacity: 1 }}
      animate={{ top: '100%', opacity: [1, 1, 0] }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
      onAnimationComplete={onComplete}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════
// STATUS BADGE WITH PULSE
// ═══════════════════════════════════════════════════════════════════
function StatusBadge({ isFlagged, delay = 0 }) {
  const [showPulse, setShowPulse] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(true), delay + 500)
    return () => clearTimeout(timer)
  }, [delay])
  
  const color = isFlagged ? 'var(--blush)' : 'var(--moss)'
  
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <AnimatePresence>
        {showPulse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)' }}
          >
            <PulseRing color={color} size={18} />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay / 1000 + 0.3, type: 'spring', stiffness: 400 }}
        style={{
          marginLeft: 20,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9,
          padding: '2px 6px',
          borderRadius: 'var(--radius-tag)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          textTransform: 'uppercase',
          background: isFlagged ? 'var(--blush-light)' : 'var(--moss-light)',
          color: color,
          border: `1px solid ${color}`,
        }}
      >
        {isFlagged && (
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: color,
            }}
          />
        )}
        {isFlagged ? 'FLAG' : 'PASS'}
      </motion.span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT — BiasAuditPanel
// ═══════════════════════════════════════════════════════════════════
export default function BiasAuditPanel({ biasAudit, scoresCount }) {
  const [scanComplete, setScanComplete] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const panelRef = useRef(null)
  
  useEffect(() => {
    if (scanComplete) {
      const timer = setTimeout(() => setShowContent(true), 100)
      return () => clearTimeout(timer)
    }
  }, [scanComplete])
  
  const isFlagged = biasAudit?.overall_status === 'Flagged'
  const statusColor = isFlagged ? 'var(--blush)' : 'var(--moss)'
  
  return (
    <div ref={panelRef} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Scanner Line Effect */}
      {!scanComplete && <ScannerLine onComplete={() => setScanComplete(true)} />}
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Shield size={14} style={{ color: 'var(--slate-mid)' }} />
        <span className="section-label" style={{ marginBottom: 0 }}>BIAS AUDIT</span>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--slate-mid)', marginTop: 4 }}>
        Statistical fairness on {scoresCount} candidates
      </p>
      
      {/* Warning for insufficient candidates */}
      {scoresCount < 6 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 10 }}
          style={{
            marginTop: 12,
            padding: '10px 12px',
            background: '#FFF8E7',
            border: '1px solid rgba(146,102,10,0.25)',
            borderRadius: 8,
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: '#92660A',
          }}
        >
          Bias audit requires 6+ candidates. {6 - scoresCount} more needed.
        </motion.div>
      )}
      
      {/* Overall Status Card */}
      {biasAudit && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 10 }}
          transition={{ delay: 0.1 }}
          style={{
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 'var(--radius-card)',
            background: isFlagged ? 'var(--blush-light)' : 'var(--moss-light)',
            borderLeft: `4px solid ${statusColor}`,
            border: '1px solid var(--border)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle scan lines overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0,0,0,0.02) 2px,
                rgba(0,0,0,0.02) 4px
              )`,
              pointerEvents: 'none',
            }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            {/* Pulse indicator */}
            <PulseRing color={statusColor} size={28} />
            
            <div>
              {isFlagged ? (
                <>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--blush)' }}>
                    {biasAudit.flags_detected} Flag{biasAudit.flags_detected !== 1 ? 's' : ''} Detected
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--blush)', opacity: 0.8 }}>
                    Normalisation applied
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--moss)' }}>
                    All Checks Passed
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--moss)', opacity: 0.8 }}>
                    No normalisation applied
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Test Results Table */}
      {biasAudit?.details && Object.keys(biasAudit.details).length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showContent ? 1 : 0 }}
          transition={{ delay: 0.2 }}
          style={{ marginTop: 16 }}
        >
          <div className="section-label">TEST RESULTS</div>
          <div
            style={{
              marginTop: 8,
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--cream-mid)' }}>
                  {['Category', 'Test', 'p-value', 'Status'].map((h) => (
                    <th
                      key={h}
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        color: 'var(--slate-mid)',
                        padding: '8px 8px',
                        textAlign: 'left',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {Object.entries(biasAudit.details).map(([cat, detail], i) => (
                    <motion.tr
                      key={cat}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: showContent ? 1 : 0, x: showContent ? 0 : -10 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      style={{ background: i % 2 === 0 ? 'var(--white)' : 'var(--cream-mid)' }}
                    >
                      <td
                        style={{
                          padding: '10px 8px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--slate)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {cat.replace('_', ' ')}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--slate)',
                        }}
                      >
                        {detail.test_used}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <ScrambleValue
                          value={detail.p_value}
                          isFlagged={detail.bias_detected}
                          delay={300 + i * 100}
                        />
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <StatusBadge isFlagged={detail.bias_detected} delay={300 + i * 100} />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
