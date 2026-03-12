import React, { useEffect, useRef, useState } from 'react'
import { useSpring, useMotionValue, motion, useTransform } from 'framer-motion'

/**
 * NumberTicker - Animated counting component with weight-based duration
 * Higher numbers take proportionally longer to count up, giving psychological "weight"
 * 
 * @param {number} value - Target number to count to
 * @param {number} decimals - Decimal places to show (default: 0)
 * @param {string} suffix - Suffix to add (e.g., "%")
 * @param {string} prefix - Prefix to add (e.g., "$")
 * @param {number} baseDuration - Base duration in seconds (default: 0.8)
 * @param {number} maxDuration - Maximum duration cap (default: 2.0)
 * @param {boolean} animate - Whether to animate (default: true)
 * @param {string} className - Additional CSS classes
 * @param {object} style - Inline styles
 */
export default function NumberTicker({
  value = 0,
  decimals = 0,
  suffix = '',
  prefix = '',
  baseDuration = 0.8,
  maxDuration = 2.0,
  animate = true,
  className = '',
  style = {},
}) {
  const ref = useRef(null)
  const [hasAnimated, setHasAnimated] = useState(false)
  
  // Calculate duration based on value magnitude (higher = longer)
  // e.g., 95 takes ~1.9s, 40 takes ~1.2s
  const duration = Math.min(maxDuration, baseDuration + (value / 100) * 1.2)
  
  // Motion value for the animated number
  const motionValue = useMotionValue(0)
  
  // Spring configuration with easing that slows near the end
  const springValue = useSpring(motionValue, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })
  
  // Transform to display value
  const displayValue = useTransform(springValue, (latest) => {
    const formatted = latest.toFixed(decimals)
    return `${prefix}${formatted}${suffix}`
  })
  
  // Intersection Observer for viewport triggering
  useEffect(() => {
    if (!animate) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          // Animate after a tiny delay for stagger effect
          const timer = setTimeout(() => {
            motionValue.set(value)
          }, 50)
          return () => clearTimeout(timer)
        }
      },
      { threshold: 0.1 }
    )
    
    if (ref.current) {
      observer.observe(ref.current)
    }
    
    return () => observer.disconnect()
  }, [value, animate, hasAnimated, motionValue])
  
  // Update when value changes (for re-calculations)
  useEffect(() => {
    if (hasAnimated) {
      motionValue.set(value)
    }
  }, [value, hasAnimated, motionValue])
  
  if (!animate) {
    return (
      <span className={className} style={style}>
        {prefix}{value.toFixed(decimals)}{suffix}
      </span>
    )
  }
  
  return (
    <motion.span
      ref={ref}
      className={className}
      style={style}
    >
      {displayValue}
    </motion.span>
  )
}

/**
 * ScoreTicker - Specialized version for percentage scores
 * Includes the psychological weight effect for recruitment scores
 */
export function ScoreTicker({
  value = 0,
  decimals = 0,
  showPercent = true,
  className = '',
  style = {},
}) {
  return (
    <NumberTicker
      value={value}
      decimals={decimals}
      suffix={showPercent ? '%' : ''}
      baseDuration={0.6}
      maxDuration={1.8}
      className={className}
      style={style}
    />
  )
}

/**
 * WeightTicker - For weight percentages in sliders/config
 */
export function WeightTicker({
  value = 0,
  className = '',
  style = {},
}) {
  return (
    <NumberTicker
      value={value}
      decimals={0}
      suffix="%"
      baseDuration={0.3}
      maxDuration={0.8}
      className={className}
      style={style}
    />
  )
}
