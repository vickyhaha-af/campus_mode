import React from 'react'
import { motion } from 'framer-motion'
import { Check, ShieldAlert, Award } from 'lucide-react'

function ScoringTable({
  scores,
  selectedCandidate,
  selectedIndex,
  onSelect,
  comparisonCandidates,
  onToggleComparison
}) {
  const getScoreColor = (score) => {
    if (score >= 80) return 'score-excellent'
    if (score >= 60) return 'score-good'
    if (score >= 40) return 'score-moderate'
    return 'score-low'
  }

  const getRankBadgeProps = (rank) => {
    if (rank === 1) return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' } // Gold
    if (rank === 2) return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' } // Silver
    if (rank === 3) return { color: '#b45309', bg: 'rgba(180, 83, 9, 0.15)' } // Bronze
    return { color: 'var(--text-muted)', bg: 'var(--bg-glass)' }
  }

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Rank</th>
              <th style={{ width: '40px' }}>Compare</th>
              <th>Candidate</th>
              <th>Match Score</th>
              <th>Skills</th>
              <th>Exp</th>
              <th>Edu</th>
              <th>Bias Audit</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((c, i) => {
              const isSelected = selectedIndex === i
              const isComparing = comparisonCandidates.some(comp => comp.candidate_name === c.candidate_name)
              const rb = getRankBadgeProps(c.rank)
              
              return (
                <motion.tr
                  key={c.candidate_name}
                  onClick={() => onSelect(c, i)}
                  className={isSelected ? 'selected' : ''}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <td style={{ textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: rb.bg,
                      color: rb.color,
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}>
                      {c.rank}
                    </div>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div
                      className={`checkbox ${isComparing ? 'checked' : ''}`}
                      onClick={() => onToggleComparison(c)}
                    >
                      {isComparing && <Check size={12} color="white" strokeWidth={3} />}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {c.candidate_name.replace('.pdf', '')}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={getScoreColor(c.composite_score)} style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                        {c.composite_score.toFixed(1)}%
                      </span>
                      {c.adjusted ? (
                        <div className="tooltip" data-tip="Auto-normalized for bias correction">
                          <Award size={14} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '80px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{c.skills_score.toFixed(1)}</span>
                      <div className="score-bar">
                        <div className="score-bar-fill" style={{ width: `${c.skills_score}%`, background: '#6366f1' }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '80px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{c.experience_score.toFixed(1)}</span>
                      <div className="score-bar">
                        <div className="score-bar-fill" style={{ width: `${c.experience_score}%`, background: '#10b981' }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '80px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{c.education_score.toFixed(1)}</span>
                      <div className="score-bar">
                        <div className="score-bar-fill" style={{ width: `${c.education_score}%`, background: '#f59e0b' }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.adjusted ? (
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Adjusted</span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Clear</span>
                    )}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ScoringTable
