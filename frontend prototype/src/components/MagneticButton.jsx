import React from 'react'
import { motion } from 'framer-motion'

/**
 * MagneticButton — Premium interactive button with spring physics.
 *
 * Physics:
 *  - whileHover: scale 1.015  (subtle lift)
 *  - whileTap:   scale 0.96   (satisfying press)
 *  - Spring: stiffness 400, damping 17, mass 0.8 → tight, clicky feel
 *
 * Material:
 *  - .btn-primary receives a multi-layered sage glow on hover via
 *    the `glow` prop (default true for primary buttons).
 */

const springTransition = {
  type: 'spring',
  stiffness: 400,
  damping: 17,
  mass: 0.8,
}

export default function MagneticButton({
  children,
  className = '',
  glow = false,
  disabled = false,
  style = {},
  onClick,
  type = 'button',
  title,
  ...rest
}) {
  // Build combined className — append Tailwind hover:shadow glow if glow=true
  const glowClass = glow && !disabled
    ? 'hover:shadow-[0_0_20px_rgba(74,124,111,0.3),_0_0_40px_rgba(74,124,111,0.1)]'
    : ''

  const combinedClass = [className, glowClass].filter(Boolean).join(' ')

  return (
    <motion.button
      type={type}
      className={combinedClass}
      style={style}
      disabled={disabled}
      onClick={onClick}
      title={title}
      whileHover={disabled ? undefined : { scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={springTransition}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
