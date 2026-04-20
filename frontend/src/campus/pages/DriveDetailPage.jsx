import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MapPin, Calendar, DollarSign, AlertTriangle, Briefcase,
  Check, X, ArrowLeft, FileText, ShieldCheck, Building2,
} from 'lucide-react'
import { getDrive } from '../api'
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
          <Link to="/campus/drives" className="btn-ghost" style={{ marginBottom: 20, fontSize: 13, padding: '6px 10px 6px 4px' }}>
            <ArrowLeft size={14} /> All drives
          </Link>

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
