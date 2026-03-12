import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { X } from 'lucide-react'
import { useModalContext } from './ModalContext'

export default function CandidateComparison({ candidates, onClose }) {
  const { setModalOpen } = useModalContext()
  
  useEffect(() => {
    setModalOpen(true)
    return () => setModalOpen(false)
  }, [setModalOpen])
  const [hoveredVertex, setHoveredVertex] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)

  if (!candidates || candidates.length === 0) return null

  const radius = 100
  const center = 150
  const categories = ['Skills', 'Experience', 'Education']
  const angle = (Math.PI * 2) / categories.length

  // Normalize scores to 0-100
  const normalizeScore = (val) => Math.min(100, Math.max(0, val || 0))

  // Generate polygon points for a candidate
  const generatePolygon = (candidate) => {
    const scores = [
      normalizeScore(candidate.skills_score),
      normalizeScore(candidate.experience_score),
      normalizeScore(candidate.education_score),
    ]
    return scores.map((score, i) => {
      const x = center + (radius * score / 100) * Math.cos(i * angle - Math.PI / 2)
      const y = center + (radius * score / 100) * Math.sin(i * angle - Math.PI / 2)
      return [x, y]
    })
  }

  const handleVertexHover = (e, candidateIdx, vertexIdx) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
    setHoveredVertex(`${candidateIdx}-${vertexIdx}`)
  }

  const colors = ['rgba(74, 124, 111, 0.6)', 'rgba(102, 148, 130, 0.6)', 'rgba(150, 180, 165, 0.6)']

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Spatial takeover backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(20px)',
          zIndex: -1,
        }}
      />

      {/* Modal Content */}
      <motion.div
        style={{
          marginLeft: 'auto',
          marginRight: 'auto',
          marginTop: 'auto',
          marginBottom: 'auto',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          width: '90%',
          maxWidth: 800,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--ink)',
            }}
          >
            Candidate Comparison
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

        {/* Radar Chart */}
        <div
          ref={containerRef}
          style={{
            padding: '32px',
            display: 'flex',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <svg width={300} height={300} viewBox="0 0 300 300">
            {/* Grid circles */}
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.circle
                key={`grid-${i}`}
                cx={center}
                cy={center}
                r={(radius / 5) * i}
                fill="none"
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="2,2"
                initial={{ strokeDashoffset: 12 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
              />
            ))}

            {/* Axis lines */}
            {categories.map((cat, i) => {
              const x = center + radius * Math.cos(i * angle - Math.PI / 2)
              const y = center + radius * Math.sin(i * angle - Math.PI / 2)
              return (
                <motion.line
                  key={`axis-${i}`}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                />
              )
            })}

            {/* Category labels */}
            {categories.map((cat, i) => {
              const x = center + (radius + 25) * Math.cos(i * angle - Math.PI / 2)
              const y = center + (radius + 25) * Math.sin(i * angle - Math.PI / 2)
              return (
                <text
                  key={`label-${i}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    fontWeight: 600,
                    fill: 'var(--ink)',
                  }}
                >
                  {cat}
                </text>
              )
            })}

            {/* Candidate polygons */}
            {candidates.map((candidate, candIdx) => {
              const points = generatePolygon(candidate)
              const pointsStr = points.map((p) => p.join(',')).join(' ')
              return (
                <g key={`candidate-${candIdx}`}>
                  {/* Filled polygon */}
                  <motion.polygon
                    points={pointsStr}
                    fill={colors[candIdx % colors.length]}
                    stroke={colors[candIdx % colors.length]}
                    strokeWidth="2"
                    style={{ mixBlendMode: 'screen' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 100,
                      damping: 15,
                      delay: candIdx * 0.2,
                    }}
                  />

                  {/* Vertex circles and hit areas */}
                  {points.map((point, vertexIdx) => (
                    <g key={`vertex-${candIdx}-${vertexIdx}`}>
                      {/* Invisible hit area */}
                      <circle
                        cx={point[0]}
                        cy={point[1]}
                        r={12}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseMove={(e) =>
                          handleVertexHover(e, candIdx, vertexIdx)
                        }
                        onMouseLeave={() => setHoveredVertex(null)}
                      />

                      {/* Animated pulse circle */}
                      <motion.circle
                        cx={point[0]}
                        cy={point[1]}
                        r={4}
                        fill={colors[candIdx % colors.length]}
                        initial={{ scale: 1, opacity: 0.7 }}
                        animate={
                          hoveredVertex === `${candIdx}-${vertexIdx}`
                            ? {
                                scale: [1, 1.5, 1],
                                opacity: [1, 0.5, 1],
                              }
                            : { scale: 1, opacity: 0.7 }
                        }
                        transition={{
                          duration: 0.6,
                          repeat:
                            hoveredVertex === `${candIdx}-${vertexIdx}`
                              ? Infinity
                              : 0,
                        }}
                      />
                    </g>
                  ))}
                </g>
              )
            })}
          </svg>

          {/* Tooltip */}
          <AnimatePresence>
            {hoveredVertex && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  position: 'absolute',
                  left: tooltipPos.x,
                  top: tooltipPos.y,
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  transform: 'translate(-50%, -120%)',
                }}
              >
                {candidates[parseInt(hoveredVertex.split('-')[0])].candidate_name}
                <br />
                Score: {hoveredVertex.split('-')[1] === '0' ? 'Skills' : hoveredVertex.split('-')[1] === '1' ? 'Experience' : 'Education'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 24,
          }}
        >
          {candidates.map((candidate, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: colors[i % colors.length],
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: 'var(--ink)',
                }}
              >
                {candidate.candidate_name}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
