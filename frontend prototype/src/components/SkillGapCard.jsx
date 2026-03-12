import React from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, Target } from 'lucide-react'

export default function SkillGapCard({ candidate }) {
  if (!candidate) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        color: 'var(--slate-mid)',
      }}>
        <p>No candidate selected</p>
      </div>
    )
  }

  const jdSkills = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker']
  const candidateSkills = candidate.matched_skills || []
  const missingSkills = jdSkills.filter(s => !candidateSkills.includes(s))

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
        <Target size={18} style={{ color: 'var(--sage)' }} />
        Skill Gap Analysis
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Matched Skills */}
        <div style={{
          background: 'var(--sage-pale)',
          border: '1px solid rgba(74, 124, 111, 0.2)',
          borderRadius: 12,
          padding: 16,
        }}>
          <h4 style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--sage)',
            marginBottom: 12,
          }}>
            Matched Skills
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {candidateSkills.slice(0, 5).map((skill, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  background: 'white',
                  border: '1px solid var(--sage)',
                  color: 'var(--sage)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                ✓ {skill}
              </motion.span>
            ))}
          </div>
        </div>

        {/* Missing Skills */}
        <div style={{
          background: 'rgba(200, 100, 100, 0.05)',
          border: '1px solid rgba(200, 100, 100, 0.2)',
          borderRadius: 12,
          padding: 16,
        }}>
          <h4 style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--slate-dark)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <TrendingDown size={14} />
            Missing Skills
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {missingSkills.map((skill, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  background: 'white',
                  border: '1px solid rgba(180, 100, 100, 0.4)',
                  color: 'var(--slate-dark)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                ✗ {skill}
              </motion.span>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--cream-mid)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
        color: 'var(--slate-mid)',
        lineHeight: 1.6,
      }}>
        <p style={{ margin: 0 }}>
          {candidateSkills.length === jdSkills.length
            ? 'Perfect match! This candidate has all required skills.'
            : `This candidate has ${candidateSkills.length}/${jdSkills.length} required skills. Consider training in ${missingSkills.slice(0, 2).join(' and ')} to close the gap.`}
        </p>
      </div>
    </motion.div>
  )
}
