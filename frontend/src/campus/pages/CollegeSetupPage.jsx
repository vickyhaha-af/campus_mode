import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, CheckCircle, AlertTriangle, Hash, Image as ImageIcon,
  GraduationCap, Sparkles, ArrowRight, Plus,
} from 'lucide-react'
import { createCollege } from '../api'
import { useToast } from '../components/Toast'

const DEFAULT_BRANCHES = ['CSE', 'ECE', 'EE', 'ME', 'Civil', 'Chem', 'IT', 'MBA']
const RECOMMENDED = new Set(DEFAULT_BRANCHES)

export default function CollegeSetupPage() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [branches, setBranches] = useState(DEFAULT_BRANCHES)
  const [newBranch, setNewBranch] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [err, setErr] = useState('')
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const autoSlug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!name.trim() || !slug.trim()) { setErr('Name and slug are required'); return }
    setBusy(true)
    try {
      const { data } = await createCollege({
        name: name.trim(),
        slug: slug.trim(),
        logo_url: logoUrl.trim() || null,
        branches,
      })
      localStorage.setItem('campus_college_id', data.id)
      localStorage.setItem('campus_college_slug', data.slug)
      toast.success(`College '${name.trim()}' created`); nav('/campus/pc')
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Failed to create college'; setErr(msg); toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gradient-hero)',
      padding: '56px 24px 80px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient blobs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: -120, right: -80,
            width: 420, height: 420, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(74,124,111,0.15) 0%, transparent 60%)',
            filter: 'blur(20px)',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ maxWidth: 1060, margin: '0 auto', position: 'relative', zIndex: 1 }}
      >
        <Link to="/campus" className="btn-ghost" style={{ marginBottom: 20, fontSize: 13, padding: '6px 10px 6px 4px' }}>
          ← Back
        </Link>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 10 }}>
          <motion.div
            animate={{ rotate: [0, -4, 0, 4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'var(--gradient-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Building2 size={24} color="#fff" strokeWidth={2} />
          </motion.div>
          <div className="text-eyebrow">One-time setup</div>
        </div>

        <h1 className="text-display-lg" style={{ marginBottom: 10 }}>
          Let's set up <span className="text-display-italic">your college</span>
        </h1>
        <p className="text-body-lg" style={{ color: 'var(--slate)', marginBottom: 36, maxWidth: 620 }}>
          90 seconds. You can edit everything later from settings.
        </p>

        <div className="college-setup-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
          <style>{`@media (max-width: 860px) { .college-setup-grid { grid-template-columns: 1fr !important; } }`}</style>
          {/* FORM */}
          <form onSubmit={handleSubmit} style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: 32,
            boxShadow: 'var(--shadow-md)',
          }}>
            <FieldGroup icon={GraduationCap} title="Identity">
              <Field label="College name" required hint="e.g., Indian Institute of Management Ranchi">
                <input
                  className="input-field"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)) }}
                  placeholder="IIM Ranchi"
                />
              </Field>

              <Field label="Slug" required hint="URL-safe identifier. Must be unique.">
                <div style={{ position: 'relative' }}>
                  <Hash size={14} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--slate-mid)',
                  }} />
                  <input
                    className="input-field"
                    value={slug}
                    onChange={(e) => setSlug(autoSlug(e.target.value))}
                    placeholder="iim-ranchi"
                    style={{ paddingLeft: 34, fontFamily: 'var(--font-mono)', fontSize: 14 }}
                  />
                </div>
              </Field>

              <Field label="Logo URL" hint="Optional — shown in nav and student portal.">
                <div style={{ position: 'relative' }}>
                  <ImageIcon size={14} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--slate-mid)',
                  }} />
                  <input
                    className="input-field"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://…"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </Field>
            </FieldGroup>

            <FieldGroup icon={Sparkles} title="Branches">
              <Field label="Academic departments" hint="Press Enter to add a new branch. Click × to remove.">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12, minHeight: 32 }}>
                  <AnimatePresence>
                    {branches.map((b) => {
                      const isRec = RECOMMENDED.has(b)
                      return (
                        <motion.span
                          key={b}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 10px 5px 12px',
                            background: isRec ? 'var(--sage-light)' : 'var(--accent-warm-light)',
                            color: isRec ? 'var(--sage-dim)' : 'var(--accent-warm-dim)',
                            border: `1px solid ${isRec ? 'rgba(74,124,111,0.25)' : 'rgba(199,138,62,0.3)'}`,
                            borderRadius: 'var(--radius-pill)',
                            fontSize: 13, fontWeight: 600,
                          }}
                        >
                          {b}
                          {isRec && <span style={{
                            fontSize: 9, fontWeight: 700,
                            padding: '1px 5px', background: 'var(--sage)', color: '#fff',
                            borderRadius: 3, letterSpacing: 0.4,
                          }}>REC</span>}
                          <button type="button"
                            onClick={() => setBranches(branches.filter((x) => x !== b))}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              color: 'inherit', opacity: 0.6,
                              display: 'flex', alignItems: 'center',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
                          >
                            ×
                          </button>
                        </motion.span>
                      )
                    })}
                  </AnimatePresence>
                </div>
                <div style={{ position: 'relative' }}>
                  <Plus size={14} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--slate-mid)',
                  }} />
                  <input
                    className="input-field"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newBranch.trim()) {
                        e.preventDefault()
                        if (!branches.includes(newBranch.trim())) setBranches([...branches, newBranch.trim()])
                        setNewBranch('')
                      }
                    }}
                    placeholder="Add a branch and press Enter…"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </Field>
            </FieldGroup>

            {err && (
              <div style={{
                background: 'var(--blush-light)', color: 'var(--blush)',
                padding: 12, borderRadius: 10, marginBottom: 16,
                border: '1px solid rgba(196,117,106,0.25)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <AlertTriangle size={15} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5 }}>{err}</span>
              </div>
            )}

            <motion.button
              type="submit"
              disabled={busy}
              whileHover={!busy ? { y: -1 } : {}}
              whileTap={{ scale: 0.98 }}
              className={`btn-primary btn-lg ${busy ? 'is-loading' : ''}`}
              style={{ width: '100%', marginTop: 4 }}
            >
              {busy ? 'Creating…' : <>Create college <CheckCircle size={16} /></>}
            </motion.button>
          </form>

          {/* PREVIEW */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div className="text-eyebrow" style={{ marginBottom: 12 }}>Live preview</div>
            <CollegeCardPreview name={name} slug={slug} logoUrl={logoUrl} branches={branches} />
            <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--slate-mid)', lineHeight: 1.55 }}>
              This is roughly how your college will show up throughout the app — in nav, student portal, and recruiter views.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function CollegeCardPreview({ name, slug, logoUrl, branches }) {
  return (
    <motion.div
      layout
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 16, padding: 20,
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* gradient corner */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 140, height: 140,
        background: 'var(--gradient-sage-card)',
        borderRadius: '0 16px 0 100%',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: logoUrl ? `center/cover url(${logoUrl})` : 'var(--gradient-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border)',
        }}>
          {!logoUrl && <GraduationCap size={26} color="#fff" strokeWidth={2} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700,
            color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name || 'Your college name'}
          </div>
          {slug ? (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--sage-dim)', marginTop: 4,
            }}>
              /campus/{slug}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--slate-light)', marginTop: 4 }}>
              slug-preview
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-mid)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
        {branches.length} branch{branches.length === 1 ? '' : 'es'}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {branches.slice(0, 10).map((b) => (
          <span key={b} className="chip" style={{ fontSize: 11 }}>{b}</span>
        ))}
        {branches.length > 10 && (
          <span className="chip neutral" style={{ fontSize: 11 }}>+{branches.length - 10} more</span>
        )}
      </div>
    </motion.div>
  )
}

function FieldGroup({ icon: Icon, title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, fontWeight: 700,
        color: 'var(--slate-mid)',
        letterSpacing: 0.8, textTransform: 'uppercase',
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        {Icon && <Icon size={13} color="var(--sage)" />}
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--blush)' }}> *</span>}
      </label>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--slate-mid)', marginBottom: 8, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  )
}
