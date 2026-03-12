import React, { useState, useEffect } from 'react'
import { Sliders } from 'lucide-react'

function WeightSliders({ weights, onChange }) {
  const [local, setLocal] = useState({
    skills: (weights?.skills || 0.5) * 100,
    experience: (weights?.experience || 0.3) * 100,
    education: (weights?.education || 0.2) * 100
  })

  useEffect(() => {
    if (weights) {
      setLocal({
        skills: weights.skills * 100,
        experience: weights.experience * 100,
        education: weights.education * 100
      })
    }
  }, [weights])

  const handleChange = (dimension, value) => {
    const numVal = Number(value)
    const remaining = 100 - numVal
    const others = Object.keys(local).filter(k => k !== dimension)
    const otherSum = others.reduce((a, k) => a + local[k], 0)

    const newWeights = { ...local, [dimension]: numVal }
    if (otherSum > 0) {
      others.forEach(k => {
        newWeights[k] = Math.max(0, (local[k] / otherSum) * remaining)
      })
    } else {
      others.forEach((k, i) => {
        newWeights[k] = remaining / others.length
      })
    }

    setLocal(newWeights)
  }

  const handleRelease = () => {
    const total = local.skills + local.experience + local.education
    onChange({
      skills: Math.round(local.skills / total * 100) / 100,
      experience: Math.round(local.experience / total * 100) / 100,
      education: Math.round(local.education / total * 100) / 100
    })
  }

  const sliders = [
    { key: 'skills', label: 'Skills', color: '#6366f1' },
    { key: 'experience', label: 'Experience', color: '#10b981' },
    { key: 'education', label: 'Education', color: '#f59e0b' }
  ]

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Sliders size={16} style={{ color: 'var(--accent-primary)' }} />
        <h3 style={{ fontSize: '0.95rem' }}>Scoring Weights</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sliders.map(s => (
          <div key={s.key} className="weight-slider">
            <label>
              <span>{s.label}</span>
              <span style={{ color: s.color, fontWeight: 600 }}>{Math.round(local[s.key])}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(local[s.key])}
              onChange={e => handleChange(s.key, e.target.value)}
              onMouseUp={handleRelease}
              onTouchEnd={handleRelease}
              style={{ accentColor: s.color }}
            />
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
        Adjust weights to rerank — no re-embedding needed
      </p>
    </div>
  )
}

export default WeightSliders
