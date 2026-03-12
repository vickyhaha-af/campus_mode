import React, { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/**
 * Glassmorphism card with mouse-following radial spotlight
 */
export default function SpotlightCard({ children, className = '', style = {} }) {
  const cardRef = useRef(null)
  
  // Motion values for mouse position
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  // Smooth spring animation for spotlight
  const spotlightX = useSpring(mouseX, { stiffness: 300, damping: 30 })
  const spotlightY = useSpring(mouseY, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }

  const handleMouseLeave = () => {
    // Reset to center when mouse leaves
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    mouseX.set(rect.width / 2)
    mouseY.set(rect.height / 2)
  }

  return (
    <motion.div
      ref={cardRef}
      className={`relative overflow-hidden bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl ${className}`}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
    >
      {/* Spotlight gradient overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(350px circle at ${spotlightX}px ${spotlightY}px, rgba(74,124,111,0.12), transparent 60%)`,
          opacity: 1,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  )
}
