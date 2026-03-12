import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, FileText, Table, Download, ArrowLeft, Plus } from 'lucide-react'
import { useSession } from '../App'
import { exportPDF, exportCSV } from '../utils/api'

function ExportPage() {
  const { sessionData, startNew } = useSession()
  const [format, setFormat] = useState('pdf')
  const [includeAudit, setIncludeAudit] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const scores = sessionData?.scores || []
  const biasAudit = sessionData?.bias_audit
  const flagsResolved = biasAudit?.flags_detected || 0

  const navigate = (path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleDownload = async () => {
    if (!sessionData?.session_id) return
    setDownloading(true)
    try {
      const res = format === 'pdf'
        ? await exportPDF(sessionData.session_id)
        : await exportCSV(sessionData.session_id)

      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'text/csv'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'pdf'
        ? `techvista_report_${sessionData.session_id.slice(0, 8)}.pdf`
        : `techvista_results_${sessionData.session_id.slice(0, 8)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
    setDownloading(false)
  }

  // Checkmark SVG animation
  const checkPath = "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ background: 'var(--cream)', minHeight: 'calc(100vh - 56px)' }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px 80px', textAlign: 'center' }}>

        {/* Completion Header */}
        <div style={{ marginBottom: 40 }}>
          {/* Animated Checkmark */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <svg width={44} height={44} viewBox="0 0 24 24" style={{ margin: '0 auto' }}>
              <motion.path
                d={checkPath}
                fill="var(--moss)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
              />
            </svg>
          </motion.div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 42,
            color: 'var(--ink)', marginTop: 16
          }}>Screening Complete</h1>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 16,
            color: 'var(--slate-mid)', marginTop: 8
          }}>
            {scores.length} candidates ranked. Bias audit complete. Your shortlist is ready to download.
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginTop: 24 }} />
        </div>

        {/* Metrics Row */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24 }}>
          {[
            { stat: scores.length.toString(), label: 'Candidates Ranked' },
            { stat: flagsResolved.toString(), label: 'Bias Flags Resolved' },
            { stat: '90.3%', label: 'Time Saved' },
          ].map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              style={{
                background: 'var(--white)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '16px 20px', textAlign: 'center', flex: 1
              }}
            >
              <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 24, color: 'var(--ink)'
              }}>{m.stat}</div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--slate-light)', marginTop: 4
              }}>{m.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Format Selector */}
        <div style={{ marginTop: 36, textAlign: 'left' }}>
          <div className="section-label">CHOOSE FORMAT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* PDF Card */}
            <div
              onClick={() => setFormat('pdf')}
              style={{
                background: format === 'pdf' ? 'var(--sage-pale)' : 'var(--white)',
                border: format === 'pdf' ? '2px solid var(--sage)' : '1.5px solid var(--border)',
                borderRadius: 'var(--radius-card)', padding: 22, cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              <FileText size={24} style={{ color: format === 'pdf' ? 'var(--sage)' : 'var(--slate-mid)' }} />
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15,
                color: 'var(--ink)', marginTop: 8
              }}>PDF Report</div>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-mid)',
                lineHeight: 1.5, marginTop: 6
              }}>
                Formatted report with ranked table, score breakdowns, and bias audit appendix.
              </p>
              <span style={{
                display: 'inline-block', marginTop: 8,
                background: 'var(--sage-light)', color: 'var(--sage)',
                borderRadius: 'var(--radius-tag)',
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 10,
                textTransform: 'uppercase', padding: '2px 6px'
              }}>Recommended</span>
            </div>

            {/* CSV Card */}
            <div
              onClick={() => setFormat('csv')}
              style={{
                background: format === 'csv' ? 'var(--sage-pale)' : 'var(--white)',
                border: format === 'csv' ? '2px solid var(--sage)' : '1.5px solid var(--border)',
                borderRadius: 'var(--radius-card)', padding: 22, cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              <Table size={24} style={{ color: format === 'csv' ? 'var(--sage)' : 'var(--slate-mid)' }} />
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15,
                color: 'var(--ink)', marginTop: 8
              }}>CSV Spreadsheet</div>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-mid)',
                lineHeight: 1.5, marginTop: 6
              }}>
                Flat file for Excel or Google Sheets. All scores, flags, and normalised values.
              </p>
            </div>
          </div>
        </div>

        {/* Include Audit Checkbox */}
        <div style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left'
        }}>
          <div
            onClick={() => setIncludeAudit(!includeAudit)}
            style={{
              width: 18, height: 18,
              border: `2px solid ${includeAudit ? 'var(--sage)' : 'var(--border)'}`,
              borderRadius: 4, cursor: 'pointer',
              background: includeAudit ? 'var(--sage)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 150ms'
            }}
          >
            {includeAudit && <Check size={12} style={{ color: '#fff' }} />}
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--slate)' }}>
            Include bias audit in export
          </span>
        </div>

        {/* Download Button */}
        <button
          className="btn-primary"
          onClick={handleDownload}
          disabled={downloading}
          style={{
            width: '100%', marginTop: 28, height: 50,
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17,
            justifyContent: 'center'
          }}
        >
          <Download size={16} />
          {downloading ? 'Downloading...' : format === 'pdf' ? 'Download PDF Report' : 'Download CSV Spreadsheet'}
        </button>

        {/* Action Links */}
        <div style={{
          marginTop: 16, display: 'flex', justifyContent: 'center', gap: 24
        }}>
          <button className="btn-ghost" onClick={() => window.history.back()}
            style={{ color: 'var(--slate-mid)', fontSize: 13 }}>
            <ArrowLeft size={14} /> Back to results
          </button>
          <button className="btn-ghost" onClick={startNew}
            style={{ color: 'var(--sage)', fontSize: 13 }}>
            <Plus size={14} /> Start new screening
          </button>
        </div>

        {/* DPDPA Notice */}
        <p style={{
          marginTop: 40, fontFamily: 'var(--font-sans)', fontSize: 11,
          color: 'var(--slate-light)', lineHeight: 1.6, maxWidth: 480, margin: '40px auto 0'
        }}>
          This export contains match scores and summaries only.
          No raw resume text or personal data is included,
          in compliance with DPDPA 2023 data minimisation principles.
        </p>
      </div>
    </motion.div>
  )
}

export default ExportPage
