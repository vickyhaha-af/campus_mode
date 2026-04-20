import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Calendar, DollarSign, AlertTriangle, Briefcase,
  Check, X, ArrowLeft, FileText, ShieldCheck, Building2,
  Share2, Download, Copy, Mail,
} from 'lucide-react'
import { getDrive, createRecruiterToken } from '../api'
import CampusNav from '../components/CampusNav'
import DriveShortlist from '../components/DriveShortlist'

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
      padding: '4px 11px', borderRadius: 'var(--radius-pill)',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.ring}`,
      textTransform: 'uppercase',
    }}>
      {cfg.label}
    </span>
  )
}

function HeroChip({ icon: Icon, label, value, accent = 'sage' }) {
  const colors = {
    sage:  { bg: 'var(--gradient-sage-card)',  ring: 'rgba(74,124,111,0.2)',  icon: 'var(--sage)' },
    warm:  { bg: 'var(--gradient-warm-card)',  ring: 'rgba(199,138,62,0.25)', icon: 'var(--accent-warm)' },
    cool:  { bg: 'var(--gradient-cool-card)',  ring: 'rgba(92,143,143,0.25)', icon: 'var(--accent-cool)' },
  }[accent]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: colors.bg,
      border: `1px solid ${colors.ring}`,
      borderRadius: 12,
      minWidth: 140,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'var(--white)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${colors.ring}`,
      }}>
        <Icon size={14} color={colors.icon} strokeWidth={2.2} />
      </div>
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontSize: 10.5, color: 'var(--slate-mid)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, marginTop: 2 }}>
          {value}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const cfg = {
    open:      { color: 'var(--moss)',        label: 'Open' },
    scheduled: { color: 'var(--accent-warm)', label: 'Scheduled' },
    closed:    { color: 'var(--slate-mid)',   label: 'Closed' },
    draft:     { color: 'var(--slate-mid)',   label: 'Draft' },
  }[status] || { color: 'var(--slate-mid)', label: status }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, fontWeight: 600,
      padding: '4px 12px', borderRadius: 'var(--radius-pill)',
      background: `${cfg.color}14`, color: cfg.color,
      border: `1px solid ${cfg.color}33`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function RuleRow({ label, val, hasValue }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: 12, alignItems: 'center',
      padding: '12px 14px',
      background: hasValue ? 'var(--sage-pale)' : 'var(--cream-mid)',
      border: `1px solid ${hasValue ? 'rgba(74,124,111,0.15)' : 'var(--border)'}`,
      borderRadius: 10,
      marginBottom: 8,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: hasValue ? 'var(--sage)' : 'var(--cream-deep)',
        color: hasValue ? '#fff' : 'var(--slate-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {hasValue ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
      </div>
      <span style={{ fontSize: 13.5, color: 'var(--ink-soft)', fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 13, color: hasValue ? 'var(--sage-dim)' : 'var(--slate-mid)',
        fontFamily: 'var(--font-mono)', fontWeight: 500,
      }}>{val}</span>
    </div>
  )
}

