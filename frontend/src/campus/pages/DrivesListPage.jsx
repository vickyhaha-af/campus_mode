import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Briefcase, ArrowRight, MapPin, Calendar, DollarSign,
  X, Sparkles, Building2, FileText, AlertTriangle,
} from 'lucide-react'
import { listDrives, listCompanies, createCompany, createDrive } from '../api'
import CampusNav from '../components/CampusNav'

/* ----- tier badge ----- */
function TierBadge({ tier }) {
  const cfg = {
    tier_1: { label: 'Tier 1', bg: 'linear-gradient(135deg, var(--accent-warm-light), var(--white))', color: 'var(--accent-warm-dim)', ring: 'rgba(199,138,62,0.3)' },
    tier_2: { label: 'Tier 2', bg: 'linear-gradient(135deg, var(--accent-cool-light), var(--white))', color: 'var(--accent-cool-dim)', ring: 'rgba(92,143,143,0.3)' },
    tier_3: { label: 'Tier 3', bg: 'var(--cream-mid)',                                                 color: 'var(--slate)',            ring: 'var(--border)' },
  }[tier] || null
  if (!cfg) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 'var(--radius-pill)',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.ring}`,
      textTransform: 'uppercase',
    }}>
      {cfg.label}
    </span>
  )
}

function StatusPill({ status }) {
  const cfg = {
    open:      { color: 'var(--moss)',        label: 'Open' },
    scheduled: { color: 'var(--accent-warm)', label: 'Scheduled' },
    closed:    { color: 'var(--slate-mid)',   label: 'Closed' },
    draft:     { color: 'var(--slate-mid)',   label: 'Draft' },
  }[status] || { color: 'var(--slate-mid)', label: status || 'unknown' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11.5, fontWeight: 600,
      padding: '3px 10px', borderRadius: 'var(--radius-pill)',
      background: `${cfg.color}14`,
      color: cfg.color,
      border: `1px solid ${cfg.color}33`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function InfoChip({ icon: Icon, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, color: 'var(--slate)',
      padding: '3px 10px',
      background: 'var(--cream-mid)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      fontWeight: 500,
    }}>
      <Icon size={11} color="var(--slate-mid)" />
      {children}
    </span>
  )
}

export default function DrivesListPage() {
  const collegeId = typeof window !== 'undefined' ? localStorage.getItem('campus_college_id') : null
  const [drives, setDrives] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!collegeId) return
    setLoading(true)
    try {
      const { data } = await listDrives({ college_id: collegeId })
      setDrives(data)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed to load drives')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [])

  if (!collegeId) return <RequireCollege />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 80px' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            marginBottom: 30, flexWrap: 'wrap', gap: 16,
          }}
        >
          <div>
            <div className="text-eyebrow" style={{ marginBottom: 10 }}>Drives</div>
            <h1 className="text-display" style={{ marginBottom: 6 }}>
              Every drive, <span className="text-display-italic">tracked.</span>
            </h1>
            <p className="text-body" style={{ fontSize: 14.5 }}>
              {drives.length > 0
                ? `${drives.length} drive${drives.length === 1 ? '' : 's'} · click one to open its shortlist.`
                : 'Create your first drive to start matching.'}
            </p>
          </div>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowNew(true)}
            className="btn-primary btn-lg"
          >
            <Plus size={16} /> New drive
          </motion.button>
        </motion.div>

        {err && <ErrorBox>{err}</ErrorBox>}

        {loading ? (
          <LoadingCards />
        ) : drives.length === 0 ? (
          <EmptyBlock onNew={() => setShowNew(true)} />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {drives.map((d, i) => <DriveCard key={d.id} drive={d} index={i} />)}
          </div>
        )}

        <AnimatePresence>
          {showNew && (
            <NewDriveModal
              collegeId={collegeId}
              onClose={() => setShowNew(false)}
              onCreated={refresh}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ----- drive card ----- */
function DriveCard({ drive, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
    >
      <Link to={`/campus/drives/${drive.id}`} style={{ textDecoration: 'none' }}>
        <motion.div
          whileHover="hover"
          initial="rest"
          animate="rest"
          variants={{
            rest:  { y: 0,  boxShadow: 'var(--shadow-sm)' },
            hover: { y: -3, boxShadow: 'var(--shadow-lg)' },
          }}
          transition={{ duration: 0.22 }}
          style={{
            position: 'relative',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {/* gradient rail on hover */}
          <motion.div
            variants={{
              rest:  { scaleY: 0.3, opacity: 0.4 },
              hover: { scaleY: 1,   opacity: 1   },
            }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: 3,
              background: drive.company?.tier === 'tier_1'
                ? 'var(--accent-warm)'
                : drive.company?.tier === 'tier_2'
                ? 'var(--accent-cool)'
                : 'var(--sage)',
              transformOrigin: 'center',
            }}
          />

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20, fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                }}>
                  {drive.role}
                </h3>
                {drive.company?.tier && <TierBadge tier={drive.company.tier} />}
                <StatusPill status={drive.status} />
              </div>
              {drive.company?.name && (
                <div style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 12, fontWeight: 500 }}>
                  {drive.company.name}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {drive.location && <InfoChip icon={MapPin}>{drive.location}</InfoChip>}
                {drive.job_type && <InfoChip icon={Briefcase}>{drive.job_type}</InfoChip>}
                {drive.scheduled_date && <InfoChip icon={Calendar}>{drive.scheduled_date}</InfoChip>}
                {drive.ctc_offered && <InfoChip icon={DollarSign}>{drive.ctc_offered}</InfoChip>}
              </div>
            </div>
            <motion.div
              variants={{
                rest:  { x: 0, opacity: 0.4 },
                hover: { x: 4, opacity: 1 },
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: 'var(--sage-dim)', fontWeight: 600, fontSize: 13,
                whiteSpace: 'nowrap',
                alignSelf: 'center',
              }}
            >
              Open drive <ArrowRight size={14} />
            </motion.div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}

/* ----- new drive modal ----- */
function NewDriveModal({ collegeId, onClose, onCreated }) {
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('')
  const [jdText, setJdText] = useState('')
  const [minCgpa, setMinCgpa] = useState('')
  const [maxBacklogs, setMaxBacklogs] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const companies = await listCompanies(collegeId)
      let company = companies.data.find((c) => c.name.toLowerCase() === companyName.trim().toLowerCase())
      if (!company) {
        const { data } = await createCompany({ college_id: collegeId, name: companyName.trim() })
        company = data
      }
      await createDrive({
        college_id: collegeId,
        company_id: company.id,
        role: role.trim(),
        jd_text: jdText,
        location,
        eligibility_rules: {
          min_cgpa: minCgpa ? parseFloat(minCgpa) : null,
          max_active_backlogs: maxBacklogs ? parseInt(maxBacklogs) : null,
        },
      })
      onCreated()
      onClose()
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(26,32,44,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          borderRadius: 18,
          padding: 32,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div className="text-eyebrow" style={{ marginBottom: 8 }}>New drive</div>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700,
              color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.15,
            }}>
              Add a <span style={{ color: 'var(--sage)', fontStyle: 'italic' }}>fresh</span> drive
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: 8 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit}>
          {/* Group: Company & Role */}
          <FieldGroup icon={Building2} title="Company & role">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <L label="Company" required>
                <input className="input-field" value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)} required placeholder="Acme Corp" />
              </L>
              <L label="Role" required>
                <input className="input-field" value={role}
                  onChange={(e) => setRole(e.target.value)} required placeholder="Backend Engineer" />
              </L>
            </div>
            <L label="Location">
              <input className="input-field" value={location}
                onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru, India" />
            </L>
          </FieldGroup>

          {/* Group: JD */}
          <FieldGroup icon={FileText} title="Job description">
            <L label="JD text" hint="Paste the full JD — richer text = better matches.">
              <textarea className="input-field" value={jdText}
                onChange={(e) => setJdText(e.target.value)} rows={5} placeholder="Key responsibilities, required skills, nice-to-haves…" />
            </L>
          </FieldGroup>

          {/* Group: Eligibility */}
          <FieldGroup icon={Sparkles} title="Eligibility">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <L label="Min CGPA">
                <input type="number" step="0.1" className="input-field" value={minCgpa}
                  onChange={(e) => setMinCgpa(e.target.value)} placeholder="6.5" />
              </L>
              <L label="Max active backlogs">
                <input type="number" className="input-field" value={maxBacklogs}
                  onChange={(e) => setMaxBacklogs(e.target.value)} placeholder="0" />
              </L>
            </div>
          </FieldGroup>

          {err && <ErrorBox>{err}</ErrorBox>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={`btn-primary btn-lg ${busy ? 'is-loading' : ''}`} style={{ flex: 2 }}>
              {busy ? 'Creating…' : <>Create drive <ArrowRight size={16} /></>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function FieldGroup({ icon: Icon, title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, fontWeight: 700,
        color: 'var(--slate-mid)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 12,
      }}>
        <Icon size={12} /> {title}
      </div>
      {children}
    </div>
  )
}

function L({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--blush)' }}> *</span>}
      </label>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--slate-mid)', marginBottom: 8 }}>{hint}</div>}
      {children}
    </div>
  )
}

function EmptyBlock({ onNew }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--white)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 18,
        padding: '60px 24px',
        textAlign: 'center',
      }}
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 72, height: 72, borderRadius: 18,
          background: 'var(--gradient-sage-card)',
          border: '1px solid rgba(74,124,111,0.2)',
          margin: '0 auto 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Briefcase size={32} color="var(--sage)" strokeWidth={1.8} />
      </motion.div>
      <h3 className="text-display" style={{ marginBottom: 8 }}>No drives yet</h3>
      <p style={{ color: 'var(--slate-mid)', fontSize: 14, marginBottom: 22, maxWidth: 380, margin: '0 auto 22px' }}>
        A drive brings together a company, a role, and eligibility rules. Create your first — it takes 30 seconds.
      </p>
      <button onClick={onNew} className="btn-primary btn-lg">
        <Plus size={16} /> Create first drive
      </button>
    </motion.div>
  )
}

function LoadingCards() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20,
        }}>
          <div className="skeleton" style={{ height: 18, width: '30%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 12, width: '55%', marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ height: 22, width: 90, borderRadius: 999 }} />
            <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RequireCollege() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link to="/campus/setup" className="btn-primary btn-lg">
        Set up college first <ArrowRight size={16} />
      </Link>
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{
      background: 'var(--blush-light)', color: 'var(--blush)',
      padding: 12, borderRadius: 10, marginBottom: 16,
      fontSize: 13, border: '1px solid rgba(196,117,106,0.25)',
      display: 'flex', gap: 10, alignItems: 'center',
    }}>
      <AlertTriangle size={14} /> {children}
    </div>
  )
}
