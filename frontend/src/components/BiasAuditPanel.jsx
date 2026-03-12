import React from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, ShieldCheck, TrendingUp, Info } from 'lucide-react'

function BiasAuditPanel({ biasAudit, scores }) {
  if (!biasAudit) return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
      <p style={{ color: 'var(--text-muted)' }}>Not enough candidates to run structured bias tests (need at least 6).</p>
    </div>
  )

  const hasBias = biasAudit.flags_detected > 0

  return (
    <div className="glass-card" style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: hasBias ? 'var(--warning-bg)' : 'var(--success-bg)',
          color: hasBias ? 'var(--warning)' : 'var(--success)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {hasBias ? <ShieldAlert size={32} /> : <ShieldCheck size={32} />}
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
            {hasBias ? 'Bias Flags Detected & Auto-Corrected' : 'No Systemic Bias Detected'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tech Vista ran algorithmic validation on the AI scoring model using non-parametric statistical tests (Mann-Whitney U / Kruskal-Wallis).
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {Object.entries(biasAudit.details).map(([category, detail], i) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            style={{
              background: 'var(--bg-secondary)',
              border: `1px solid ${detail.bias_detected ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ textTransform: 'capitalize' }}>{category.replace('_', ' ')}</h3>
              {detail.bias_detected ? (
                <span className="badge badge-warning">Flagged (p &lt; 0.05)</span>
              ) : (
                <span className="badge badge-success">Clear</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Test Used:</span>
                <span>{detail.test_used}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>p-value:</span>
                <span style={{ fontWeight: 600, color: detail.bias_detected ? 'var(--warning)' : 'var(--text-primary)' }}>
                  {detail.p_value ? detail.p_value.toFixed(4) : 'N/A'}
                </span>
              </div>
              {detail.effect_size && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Effect Size (d):</span>
                  <span>{detail.effect_size.toFixed(2)}</span>
                </div>
              )}

              {/* Averages per group */}
              {Object.keys(detail.group_averages).length > 0 && (
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Group Averages</div>
                  {Object.entries(detail.group_averages).map(([group, avg]) => (
                    <div key={group} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.85rem' }}>{group}</span>
                      <span style={{ fontWeight: 600 }}>{avg.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {detail.bias_detected && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--warning)', fontSize: '0.85rem' }}>
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Scores for underrepresented groups in this category have been linearly normalized by +{((scores.find(s => s.adjusted)?.composite_score || 0) - (scores.find(s => !s.adjusted)?.composite_score || 0)).toFixed(1)}% to correct systemic model drift.</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default BiasAuditPanel
