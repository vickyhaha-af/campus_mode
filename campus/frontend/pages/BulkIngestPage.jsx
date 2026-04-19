import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UploadCloud, FileText, X, CheckCircle, AlertTriangle, Play } from 'lucide-react'
import { startIngest, pollIngest } from '../api'
import CampusNav from '../components/CampusNav'

const POLL_MS = 2500

export default function BulkIngestPage() {
  const collegeId = localStorage.getItem('campus_college_id')
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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', marginBottom: 8 }}>
          Bulk resume ingest
        </motion.h1>
        <p style={{ color: 'var(--slate)', marginBottom: 24 }}>
          Drop up to 150 resumes (PDF or DOCX). Each gets parsed, enriched with nuance (passions, personality, role-fit), and embedded for later matching. Target: &lt;5 min per 100 resumes on free-tier Gemini.
        </p>

        {err && <ErrorBox>{err}</ErrorBox>}

        {!job ? (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files) }}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--sage)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--radius-card)', background: dragOver ? 'var(--sage-pale)' : 'var(--white)',
                padding: '48px 20px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <UploadCloud size={36} color="var(--sage)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>
                Drop resumes here or click to browse
              </div>
              <div style={{ fontSize: 13, color: 'var(--slate-mid)' }}>PDF or DOCX · up to 150 files</div>
              <input ref={inputRef} type="file" multiple accept=".pdf,.docx" style={{ display: 'none' }}
                onChange={(e) => onFiles(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: 20, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--slate)' }}>{files.length} file(s) queued</span>
                  <button onClick={() => setFiles([])} style={secondaryBtn}>Clear</button>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: i === files.length - 1 ? 'none' : '1px solid var(--border)' }}>
                      <FileText size={14} color="var(--slate-mid)" />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--slate)' }}>{f.name}</span>
                      <button onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: 'var(--slate-mid)', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleStart} disabled={!files.length}
              style={{ ...primaryBtn, marginTop: 20, opacity: files.length ? 1 : 0.5, cursor: files.length ? 'pointer' : 'not-allowed' }}>
              <Play size={16} /> Start ingest
            </button>
          </>
        ) : (
          <IngestProgress job={job} pct={pct} onNew={() => { setJob(null); setFiles([]); if (pollRef.current) clearInterval(pollRef.current) }} />
        )}

      </div>
    </div>
  )
}

function IngestProgress({ job, pct, onNew }) {
  const done = job.status === 'completed' || job.status === 'failed'
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        {done
          ? <CheckCircle size={20} color={job.failed ? 'var(--blush)' : 'var(--sage)'} />
          : <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} style={{ display: 'inline-flex' }}>
              <UploadCloud size={20} color="var(--sage)" />
            </motion.div>
        }
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>
          {done ? (job.failed ? 'Completed with errors' : 'Ingest complete') : `Processing · ${job.status}`}
        </h3>
      </div>

      <div style={{ height: 8, background: 'var(--cream-deep)', borderRadius: 'var(--radius-bar)', overflow: 'hidden', marginBottom: 10 }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }}
          style={{ height: '100%', background: 'var(--sage)' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--slate)' }}>
        <span>{job.processed} / {job.total} processed</span>
        <span>{pct}%</span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 20, fontSize: 13 }}>
        <Stat label="Succeeded" value={job.succeeded} color="var(--sage)" />
        <Stat label="Failed" value={job.failed} color="var(--blush)" />
      </div>

      {job.errors && job.errors.length > 0 && (
        <div style={{ marginTop: 20, padding: 14, background: 'var(--blush-pale)', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--blush)', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertTriangle size={14} /> Errors ({job.errors.length})
          </div>
          {job.errors.slice(0, 5).map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 4 }}>
              <strong>{e.filename}:</strong> {e.message}
            </div>
          ))}
          {job.errors.length > 5 && <div style={{ fontSize: 12, color: 'var(--slate-mid)' }}>… and {job.errors.length - 5} more</div>}
        </div>
      )}

      {done && <button onClick={onNew} style={{ ...primaryBtn, marginTop: 24 }}>Start new ingest</button>}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, padding: 12, background: 'var(--cream-mid)', borderRadius: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--slate-mid)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color }}>{value}</div>
    </div>
  )
}

function ErrorBox({ children }) {
  return <div style={{ background: 'var(--blush-light)', color: 'var(--blush)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{children}</div>
}

const primaryBtn = { background: 'var(--sage)', color: 'var(--white)', border: 'none', padding: '10px 18px', borderRadius: 'var(--radius-btn)', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }
const secondaryBtn = { background: 'transparent', color: 'var(--slate)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 'var(--radius-btn)', fontSize: 13, cursor: 'pointer' }
