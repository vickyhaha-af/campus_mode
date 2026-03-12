import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, ZAxis
} from 'recharts'
import { motion } from 'framer-motion'
import { BarChart3, ScatterChart as ScatterIcon } from 'lucide-react'

// Custom tooltip for styled hover info
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="glass-card" style={{ padding: '12px', minWidth: '150px' }}>
        <p style={{ fontWeight: 600, marginBottom: '4px' }}>{data.name || label}</p>
        {data.score !== undefined && (
          <p style={{ fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
            Score: <span style={{ fontWeight: 700 }}>{data.score.toFixed(1)}%</span>
          </p>
        )}
        {data.count !== undefined && (
          <p style={{ fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
            Count: <span style={{ fontWeight: 700 }}>{data.count}</span> candidates
          </p>
        )}
      </div>
    )
  }
  return null
}

function ScoreDistribution({ scores, onSelectCandidate }) {
  // Histogram data
  const histogramData = useMemo(() => {
    const bins = [
      { range: '0-20', label: '<20', min: 0, max: 20, count: 0, candidates: [] },
      { range: '21-40', label: '21-40', min: 21, max: 40, count: 0, candidates: [] },
      { range: '41-60', label: '41-60', min: 41, max: 60, count: 0, candidates: [] },
      { range: '61-80', label: '61-80', min: 61, max: 80, count: 0, candidates: [] },
      { range: '81-100', label: '>80', min: 81, max: 100, count: 0, candidates: [] }
    ]

    scores.forEach((s) => {
      const b = bins.find(bin => s.composite_score >= bin.min && s.composite_score <= bin.max) || bins[0]
      b.count++
      b.candidates.push(s)
    })

    return bins
  }, [scores])

  // Scatter data (Score vs Rank)
  const scatterData = useMemo(() => {
    return scores.map((s, i) => ({
      name: s.candidate_name,
      rank: s.rank,
      score: s.composite_score,
      originalIndex: i
    }))
  }, [scores])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
      
      {/* Histogram */}
      <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <BarChart3 size={20} style={{ color: 'var(--accent-primary)' }} />
          <h3>Score Distribution</h3>
        </div>
        
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-glass-hover)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {histogramData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.max > 80 ? '#10b981' : entry.max > 60 ? '#6366f1' : entry.max > 40 ? '#f59e0b' : '#ef4444'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Scatter / Rank View */}
      <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <ScatterIcon size={20} style={{ color: 'var(--accent-secondary)' }} />
          <h3>Rank vs Match Score</h3>
        </div>
        
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="rank" name="Rank" type="number" reversed stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis dataKey="score" name="Score" domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <ZAxis range={[100, 100]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--border-accent)' }} />
              <Scatter name="Candidates" data={scatterData} fill="var(--accent-primary)">
                {scatterData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.score > 80 ? '#10b981' : entry.score > 60 ? '#6366f1' : entry.score > 40 ? '#f59e0b' : '#ef4444'}
                    onClick={() => onSelectCandidate(scores[entry.originalIndex], entry.originalIndex)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
          Click a dot to view candidate details
        </p>
      </motion.div>

    </div>
  )
}

export default ScoreDistribution
