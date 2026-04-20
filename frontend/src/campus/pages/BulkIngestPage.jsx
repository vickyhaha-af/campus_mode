import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UploadCloud, FileText, X, CheckCircle, AlertTriangle, Play, Info,
  Sparkles, FileCheck,
} from 'lucide-react'
import { startIngest, pollIngest } from '../api'
import CampusNav from '../components/CampusNav'

const POLL_MS = 2500

export default function BulkIngestPage() {
  const collegeId = typeof window !== 'undefined' ? localStorage.getItem('campus_college_id') : null
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('campus_demo_mode') === '1'
  const [files, setFiles] = useState([])
  const [job, setJob] = useState(null)
  const [err, setErr] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const onFiles = (list) => {
    const arr = Array.from(list).filter((f) => /\.(pdf|docx)$/i.test(f.name))
    setFiles((cur) => [...cur, ...arr].slice(0, 150))
  }

  const handleStart = async () => {
    setErr('')
    if (!collegeId) { setErr('No college configured. Go to /campus/setup first.'); return }
    if (!files.length) { setErr('Pick resume files first'); return }
    try {
      const { data } = await startIngest(collegeId, files)
      setJob({ id: data.job_id, total: data.total, processed: 0, succeeded: 0, failed: 0, status: 'queued', errors: [] })
      pollRef.current = setInterval(async () => {
        try {
          const { data: j } = await pollIngest(data.job_id)
          setJob(j)
          if (j.status === 'completed' || j.status === 'failed') clearInterval(pollRef.current)
        } catch (e) { /* keep polling */ }
      }, POLL_MS)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Ingest failed to start')
    }
  }

  const pct = job ? Math.round((job.processed / Math.max(job.total, 1)) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '40px 24px 80px' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 28 }}
        >
          <div className="text-eyebrow" style={{ marginBottom: 10 }}>Ingest</div>
          <h1 className="text-display" style={{ marginBottom: 8 }}>
            Drop a class. <span className="text-display-italic">We'll handle the rest.</span>
          </h1>
          <p className="text-body" style={{ fontSize: 14.5, maxWidth: 640 }}>
            Up to 150 PDFs or DOCX at a time. Each resume is parsed, enriched with nuance (passions, personality,
            role-fit), and embedded for matching. Target: under 5 minutes per 100 resumes.
          </p>
        </motion.div>

        {isDemo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              background: 'var(--gradient-sage-card)',
              border: '1px solid rgba(74,124,111,0.2)',
              borderRadius: 12, padding: 16, marginBottom: 20,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}
          >
            <Info size={16} color="var(--sage-dim)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 14, color: 'var(--sage-dim)', lineHeight: 1.55 }}>
              <strong>Demo mode — ingest is disabled.</strong>{' '}
              20 students are already pre-loaded so you can explore the matching pipeline.
              To ingest real resumes,{' '}
              <Link to="/campus/setup" style={{ color: 'var(--sage-dim)', fontWeight: 600, borderBottom: '1.5px solid var(--sage)' }}>
                create a college
              </Link> (2 min).
            </div>
          </motion.div>
        )}

        {err && <ErrorBox>{err}</ErrorBox>}

        {!job ? (
          <>
            {/* Drop zone */}
            <motion.div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files) }}
              onClick={() => inputRef.current?.click()}
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              whileHover={{ y: -2 }}
              style={{
                padding: '60px 24px',
                minHeight: 220,
                position: 'relative',
              }}
            >
              <motion.div
                animate={dragOver
                  ? { scale: [1, 1.12, 1], rotate: [0, -8, 0] }
                  : { y: [0, -6, 0] }}
                transition={dragOver
                  ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'relative', zIndex: 1,
                  width: 74, height: 74, borderRadius: 20,
                  background: dragOver ? 'var(--sage)' : 'var(--white)',
                  border: `2px solid ${dragOver ? 'var(--sage)' : 'rgba(74,124,111,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18,
                  boxShadow: dragOver ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                  transition: 'background 250ms, border-color 250ms, box-shadow 300ms',
                }}
              >
                <UploadCloud size={32} color={dragOver ? '#fff' : 'var(--sage)'} strokeWidth={2} />
              </motion.div>
              <div style={{
                position: 'relative', zIndex: 1,
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
                color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.015em',
              }}>
                {dragOver ? 'Drop it like it\'s hot' : 'Drop resumes here'}
              </div>
              <div style={{ position: 'relative', zIndex: 1, fontSize: 14, color: 'var(--slate-mid)', marginBottom: 12 }}>
                or <span style={{ color: 'var(--sage-dim)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>click to browse</span>
              </div>
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span className="chip">PDF</span>
                <span className="chip">DOCX</span>
                <span className="chip neutral">up to 150 files</span>
              </div>
              <input ref={inputRef} type="file" multiple accept=".pdf,.docx" style={{ display: 'none' }}
                onChange={(e) => onFiles(e.target.files)} />
            </motion.div>

            {/* File list */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  style={{
                    marginTop: 20,
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    borderRadius: 14, padding: 18,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileCheck size={16} color="var(--sage)" />
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
                        {files.length} file{files.length === 1 ? '' : 's'} queued
                      </span>
                    </div>
                    <button onClick={() => setFiles([])} className="btn-ghost" style={{ fontSize: 12 }}>
                      Clear all
                    </button>
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 4 }}>
                    {files.map((f, i) => (
                      <motion.div
                        key={`${f.name}-${i}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.3) }}
                        style={{
                          display: 'flex', gap: 10, alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 8,
                          transition: 'background 150ms',
                        }}
                        whileHover={{ background: 'var(--cream-mid)' }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: 'var(--sage-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <FileText size={13} color="var(--sage)" />
                        </div>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--slate)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--slate-mid)', fontFamily: 'var(--font-mono)' }}>
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          style={{
                            background: 'none', border: 'none', color: 'var(--slate-mid)',
                            cursor: 'pointer', padding: 4, borderRadius: 4,
                            display: 'flex', alignItems: 'center',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--blush)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--slate-mid)'}
                        >
                          <X size={13} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={!isDemo && files.length ? { y: -1 } : {}}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              disabled={!files.length || isDemo}
              title={isDemo ? 'Disabled in demo mode' : undefined}
              className="btn-primary btn-lg"
              style={{ marginTop: 22 }}
            >
              <Play size={16} />
              {isDemo ? 'Ingest disabled in demo' : 'Start ingest'}
              {!isDemo && files.length > 0 && <Sparkles size={14} />}
            </motion.button>
          </>
        ) : (
          <IngestProgress job={job} pct={pct} onNew={() => {
            setJob(null); setFiles([])
            if (pollRef.current) clearInterval(pollRef.current)
          }} />
        )}
      </div>
    </div>
  )
}

