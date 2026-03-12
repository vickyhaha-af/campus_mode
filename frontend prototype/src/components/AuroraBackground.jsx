import React from 'react'
import { motion } from 'framer-motion'

/**
 * Aceternity-style Aurora Background
 * Colors mapped to CSS variables: --sage, --moss, --cream-deep
 * Slow, ambient movement (duration: 20s)
 */
export default function AuroraBackground({ children, className = '' }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Aurora layers */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Base gradient */}
        <div 
          className="absolute inset-0"
          style={{ background: 'var(--cream)' }}
        />
        
        {/* Aurora blob 1 - sage */}
        <motion.div
          className="absolute rounded-full blur-3xl opacity-30"
          style={{
            width: '60vw',
            height: '60vw',
            background: 'radial-gradient(circle, rgba(74,124,111,0.4) 0%, transparent 70%)',
            top: '-20%',
            left: '-10%',
          }}
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 50, 100, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Aurora blob 2 - moss */}
        <motion.div
          className="absolute rounded-full blur-3xl opacity-25"
          style={{
            width: '50vw',
            height: '50vw',
            background: 'radial-gradient(circle, rgba(94,122,82,0.35) 0%, transparent 70%)',
            top: '10%',
            right: '-15%',
          }}
          animate={{
            x: [0, -80, -40, 0],
            y: [0, 80, 40, 0],
            scale: [1, 0.9, 1.05, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />
        
        {/* Aurora blob 3 - cream-deep accent */}
        <motion.div
          className="absolute rounded-full blur-3xl opacity-40"
          style={{
            width: '45vw',
            height: '45vw',
            background: 'radial-gradient(circle, rgba(234,230,221,0.6) 0%, transparent 70%)',
            bottom: '-10%',
            left: '20%',
          }}
          animate={{
            x: [0, 60, -30, 0],
            y: [0, -60, -30, 0],
            scale: [1, 1.05, 0.98, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 4,
          }}
        />

        {/* Subtle sage shimmer overlay */}
        <motion.div
          className="absolute inset-0 opacity-10"
          style={{
            background: 'linear-gradient(135deg, rgba(74,124,111,0.1) 0%, transparent 50%, rgba(94,122,82,0.1) 100%)',
          }}
          animate={{
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
