import React from 'react'
import { motion } from 'framer-motion'

export default function DemoTour({ isOpen, onClose }) {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 12,
          padding: '32px',
          maxWidth: 500,
          textAlign: 'center',
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 24,
          color: 'var(--ink)',
          marginBottom: 12,
        }}>
          Welcome to Tech Vista
        </h2>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          color: 'var(--slate-mid)',
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          This is a demo showing how AI-powered resume screening works. Use the keyboard shortcuts (press ?) to navigate and compare candidates.
        </p>
        <button
          onClick={onClose}
          style={{
            background: 'var(--sage)',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '10px 24px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  )
}