/* ----- Ring progress ----- */
function RingProgress({ pct, done, failed }) {
  const r = 46
  const c = 2 * Math.PI * r
  const offset = c - (c * pct) / 100

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--cream-deep)" strokeWidth="8" />
      <motion.circle
        cx="60" cy="60" r={r} fill="none"
        stroke={done && failed ? 'var(--blush)' : done ? 'var(--moss)' : 'var(--sage)'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
      />
      <text
        x="60" y="60"
        textAnchor="middle" dominantBaseline="central"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26, fontWeight: 700,
          fill: 'var(--ink)',
        }}
      >
        {pct}%
      </text>
      <text
        x="60" y="82"
        textAnchor="middle"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10, fontWeight: 600,
          fill: 'var(--slate-mid)',
          letterSpacing: 0.5, textTransform: 'uppercase',
        }}
      >
        Processed
      </text>
    </svg>
  )
}

function IngestProgress({ job, pct, onNew }) {
  const done = job.status === 'completed' || job.status === 'failed'
  const hasFailures = (job.failed || 0) > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 28,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24 }}>
        <RingProgress pct={pct} done={done} failed={hasFailures} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-eyebrow" style={{ marginBottom: 6 }}>
            {done ? 'Complete' : `Status · ${job.status}`}
          </div>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700,
            color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.015em',
          }}>
            {done
              ? hasFailures ? 'Done with some errors' : 'Ingest complete'
              : 'Parsing resumes…'}
          </h3>
          <div style={{ fontSize: 14, color: 'var(--slate)' }}>
            <strong style={{ color: 'var(--ink)' }}>{job.processed}</strong> of <strong style={{ color: 'var(--ink)' }}>{job.total}</strong> resumes handled
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 10, marginBottom: 20,
      }}>
        <Stat label="Succeeded" value={job.succeeded || 0} accent="sage" icon={CheckCircle} />
        <Stat label="Failed"    value={job.failed || 0}    accent="blush" icon={AlertTriangle} />
        <Stat label="Total"     value={job.total || 0}     accent="cool"  icon={FileText} />
      </div>

      {job.errors && job.errors.length > 0 && (
        <div style={{
          padding: 16,
          background: 'var(--blush-pale)',
          borderRadius: 10,
          border: '1px solid rgba(196,117,106,0.2)',
          marginBottom: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 700, color: 'var(--blush)',
            marginBottom: 12, letterSpacing: 0.3, textTransform: 'uppercase',
          }}>
            <AlertTriangle size={14} /> Errors ({job.errors.length})
          </div>
          {job.errors.slice(0, 5).map((e, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 6, lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.filename}:</strong> {e.message}
            </div>
          ))}
          {job.errors.length > 5 && (
            <div style={{ fontSize: 12, color: 'var(--slate-mid)', marginTop: 6 }}>
              … and {job.errors.length - 5} more
            </div>
          )}
        </div>
      )}

      {done && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onNew} className="btn-primary btn-lg">
            <UploadCloud size={16} /> Start new ingest
          </button>
          <Link to="/campus/students" className="btn-secondary btn-lg">
            See students →
          </Link>
        </div>
      )}
    </motion.div>
  )
}

function Stat({ label, value, accent, icon: Icon }) {
  const colors = {
    sage:  { bg: 'var(--gradient-sage-card)',  icon: 'var(--sage)',        ring: 'rgba(74,124,111,0.2)' },
    warm:  { bg: 'var(--gradient-warm-card)',  icon: 'var(--accent-warm)', ring: 'rgba(199,138,62,0.25)' },
    cool:  { bg: 'var(--gradient-cool-card)',  icon: 'var(--accent-cool)', ring: 'rgba(92,143,143,0.25)' },
    blush: { bg: 'var(--gradient-blush-card)', icon: 'var(--blush)',       ring: 'rgba(196,117,106,0.25)' },
  }[accent]
  return (
    <div style={{
      padding: 14,
      background: colors.bg,
      border: `1px solid ${colors.ring}`,
      borderRadius: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--slate-mid)', fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6 }}>
        <Icon size={11} color={colors.icon} />
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{
      background: 'var(--blush-light)', color: 'var(--blush)',
      padding: 14, borderRadius: 10, marginBottom: 16,
      fontSize: 14, border: '1px solid rgba(196,117,106,0.25)',
      display: 'flex', gap: 10, alignItems: 'center',
    }}>
      <AlertTriangle size={15} /> {children}
    </div>
  )
}
