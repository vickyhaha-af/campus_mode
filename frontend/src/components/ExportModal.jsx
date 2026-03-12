import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, FileSpreadsheet, Download, X, Loader2 } from 'lucide-react'
import { exportPDF, exportCSV } from '../utils/api'

function ExportModal({ sessionId, onClose }) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState(null)

  const handleExport = async (type) => {
    setIsExporting(true)
    setError(null)
    try {
      let res
      if (type === 'pdf') {
        res = await exportPDF(sessionId)
      } else {
        res = await exportCSV(sessionId)
      }

      // Create download link for blob
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `techvista_${type}_report_${sessionId.substring(0,8)}.${type}`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setTimeout(onClose, 500)
    } catch (err) {
      console.error(err)
      setError('Export failed. Please try again.')
      setIsExporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div 
        className="modal" 
        style={{ maxWidth: '500px' }} 
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header">
          <h2 style={{ fontSize: '1.25rem' }}>Export Results</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={isExporting}><X size={20} /></button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Choose an export format. All exports are DPDPA compliant and exclude raw resume content.
          </p>

          <button 
            className="btn btn-secondary" 
            style={{ display: 'flex', justifyContent: 'flex-start', padding: '16px', height: 'auto', border: '1px solid var(--border-default)' }}
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
              <FileText size={24} />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Executive PDF Report</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Branded report with top candidates, score explainers, and bias audit summary.</div>
            </div>
            <Download size={20} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ display: 'flex', justifyContent: 'flex-start', padding: '16px', height: 'auto', border: '1px solid var(--border-default)' }}
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}>
              <FileSpreadsheet size={24} />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Full CSV Export</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Raw tabular data of all candidates, scores, and variables for HRIS import.</div>
            </div>
            <Download size={20} style={{ color: 'var(--text-muted)' }} />
          </button>

          {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center', marginTop: '8px' }}>{error}</div>}
          {isExporting && !error && (
            <div style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Generating file...
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default ExportModal
