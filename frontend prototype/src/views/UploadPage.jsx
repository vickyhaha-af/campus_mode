import React, { useState, useRef, useCallback, useId } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { UploadCloud, Files, FileText, X, CheckCircle, Circle, ArrowRight } from 'lucide-react'
import { useSession } from '../App'
import { uploadResumes, uploadJD } from '../utils/api'
import MagneticButton from '../components/MagneticButton'

const SAMPLE_JD = `Backend Engineer (Python) — 3+ years experience required.

Must have: Python, Django or FastAPI, PostgreSQL, REST API design, Git.
Preferred: Redis, Celery, Docker, AWS or GCP.
Experience with high-throughput systems a plus.

Role involves designing and maintaining core API infrastructure for a fintech startup processing 50K+ daily transactions. You'll work closely with the payments and data teams to build reliable, scalable services.

Responsibilities:
- Design and implement RESTful APIs using Django/FastAPI
- Optimize database queries and manage PostgreSQL schemas
- Build and maintain CI/CD pipelines
- Write comprehensive unit and integration tests
- Participate in code reviews and architectural decisions

Education: B.Tech/B.E. in Computer Science or equivalent experience preferred.`

/* ─── Marching-Ants Drop Zone ──────────────────────────────────────────────── */
function MarchingDropZone({ isDragOver, children, style = {}, onClick, onDragOver, onDragLeave, onDrop }) {
  const dashLength = 8
  const gapLength = 6
  const totalDash = dashLength + gapLength
  // When dragging, animation runs 3x faster
  const duration = isDragOver ? 0.5 : 1.5

  return (
    <motion.div
      animate={isDragOver ? { scale: 0.98, backgroundColor: 'var(--sage-pale)' } : { scale: 1, backgroundColor: 'var(--white)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        position: 'relative',
        borderRadius: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* SVG marching-ants border */}
      <svg
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.rect
          x="1" y="1"
          width="calc(100% - 2px)" height="calc(100% - 2px)"
          rx="9" ry="9"
          fill="none"
          stroke="var(--sage)"
          strokeOpacity={isDragOver ? 1 : 0.45}
          strokeWidth={isDragOver ? 2 : 1.5}
          strokeDasharray={`${dashLength} ${gapLength}`}
          animate={{
            strokeDashoffset: [0, -totalDash],
            strokeOpacity: isDragOver ? 1 : 0.45,
          }}
          transition={{
            strokeDashoffset: {
              repeat: Infinity,
              duration,
              ease: 'linear',
            },
            strokeOpacity: { duration: 0.25 },
          }}
          style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
        />
      </svg>

      {/* inner content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%',
      }}>
        {children}
      </div>
    </motion.div>
  )
}

/* ─── Custom Framer Motion Slider ───────────────────────────────────────────── */
function MotionSlider({ value, onChange, min = 5, max = 90, accent = 'var(--sage)' }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const pct = ((value - min) / (max - min)) * 100

  const computeValue = (clientX) => {
    if (!trackRef.current) return value
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * (max - min) + min)
  }

  const handleTrackClick = (e) => {
    onChange(computeValue(e.clientX))
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    setDragging(true)
    const move = (ev) => onChange(computeValue(ev.clientX))
    const up = () => { setDragging(false); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const handleTouchStart = (e) => {
    setDragging(true)
    const move = (ev) => onChange(computeValue(ev.touches[0].clientX))
    const end = () => { setDragging(false); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end) }
    window.addEventListener('touchmove', move)
    window.addEventListener('touchend', end)
  }

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      style={{
        flex: 1,
        position: 'relative',
        height: 20,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Track background */}
      <div style={{
        position: 'absolute', left: 0, right: 0,
        height: 4,
        background: 'var(--cream-deep)',
        borderRadius: 2,
      }} />

      {/* Active track — glows with --sage */}
      <motion.div
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{
          position: 'absolute',
          left: 0,
          height: 4,
          background: accent,
          borderRadius: 2,
          boxShadow: `0 0 6px ${accent}, 0 0 12px ${accent}55`,
        }}
      />

      {/* Thumb */}
      <motion.div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        animate={{ left: `${pct}%` }}
        whileHover={{ scale: 1.25 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        style={{
          position: 'absolute',
          transform: 'translateX(-50%)',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--white)',
          border: `2px solid ${accent}`,
          cursor: dragging ? 'grabbing' : 'grab',
          boxShadow: dragging
            ? `var(--shadow-elevated), 0 0 0 4px ${accent}33`
            : 'var(--shadow-elevated)',
          zIndex: 2,
          transition: 'box-shadow 150ms',
        }}
      />
    </div>
  )
}

/* ─── File Row (animated) ───────────────────────────────────────────────────── */
function FileRow({ file, index, onRemove }) {
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 36 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      style={{
        padding: '0 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: index % 2 === 0 ? 'var(--white)' : 'var(--cream-mid)',
        borderBottom: '1px solid var(--cream-deep)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
        <FileText size={12} style={{ color: 'var(--slate-light)', flexShrink: 0 }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--slate)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200
        }}>{file.name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate-light)' }}>
          {formatFileSize(file.size)}
        </span>
        <motion.button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          whileHover={{ color: 'var(--blush)', scale: 1.2 }}
          whileTap={{ scale: 0.85 }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--slate-light)', padding: 2, display: 'flex',
          }}
        >
          <X size={14} />
        </motion.button>
      </div>
    </motion.div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
function UploadPage() {
  const { goToProcessing } = useSession()
  const [jdMode, setJdMode] = useState('paste')
  const [jdText, setJdText] = useState('')
  const [jdFile, setJdFile] = useState(null)
  const [resumeFiles, setResumeFiles] = useState([])
  const [resumeTexts, setResumeTexts] = useState([])
  const [weights, setWeights] = useState({ skills: 50, experience: 30, education: 20 })
  const [isDragOverJd, setIsDragOverJd] = useState(false)
  const [isDragOverResumes, setIsDragOverResumes] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const resumeInputRef = useRef(null)
  const jdInputRef = useRef(null)

  const hasJD = jdMode === 'paste' ? jdText.trim().length > 0 : jdFile !== null
  const hasResumes = resumeTexts.length > 0
  const weightsValid = weights.skills + weights.experience + weights.education === 100
  const canSubmit = hasJD && hasResumes && weightsValid && !uploading

  /* Weight slider logic — enforce sum = 100 */
  const handleWeightChange = (dimension, newValue) => {
    const val = Math.max(5, Math.min(90, newValue))
    const others = Object.keys(weights).filter(k => k !== dimension)
    const otherSum = others.reduce((s, k) => s + weights[k], 0)
    const remaining = 100 - val
    if (otherSum === 0) {
      setWeights({
        ...weights, [dimension]: val,
        [others[0]]: Math.round(remaining / 2),
        [others[1]]: remaining - Math.round(remaining / 2),
      })
    } else {
      const newWeights = { ...weights, [dimension]: val }
      let distributed = 0
      others.forEach((k, i) => {
        if (i === others.length - 1) {
          newWeights[k] = Math.max(5, remaining - distributed)
        } else {
          const share = Math.max(5, Math.round((weights[k] / otherSum) * remaining))
          newWeights[k] = share
          distributed += share
        }
      })
      const total = Object.values(newWeights).reduce((s, v) => s + v, 0)
      if (total !== 100) {
        const lastOther = others[others.length - 1]
        newWeights[lastOther] = Math.max(5, newWeights[lastOther] + (100 - total))
      }
      setWeights(newWeights)
    }
  }

  const resetWeights = () => setWeights({ skills: 50, experience: 30, education: 20 })

  /* Resume file handling */
  const handleResumeFiles = async (files) => {
    const fileList = Array.from(files)
      .filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.docx'))
      .slice(0, 50 - resumeFiles.length)
    if (fileList.length === 0) { setError('Only PDF and DOCX files are supported'); return }
    setResumeFiles(prev => [...prev, ...fileList])
    setError('')
    setUploading(true)
    const formData = new FormData()
    fileList.forEach(f => formData.append('files', f))
    try {
      const res = await uploadResumes(formData)
      setResumeTexts(prev => [...prev, ...res.data.results])
      if (res.data.error_details?.length) setError(`${res.data.error_details.length} file(s) could not be processed`)
    } catch { setError('Failed to process resume files') }
    setUploading(false)
  }

  const handleResumeDrop = useCallback((e) => {
    e.preventDefault(); setIsDragOverResumes(false); handleResumeFiles(e.dataTransfer.files)
  }, [resumeFiles.length])

  const removeResume = (index) => {
    setResumeFiles(prev => prev.filter((_, i) => i !== index))
    setResumeTexts(prev => prev.filter((_, i) => i !== index))
  }

  /* JD file handling */
  const handleJdFile = async (file) => {
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) { setError('Only PDF and DOCX files are supported'); return }
    setJdFile(file); setError('')
    const formData = new FormData()
    formData.append('jd_file', file)
    try { const res = await uploadJD(formData); setJdText(res.data.text) }
    catch { setError('Failed to process JD file') }
  }

  const handleJdDrop = useCallback((e) => {
    e.preventDefault(); setIsDragOverJd(false)
    if (e.dataTransfer.files[0]) handleJdFile(e.dataTransfer.files[0])
  }, [])

  /* Submit */
  const handleSubmit = () => {
    if (!canSubmit) return
    goToProcessing({
      jdText, resumeTexts,
      weights: { skills: weights.skills / 100, experience: weights.experience / 100, education: weights.education / 100 },
      resumeCount: resumeTexts.length,
    })
  }

  const WEIGHT_DIMS = [
    { key: 'skills',     label: 'Skills',     accent: 'var(--accent-skills)' },
    { key: 'experience', label: 'Experience', accent: 'var(--accent-experience)' },
    { key: 'education',  label: 'Education',  accent: 'var(--accent-education)' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ background: 'var(--cream)', minHeight: 'calc(100vh - 56px)' }}
    >
      <div className="page-container" style={{ paddingTop: 40, paddingBottom: 64 }}>

        {/* Page Header */}
        <div style={{ marginBottom: 20 }}>
          <div className="section-label">NEW SCREENING</div>
          <h1 className="text-h1" style={{ marginBottom: 8 }}>Upload &amp; Configure</h1>
          <p className="text-body" style={{ color: 'var(--slate-mid)', maxWidth: 480 }}>
            Add a job description and resume batch to begin. Tech Vista will rank
            candidates semantically and audit results for statistical bias.
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginTop: 20 }} />
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '56fr 44fr', gap: 32, marginTop: 32 }}>

          {/* ── LEFT — JOB DESCRIPTION ── */}
          <div>
            <div className="section-label">JOB DESCRIPTION</div>

            <div className="pill-toggle" style={{ marginBottom: 16 }}>
              <button className={`pill-toggle-option ${jdMode === 'paste' ? 'active' : ''}`} onClick={() => setJdMode('paste')}>Paste Text</button>
              <button className={`pill-toggle-option ${jdMode === 'upload' ? 'active' : ''}`} onClick={() => setJdMode('upload')}>Upload File</button>
            </div>

            {jdMode === 'paste' ? (
              <div style={{ position: 'relative' }}>
                <textarea
                  className="input-field"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the full job description here — role overview, required skills, experience level, responsibilities..."
                  style={{ minHeight: 340, fontFamily: 'var(--font-sans)', fontSize: 14 }}
                />
                <div style={{
                  position: 'absolute', bottom: 12, right: 14,
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate-light)'
                }}>{jdText.length.toLocaleString()} chars</div>
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <MagneticButton className="btn-ghost" style={{ color: 'var(--sage)', fontSize: 13 }} onClick={() => setJdText(SAMPLE_JD)}>
                    Load sample JD
                  </MagneticButton>
                </div>
              </div>
            ) : (
              <MarchingDropZone
                isDragOver={isDragOverJd}
                style={{ height: 220, padding: 32 }}
                onDragOver={(e) => { e.preventDefault(); setIsDragOverJd(true) }}
                onDragLeave={() => setIsDragOverJd(false)}
                onDrop={handleJdDrop}
                onClick={() => jdInputRef.current?.click()}
              >
                <input
                  ref={jdInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files[0] && handleJdFile(e.target.files[0])}
                />
                {jdFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FileText size={20} style={{ color: 'var(--sage)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)' }}>{jdFile.name}</span>
                    <MagneticButton
                      className="btn-ghost"
                      onClick={(e) => { e.stopPropagation(); setJdFile(null); setJdText('') }}
                      style={{ padding: 4 }}
                    ><X size={14} /></MagneticButton>
                  </div>
                ) : (
                  <>
                    <motion.div animate={isDragOverJd ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                      <UploadCloud size={32} style={{ color: isDragOverJd ? 'var(--sage)' : 'var(--slate-light)' }} />
                    </motion.div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 15, color: isDragOverJd ? 'var(--sage)' : 'var(--slate)', marginTop: 10, transition: 'color 200ms' }}>
                      Drop PDF or DOCX here
                    </p>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-light)', marginTop: 4 }}>or click to browse</p>
                  </>
                )}
              </MarchingDropZone>
            )}
          </div>

          {/* ── RIGHT — RESUMES + WEIGHTS ── */}
          <div>
            <div className="section-label">RESUME BATCH</div>

            <MarchingDropZone
              isDragOver={isDragOverResumes}
              style={{ height: 180, padding: 32, marginBottom: 12 }}
              onDragOver={(e) => { e.preventDefault(); setIsDragOverResumes(true) }}
              onDragLeave={() => setIsDragOverResumes(false)}
              onDrop={handleResumeDrop}
              onClick={() => resumeInputRef.current?.click()}
            >
              <input
                ref={resumeInputRef}
                type="file"
                multiple
                accept=".pdf,.docx"
                style={{ display: 'none' }}
                onChange={(e) => handleResumeFiles(e.target.files)}
              />
              <motion.div animate={isDragOverResumes ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <Files size={30} style={{ color: isDragOverResumes ? 'var(--sage)' : 'var(--slate-light)' }} />
              </motion.div>
              <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 15, color: isDragOverResumes ? 'var(--sage)' : 'var(--slate)', marginTop: 10, transition: 'color 200ms' }}>
                Drop up to 50 resumes here
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-light)', marginTop: 4 }}>PDF or DOCX · 5 MB max per file</p>
            </MarchingDropZone>

            {/* ── Animated File List ── */}
            <AnimatePresence>
              {resumeFiles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div style={{
                    textAlign: 'right', marginBottom: 6,
                    fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 12, color: 'var(--slate-mid)'
                  }}>
                    {resumeFiles.length} file{resumeFiles.length !== 1 ? 's' : ''} added
                  </div>
                  <div style={{
                    maxHeight: 200, overflowY: 'auto',
                    background: 'var(--white)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-input)',
                    overflow: 'hidden',
                  }}>
                    <AnimatePresence initial={false}>
                      {resumeFiles.map((file, i) => (
                        <FileRow
                          key={`${file.name}-${file.size}-${i}`}
                          file={file}
                          index={i}
                          onRemove={() => removeResume(i)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 6-candidate warning */}
            <AnimatePresence>
              {resumeTexts.length > 0 && resumeTexts.length < 6 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{
                    marginTop: 8, padding: '9px 14px',
                    background: '#FFF8E7', border: '1px solid rgba(146,102,10,0.25)',
                    borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#92660A', lineHeight: 1.5 }}>
                    Upload at least <strong>6 resumes</strong> to enable the statistical bias audit.
                    Currently {resumeTexts.length} uploaded — need {6 - resumeTexts.length} more.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Scoring Weights ── */}
            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="section-label" style={{ marginBottom: 0 }}>SCORING WEIGHTS</div>
                <MagneticButton
                  className="btn-ghost"
                  onClick={resetWeights}
                  style={{ color: 'var(--sage)', fontSize: 12, padding: '4px 8px' }}
                >
                  Reset to defaults
                </MagneticButton>
              </div>
              <p className="text-body-sm" style={{ marginBottom: 20, marginTop: 6 }}>
                Adjust how much each dimension contributes to the composite score.
              </p>

              {WEIGHT_DIMS.map(dim => (
                <div key={dim.key} style={{
                  marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14
                }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 14,
                    color: 'var(--ink)', width: 90, flexShrink: 0
                  }}>{dim.label}</span>
                  <MotionSlider
                    value={weights[dim.key]}
                    onChange={(v) => handleWeightChange(dim.key, v)}
                    min={5}
                    max={90}
                    accent={dim.accent}
                  />
                  <motion.span
                    key={weights[dim.key]}
                    initial={{ scale: 1.25, color: dim.accent }}
                    animate={{ scale: 1, color: dim.accent }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 15,
                      width: 40, textAlign: 'right', flexShrink: 0,
                    }}
                  >{weights[dim.key]}%</motion.span>
                </div>
              ))}

              <div style={{
                textAlign: 'right',
                fontFamily: 'var(--font-sans)', fontSize: 12,
                color: weightsValid ? 'var(--moss)' : 'var(--blush)',
                transition: 'color 200ms',
              }}>
                Total: {weights.skills + weights.experience + weights.education}%
              </div>
            </div>

            {/* Validation Checklist */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { done: hasJD,        label: 'Job description added' },
                { done: hasResumes,   label: `Resumes uploaded (${resumeTexts.length} of 1 minimum)` },
                { done: weightsValid, label: 'Weights sum to 100%' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: item.done ? 1 : 0.55 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {item.done ? (
                      <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                        <CheckCircle size={16} style={{ color: 'var(--moss)' }} />
                      </motion.span>
                    ) : (
                      <motion.span key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Circle size={16} style={{ color: 'var(--slate-light)' }} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13,
                    color: item.done ? 'var(--slate)' : 'var(--slate-light)',
                    transition: 'color 200ms',
                  }}>{item.label}</span>
                </motion.div>
              ))}
            </div>

            {/* Launch Button */}
            <MagneticButton
              className="btn-primary"
              glow
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{
                width: '100%', marginTop: 16, height: 48,
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
                justifyContent: 'center',
              }}
              title={!canSubmit ? 'Complete all steps above to continue' : ''}
            >
              Run Screening <ArrowRight size={18} />
            </MagneticButton>
          </div>
        </div>

        {/* Demo mode entry */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <MagneticButton
            className="btn-ghost"
            type="button"
            onClick={() => goToProcessing(null)}
            style={{ fontSize: 13, color: 'var(--sage)' }}
          >
            Or explore Tech Vista in demo mode
          </MagneticButton>
        </div>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, x: 320 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 320 }}
              className="toast"
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
            >
              <span style={{ color: 'var(--blush)', fontWeight: 600, fontSize: 14 }}>⚠</span>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Upload Issue</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate)', marginTop: 2 }}>{error}</div>
              </div>
              <button
                onClick={() => setError('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-light)', marginLeft: 'auto' }}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default UploadPage
