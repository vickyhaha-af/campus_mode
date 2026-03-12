import React from 'react'
import { motion } from 'framer-motion'
import { Users, TrendingUp, Clock, AlertTriangle } from 'lucide-react'

function SessionSummary({ sessionData }) {
  const scores = sessionData?.scores || []
  const avgScore = scores.length ? (scores.reduce((a, s) => a + s.composite_score, 0) / scores.length).toFixed(1) : 0
  const biasFlags = sessionData?.bias_audit?.flags_detected || 0
  const timeSaved = (scores.length * 3.48).toFixed(1) // ~3.48 hrs saved per resume vs manual (52.2hrs / 15 resumes)

  const stats = [
    { icon: <Users size={22} />, value: scores.length, label: 'Candidates Scored', color: '#6366f1' },
    { icon: <TrendingUp size={22} />, value: `${avgScore}%`, label: 'Average Match', color: '#10b981' },
    { icon: <Clock size={22} />, value: `${timeSaved}h`, label: 'Time Saved', color: '#06b6d4' },
    { icon: <AlertTriangle size={22} />, value: biasFlags, label: biasFlags > 0 ? 'Bias Flags Detected' : 'No Bias Flags', color: biasFlags > 0 ? '#f59e0b' : '#10b981' },
  ]

  return (
    <div className="stats-bar">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="stat-icon" style={{ background: `${stat.color}15`, color: stat.color }}>
            {stat.icon}
          </div>
          <div>
            <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default SessionSummary
