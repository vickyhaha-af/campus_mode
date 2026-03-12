import React from 'react'
import { motion } from 'framer-motion'
import { X, GitCompare } from 'lucide-react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip
} from 'recharts'

const COLORS = ['var(--accent-skills)', 'var(--accent-experience)', 'var(--accent-education)', 'var(--blush)']
const HEX_COLORS = ['#4A7C6F', '#7B8FA8', '#B39672', '#C4756A']

function CandidateComparison({ candidates, onClose }) {
  if (!candidates || candidates.length < 2) return null

  const radarData = [
    { subject: 'Skills', fullMark: 100 },
    { subject: 'Experience', fullMark: 100 },
    { subject: 'Education', fullMark: 100 },
  ]
  radarData.forEach((row, i) => {
    candidates.forEach((c) => {
      row[c.candidate_name] = i === 0 ? c.skills_score : i === 1 ? c.experience_score : c.education_score
    })
  })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300
      }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          background: 'var(--white)', borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-elevated)',
          width: '90vw', maxWidth: 920, maxHeight: '90vh',
          overflow: 'auto', padding: 32
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitCompare size={18} style={{ color: 'var(--sage)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: 'var(--ink)' }}>
              Candidate Comparison
            </span>
            <span className="chip">{candidates.length} selected</span>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          {/* Radar Chart */}
          <div style={{
            background: 'var(--cream)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 20
          }}>
            <div className="section-label" style={{ marginBottom: 12 }}>MULTI-DIMENSIONAL MATCH</div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: 'var(--slate-mid)', fontSize: 13, fontFamily: 'var(--font-sans)' }}
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]}
                  tick={{ fill: 'var(--slate-light)', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--white)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)'
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 12, fontFamily: 'var(--font-sans)', fontSize: 12 }} />
                {candidates.map((c, i) => (
                  <Radar
                    key={c.candidate_name}
                    name={c.candidate_name.replace('.pdf', '').substring(0, 16)}
                    dataKey={c.candidate_name}
                    stroke={HEX_COLORS[i % HEX_COLORS.length]}
                    fill={HEX_COLORS[i % HEX_COLORS.length]}
                    fillOpacity={0.25}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Score Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="section-label">SCORE BREAKDOWN</div>
            {candidates.map((c, i) => (
              <div key={i} style={{
                background: 'var(--cream)', border: '1px solid var(--border)',
                borderLeft: `4px solid ${HEX_COLORS[i % HEX_COLORS.length]}`,
                borderRadius: 10, padding: '14px 18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                      #{c.rank} — {c.candidate_name.replace('.pdf', '')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--slate-mid)', marginTop: 2 }}>
                      {c.experience_years?.toFixed(1)} yrs · {(c.experience_cohort || '').replace('_', ' ')} · {(c.institution_tier || '').replace('_', ' ')}
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 22,
                    color: HEX_COLORS[i % HEX_COLORS.length]
                  }}>
                    {c.composite_score.toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                  {[
                    { label: 'Skills', val: c.skills_score },
                    { label: 'Exp.', val: c.experience_score },
                    { label: 'Edu.', val: c.education_score },
                  ].map(d => (
                    <div key={d.label} style={{
                      background: 'var(--white)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '8px 10px', textAlign: 'center'
                    }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>{d.val.toFixed(0)}%</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--slate-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.label}</div>
                    </div>
                  ))}
                </div>
                {(c.matched_skills || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                    {(c.matched_skills || []).slice(0, 5).map(s => (
                      <span key={s} className="chip" style={{ fontSize: 11 }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button className="btn-secondary" onClick={onClose}>Close Comparison</button>
        </div>
      </motion.div>
    </div>
  )
}

export default CandidateComparison
