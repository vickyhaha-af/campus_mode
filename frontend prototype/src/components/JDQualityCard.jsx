import React from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle } from 'lucide-react'

export default function JDQualityCard({ jdQuality }) {
  if (!jdQuality) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        color: 'var(--slate-mid)',
      }}>
        <p>JD quality data not available</p>
      </div>
    )
  }

  const issues = [
    { id: 1, severity: 'medium', text: 'Missing required years of experience specification' },
    { id: 2, severity: 'low', text: 'Consider adding must-have vs. nice-to-have skills breakdown' },
    { id: 3, severity: 'high', text: 'Ambiguous language in key responsibilities' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h3 style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: 16,
        color: 'var(--ink)',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <CheckCircle size={18} style={{ color: 'var(--sage)' }} />
        Job Description Quality
      </h3>

      {/* Quality Score */}
      <div style={{
        background: 'var(--cream-mid)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'var(--slate-mid)',
            margin: 0,
          }}>Quality Score</p>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 28,
            color: 'var(--sage)',
            margin: '4px 0 0',
          }}>78%</p>
        </div>
        <div style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'conic-gradient(var(--sage) 78%, var(--border) 78%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 110,
            height: 110,
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--sage)',
            }}>78%</span>
          </div>
        </div>
      </div>

      {/* Issues */}
      <h4 style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        fontSize: 14,
        color: 'var(--ink)',
        marginBottom: 12,
      }}>Improvement Areas</h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {issues.map((issue, i) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            style={{
              background: issue.severity === 'high' ? 'rgba(220, 100, 100, 0.05)' : issue.severity === 'medium' ? 'rgba(220, 150, 100, 0.05)' : 'rgba(100, 180, 100, 0.05)',
              border: `1px solid ${issue.severity === 'high' ? 'rgba(220, 100, 100, 0.2)' : issue.severity === 'medium' ? 'rgba(220, 150, 100, 0.2)' : 'rgba(100, 180, 100, 0.2)'}`,
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle
              size={16}
              style={{
                color: issue.severity === 'high' ? '#dc6464' : issue.severity === 'medium' ? '#dc9664' : '#64b464',
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--slate-mid)',
              margin: 0,
              lineHeight: 1.5,
            }}>
              {issue.text}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
