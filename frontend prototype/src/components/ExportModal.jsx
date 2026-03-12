import React from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function ExportModal({ isOpen, onClose, onExport }) {
  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 24,
            color: 'var(--ink)',
          }}>
            Export Results
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--slate-light)',
            }}
          >
            <X size={20} />
          </button>
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          color: 'var(--slate-mid)',
          marginBottom: 24,
        }}>
          Download your screening results as PDF or CSV.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ height: 40, fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={onExport}
            style={{ height: 40, fontSize: 13 }}
          >
            Export
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