export default function DriveDetailPage() {
  const { driveId } = useParams()
  const [drive, setDrive] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      try { const { data } = await getDrive(driveId); setDrive(data) }
      catch (e) { setErr(e.response?.data?.detail || e.message) }
    })()
  }, [driveId])

  if (err) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <CampusNav />
        <div style={{ padding: 48, maxWidth: 600, margin: '0 auto' }}>
          <div style={{
            background: 'var(--blush-light)', color: 'var(--blush)',
            padding: 16, borderRadius: 12,
            border: '1px solid rgba(196,117,106,0.25)',
          }}>
            Error: {err}
          </div>
        </div>
      </div>
    )
  }

  if (!drive) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <CampusNav />
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
          <div className="skeleton" style={{ height: 20, width: 120, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 42, width: '50%', marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <div className="skeleton" style={{ height: 54, width: 160, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 54, width: 160, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 54, width: 160, borderRadius: 12 }} />
          </div>
          <div className="skeleton" style={{ height: 180, width: '100%', borderRadius: 14, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 240, width: '100%', borderRadius: 14 }} />
        </div>
      </div>
    )
  }

  const rules = drive.eligibility_rules || {}
  const hasDemoFilter = rules.gender_restriction

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 12,
          }}>
            <Link to="/campus/drives" className="btn-ghost" style={{ fontSize: 13, padding: '6px 10px 6px 4px' }}>
              <ArrowLeft size={14} /> All drives
            </Link>
            <DriveActions driveId={drive.id} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            {drive.company?.tier && <TierBadge tier={drive.company.tier} />}
            <StatusPill status={drive.status} />
          </div>

          <h1 className="text-display-lg" style={{ marginBottom: 4 }}>
            {drive.role}
          </h1>
          {drive.company?.name && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 17, color: 'var(--slate)', fontWeight: 500, marginBottom: 24,
            }}>
              <Building2 size={15} color="var(--slate-mid)" />
              {drive.company.name}
            </div>
          )}

          {/* Info chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            {drive.location && <HeroChip icon={MapPin} label="Location" value={drive.location} accent="sage" />}
            {drive.job_type && <HeroChip icon={Briefcase} label="Type" value={drive.job_type} accent="cool" />}
            {drive.ctc_offered && <HeroChip icon={DollarSign} label="CTC" value={drive.ctc_offered} accent="warm" />}
            {drive.scheduled_date && <HeroChip icon={Calendar} label="Scheduled" value={drive.scheduled_date} accent="cool" />}
          </div>
        </motion.div>

        {hasDemoFilter && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              background: 'var(--blush-pale)',
              border: '1px solid rgba(196,117,106,0.25)',
              color: 'var(--blush)',
              padding: 16, borderRadius: 12, marginBottom: 20,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              <strong>Demographic filter active:</strong> gender = {rules.gender_restriction}.
              {rules.gender_restriction_justification && (
                <div style={{ marginTop: 6, color: 'var(--slate)' }}>
                  Justification: {rules.gender_restriction_justification}
                </div>
              )}
            </div>
          </motion.div>
        )}

        <Section icon={FileText} title="Job description">
          {drive.jd_text ? (
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'var(--font-sans)', fontSize: 14.5,
              color: 'var(--slate)', lineHeight: 1.7, margin: 0,
            }}>{drive.jd_text}</pre>
          ) : (
            <p style={{ color: 'var(--slate-mid)', fontSize: 14, fontStyle: 'italic' }}>
              No JD text yet — richer JD means better matches.
            </p>
          )}
        </Section>

        <Section icon={ShieldCheck} title="Eligibility rules">
          <RuleRow label="Min CGPA"                     val={rules.min_cgpa ?? '—'}                                  hasValue={rules.min_cgpa != null} />
          <RuleRow label="Max active backlogs"          val={rules.max_active_backlogs ?? '—'}                        hasValue={rules.max_active_backlogs != null} />
          <RuleRow label="Max total backlogs"           val={rules.max_total_backlogs ?? '—'}                         hasValue={rules.max_total_backlogs != null} />
          <RuleRow label="Allowed branches"             val={rules.allowed_branches?.join(', ') || 'all'}             hasValue={rules.allowed_branches?.length > 0} />
          <RuleRow label="Allowed years"                val={rules.allowed_years?.join(', ') || 'all'}                hasValue={rules.allowed_years?.length > 0} />
          <RuleRow label="Location flexibility required" val={rules.location_flexibility_required ? 'yes' : 'no'}     hasValue={!!rules.location_flexibility_required} />
        </Section>

        <Section title="Shortlist">
          <DriveShortlist drive={drive} />
        </Section>
      </div>
    </div>
  )
}

function DriveActions({ driveId }) {
  const [showShare, setShowShare] = useState(false)

  const downloadCsv = () => {
    const base = (import.meta.env.VITE_API_URL || '/api') + '/campus'
    const url = `${base}/drives/${driveId}/shortlist.csv`
    window.location.href = url
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        className="btn-ghost btn-sm"
        onClick={downloadCsv}
        title="Download shortlist as CSV"
      >
        <Download size={13} /> Export CSV
      </button>
      <button
        className="btn-secondary btn-sm"
        onClick={() => setShowShare(true)}
        title="Generate a read-only share link for a recruiter"
      >
        <Share2 size={13} /> Share with recruiter
      </button>
      <AnimatePresence>
        {showShare && (
          <ShareRecruiterModal driveId={driveId} onClose={() => setShowShare(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}


function ShareRecruiterModal({ driveId, onClose }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const generate = async (e) => {
    e?.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setErr('Please enter a valid email.')
      return
    }
    setErr(''); setLoading(true)
    try {
      const { data } = await createRecruiterToken(driveId, email.trim())
      const url = `${window.location.origin}/campus/recruiter?token=${encodeURIComponent(data.token)}&drive=${driveId}`
      setResult({ url, expires_at: data.expires_at })
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Could not create link')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!result?.url) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Fallback: select text
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  const fmtExpiry = (iso) => {
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
    catch { return iso }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(30, 35, 40, 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%', maxWidth: 480,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--gradient-sage-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 10,
            }}>
              <Share2 size={16} color="var(--sage)" />
            </div>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700,
              color: 'var(--ink)', letterSpacing: '-0.015em', marginBottom: 4,
            }}>Share with recruiter</h3>
            <p style={{ fontSize: 13, color: 'var(--slate)', lineHeight: 1.5 }}>
              Generate a signed, read-only link for the recruiter to view this drive&apos;s shortlist.
              Expires in 30 days.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost btn-sm"
            style={{ padding: 6 }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {!result ? (
          <form onSubmit={generate} style={{ marginTop: 16 }}>
            <label style={{
              display: 'block', fontSize: 11.5, fontWeight: 600,
              color: 'var(--slate-mid)', marginBottom: 6,
              letterSpacing: 0.4, textTransform: 'uppercase',
            }}>Recruiter email</label>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Mail size={14} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--slate-mid)',
              }} />
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="recruiter@company.com"
                style={{
                  width: '100%', padding: '10px 14px 10px 36px',
                  fontSize: 14, border: '1px solid var(--border)',
                  borderRadius: 10, background: 'var(--cream)',
                  color: 'var(--ink)', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            {err && (
              <div style={{
                marginBottom: 12, padding: '8px 10px', fontSize: 12.5,
                background: 'var(--blush-pale)', color: 'var(--blush)',
                border: '1px solid rgba(196,117,106,0.25)', borderRadius: 8,
              }}>{err}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary btn-sm" disabled={loading}>
                {loading ? 'Generating…' : 'Generate link'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ marginTop: 16 }}>
            <label style={{
              display: 'block', fontSize: 11.5, fontWeight: 600,
              color: 'var(--slate-mid)', marginBottom: 6,
              letterSpacing: 0.4, textTransform: 'uppercase',
            }}>Share this URL with the recruiter</label>
            <div style={{
              display: 'flex', gap: 6, marginBottom: 10,
              background: 'var(--cream)', padding: 8, borderRadius: 10,
              border: '1px solid var(--border)',
            }}>
              <input
                readOnly
                value={result.url}
                onFocus={(e) => e.target.select()}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: 12.5, fontFamily: 'var(--font-mono)',
                  color: 'var(--slate)', outline: 'none',
                  padding: '0 4px',
                }}
              />
              <button
                className="btn-secondary btn-sm"
                onClick={copyLink}
                style={{ flexShrink: 0 }}
              >
                <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate-mid)', marginBottom: 18 }}>
              Link expires on <strong>{fmtExpiry(result.expires_at)}</strong>.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="btn-ghost btn-sm"
                onClick={() => { setResult(null); setEmail('') }}
              >Create another</button>
              <button className="btn-primary btn-sm" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}


function Section({ icon: Icon, title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 24, marginBottom: 16,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h3 style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--font-display)',
        fontSize: 20, fontWeight: 700,
        color: 'var(--ink)', marginBottom: 18,
        letterSpacing: '-0.015em',
      }}>
        {Icon && <Icon size={17} color="var(--sage)" />}
        {title}
      </h3>
      {children}
    </motion.div>
  )
}
