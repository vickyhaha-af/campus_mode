import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, Files, FileText, X, CheckCircle, Circle, ArrowRight } from 'lucide-react'
import { useSession } from '../App'
import { uploadResumes, uploadJD } from '../utils/api'

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

function UploadPage() {
  const { goToProcessing } = useSession()
  const [jdMode, setJdMode] = useState('paste') // 'paste' | 'upload'
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

  // Validation checks
  const hasJD = jdMode === 'paste' ? jdText.trim().length > 0 : jdFile !== null
  const hasResumes = resumeTexts.length > 0
  const weightsValid = weights.skills + weights.experience + weights.education === 100
  const canSubmit = hasJD && hasResumes && weightsValid && !uploading

  // Weight slider logic — enforce sum = 100
  const handleWeightChange = (dimension, newValue) => {
    const val = Math.max(5, Math.min(90, newValue))
    const others = Object.keys(weights).filter(k => k !== dimension)
    const otherSum = others.reduce((s, k) => s + weights[k], 0)
    const remaining = 100 - val

    if (otherSum === 0) {
      setWeights({ ...weights, [dimension]: val,
        [others[0]]: Math.round(remaining / 2),
        [others[1]]: remaining - Math.round(remaining / 2)
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
      // Final correction
      const total = Object.values(newWeights).reduce((s, v) => s + v, 0)
      if (total !== 100) {
        const lastOther = others[others.length - 1]
        newWeights[lastOther] += (100 - total)
        newWeights[lastOther] = Math.max(5, newWeights[lastOther])
      }
      setWeights(newWeights)
    }
  }

  const resetWeights = () => setWeights({ skills: 50, experience: 30, education: 20 })

  // Resume file handling
  const handleResumeFiles = async (files) => {
    const fileList = Array.from(files).filter(f =>
      f.name.endsWith('.pdf') || f.name.endsWith('.docx')
    ).slice(0, 50 - resumeFiles.length)

    if (fileList.length === 0) {
      setError('Only PDF and DOCX files are supported')
      return
    }

    setResumeFiles(prev => [...prev, ...fileList])
    setError('')
    setUploading(true)

    const formData = new FormData()
    fileList.forEach(f => formData.append('files', f))
    try {
      const res = await uploadResumes(formData)
      setResumeTexts(prev => [...prev, ...res.data.results])
      if (res.data.error_details?.length) {
        setError(`${res.data.error_details.length} file(s) could not be processed`)
      }
    } catch (err) {
      setError('Failed to process resume files')
    }
    setUploading(false)
  }

  const handleResumeDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOverResumes(false)
    handleResumeFiles(e.dataTransfer.files)
  }, [resumeFiles.length])

  const removeResume = (index) => {
    setResumeFiles(prev => prev.filter((_, i) => i !== index))
    setResumeTexts(prev => prev.filter((_, i) => i !== index))
  }

  // JD file handling
  const handleJdFile = async (file) => {
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
      setError('Only PDF and DOCX files are supported')
      return
    }
    setJdFile(file)
    setError('')
    const formData = new FormData()
    formData.append('jd_file', file)
    try {
      const res = await uploadJD(formData)
      setJdText(res.data.text)
    } catch (err) {
      setError('Failed to process JD file')
    }
  }

  const handleJdDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOverJd(false)
    if (e.dataTransfer.files[0]) handleJdFile(e.dataTransfer.files[0])
  }, [])

  // Submit
  const handleSubmit = () => {
    if (!canSubmit) return
    goToProcessing({
      jdText,
      resumeTexts,
      weights: {
        skills: weights.skills / 100,
        experience: weights.experience / 100,
        education: weights.education / 100,
      },
      resumeCount: resumeTexts.length,
    })
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

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

          {/* LEFT COLUMN — JOB DESCRIPTION */}
          <div>
            <div className="section-label">JOB DESCRIPTION</div>

            {/* Mode Toggle */}
            <div className="pill-toggle" style={{ marginBottom: 16 }}>
              <button
                className={`pill-toggle-option ${jdMode === 'paste' ? 'active' : ''}`}
                onClick={() => setJdMode('paste')}
              >Paste Text</button>
              <button
                className={`pill-toggle-option ${jdMode === 'upload' ? 'active' : ''}`}
                onClick={() => setJdMode('upload')}
              >Upload File</button>
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
                }}>
                  {jdText.length.toLocaleString()} chars
                </div>
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <button
                    className="btn-ghost"
                    style={{ color: 'var(--sage)', fontSize: 13 }}
                    onClick={() => setJdText(SAMPLE_JD)}
                  >
                    Load sample JD
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`drop-zone ${isDragOverJd ? 'drag-over' : ''}`}
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
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink)' }}>
                      {jdFile.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--slate-mid)' }}>
                      {formatFileSize(jdFile.size)}
                    </span>
                    <button
                      className="btn-ghost"
                      onClick={(e) => { e.stopPropagation(); setJdFile(null); setJdText('') }}
                      style={{ padding: 4 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud size={32} className="drop-zone-icon" style={{ color: 'var(--slate-light)' }} />
                    <p className="drop-zone-text" style={{
                      fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 15, color: 'var(--slate)'
                    }}>Drop PDF or DOCX here</p>
                    <p style={{
                      fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-light)'
                    }}>or click to browse</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — RESUMES + WEIGHTS */}
          <div>
            {/* Resume Batch */}
            <div className="section-label">RESUME BATCH</div>
            <div
              className={`drop-zone ${isDragOverResumes ? 'drag-over' : ''}`}
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
              <Files size={30} className="drop-zone-icon" style={{ color: 'var(--slate-light)' }} />
              <p className="drop-zone-text" style={{
                fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 15, color: 'var(--slate)'
              }}>Drop up to 50 resumes here</p>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-light)'
              }}>PDF or DOCX  ·  5 MB max per file</p>
            </div>

            {/* File List */}
            {resumeFiles.length > 0 && (
              <>
                <div style={{
                  textAlign: 'right', marginBottom: 6,
                  fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 12, color: 'var(--slate-mid)'
                }}>
                  {resumeFiles.length} file{resumeFiles.length !== 1 ? 's' : ''} added
                </div>
                <div style={{
                  maxHeight: 200, overflowY: 'auto',
                  background: 'var(--white)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-input)'
                }}>
                  {resumeFiles.map((file, i) => (
                    <div key={i} style={{
                      height: 36, padding: '0 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: i % 2 === 0 ? 'var(--white)' : 'var(--cream-mid)',
                      borderBottom: i < resumeFiles.length - 1 ? '1px solid var(--cream-deep)' : 'none',
                    }}>
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
                        <button
                          onClick={(e) => { e.stopPropagation(); removeResume(i) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--slate-light)', padding: 2,
                            transition: 'color 150ms'
                          }}
                          onMouseEnter={(e) => e.target.style.color = 'var(--blush)'}
                          onMouseLeave={(e) => e.target.style.color = 'var(--slate-light)'}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 6-candidate warning */}
            {resumeTexts.length > 0 && resumeTexts.length < 6 && (
              <div style={{
                marginTop: 8, padding: '9px 14px',
                background: '#FFF8E7', border: '1px solid rgba(146,102,10,0.25)',
                borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#92660A', lineHeight: 1.5 }}>
                  Upload at least <strong>6 resumes</strong> to enable the statistical bias audit.
                  Currently {resumeTexts.length} uploaded — need {6 - resumeTexts.length} more.
                </span>
              </div>
            )}


            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="section-label" style={{ marginBottom: 0 }}>SCORING WEIGHTS</div>
                <button className="btn-ghost" onClick={resetWeights}
                  style={{ color: 'var(--sage)', fontSize: 12, padding: '4px 8px' }}
                >Reset to defaults</button>
              </div>
              <p className="text-body-sm" style={{ marginBottom: 16, marginTop: 6 }}>
                Adjust how much each dimension contributes to the composite score.
              </p>

              {[
                { key: 'skills', label: 'Skills' },
                { key: 'experience', label: 'Experience' },
                { key: 'education', label: 'Education' },
              ].map(dim => (
                <div key={dim.key} style={{
                  height: 44, display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 14,
                    color: 'var(--ink)', width: 100
                  }}>{dim.label}</span>
                  <input
                    type="range"
                    min={5} max={90}
                    value={weights[dim.key]}
                    onChange={(e) => handleWeightChange(dim.key, parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 15,
                    color: 'var(--sage)', width: 40, textAlign: 'right'
                  }}>{weights[dim.key]}%</span>
                </div>
              ))}

              <div style={{
                marginTop: 8, textAlign: 'right',
                fontFamily: 'var(--font-sans)', fontSize: 12,
                color: weightsValid ? 'var(--moss)' : 'var(--blush)',
                transition: 'color 200ms'
              }}>
                Total: {weights.skills + weights.experience + weights.education}%
              </div>
            </div>

            {/* Validation Checklist */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { done: hasJD, label: 'Job description added' },
                { done: hasResumes, label: `Resumes uploaded (${resumeTexts.length} of 1 minimum)` },
                { done: weightsValid, label: 'Weights sum to 100%' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.done ? (
                    <CheckCircle size={16} style={{ color: 'var(--moss)' }} />
                  ) : (
                    <Circle size={16} style={{ color: 'var(--slate-light)' }} />
                  )}
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13,
                    color: item.done ? 'var(--slate)' : 'var(--slate-light)'
                  }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Launch Button */}
            <button
              className="btn-primary"
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{
                width: '100%', marginTop: 16, height: 48,
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
                justifyContent: 'center'
              }}
              title={!canSubmit ? 'Complete all steps above to continue' : ''}
            >
              Run Screening <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Demo mode entry */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => goToProcessing(null)}
            style={{ fontSize: 13, color: 'var(--sage)' }}
          >
            Or explore Tech Vista in demo mode
          </button>
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
