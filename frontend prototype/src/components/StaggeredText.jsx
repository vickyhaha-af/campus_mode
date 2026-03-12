import React from 'react'
import { motion } from 'framer-motion'

/**
 * Typography that staggers word-by-word from bottom
 * Each word fades in from y:20, opacity:0 with 0.04s stagger delay
 */
export default function StaggeredText({ 
  children, 
  as: Component = 'span',
  className = '',
  style = {},
  staggerDelay = 0.04,
  initialDelay = 0 
}) {
  // Split text into words
  const text = typeof children === 'string' ? children : ''
  const words = text.split(' ')

  const container = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  }

  const child = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 100,
      },
    },
  }

  return (
    <motion.span
      className={className}
      style={{ display: 'inline-block', ...style }}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          variants={child}
          style={{ 
            display: 'inline-block', 
            marginRight: '0.25em',
            whiteSpace: 'pre',
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  )
}
