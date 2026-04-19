import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, CheckCircle, AlertTriangle } from 'lucide-react'
import { createCollege } from '../api'

const DEFAULT_BRANCHES = ['CSE', 'ECE', 'EE', 'ME', 'Civil', 'Chem', 'IT', 'MBA']

export default function CollegeSetupPage() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [branches, setBranches] = useState(DEFAULT_BRANCHES)
  const [newBranch, setNewBranch] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const autoSlug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!name.trim() || !slug.trim()) {
      setErr('Name and slug are required')
      return
    }
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
      nav('/campus/pc')
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed to create college')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '64px 24px' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 640, margin: '0 auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Building2 size={26} color="var(--sage)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)' }}>
            Set up your college
          </h1>
        </div>
        <p style={{ color: 'var(--slate)', marginBottom: 32 }}>
          One-time configuration. You can edit these later from settings.
        </p>

        <form onSubmit={handleSubmit} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 28 }}>
          <Field label="College name" hint="e.g., Indian Institute of Management Ranchi">
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)) }}
              placeholder="IIM Ranchi"
            />
          </Field>

          <Field label="Slug" hint="URL-safe identifier. Must be unique. Auto-filled from name.">
            <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="iim-ranchi" />
          </Field>

          <Field label="Logo URL (optional)">
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
          </Field>

          <Field label="Branches" hint="Academic departments. Press Enter to add.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {branches.map((b) => (
                <span key={b} style={{
                  background: 'var(--sage-light)', color: 'var(--sage-dim)',
                  padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 13,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {b}
                  <button type="button" onClick={() => setBranches(branches.filter((x) => x !== b))}
                    style={{ background: 'none', border: 'none', color: 'var(--sage-dim)', cursor: 'pointer', padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <input
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newBranch.trim()) {
                  e.preventDefault()
                  if (!branches.includes(newBranch.trim())) setBranches([...branches, newBranch.trim()])
                  setNewBranch('')
                }
              }}
              placeholder="Add a branch (press Enter)"
            />
          </Field>

          {err && (
            <div style={{ background: 'var(--blush-light)', color: 'var(--blush)', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 14 }}>{err}</span>
            </div>
          )}

          <button type="submit" disabled={busy} style={btnPrimary(busy)}>
            {busy ? 'Creating…' : <>Create college <CheckCircle size={16} /></>}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: 6 }}>{label}</label>
      {hint && <div style={{ fontSize: 12, color: 'var(--slate-mid)', marginBottom: 8 }}>{hint}</div>}
      <style>{`
        input, textarea {
          width: 100%; padding: 10px 14px; border: 1px solid var(--border);
          border-radius: var(--radius-input); font-family: var(--font-sans); font-size: 14px;
          background: var(--cream); color: var(--ink);
        }
        input:focus, textarea:focus {
          outline: none; border-color: var(--sage); box-shadow: var(--shadow-focus);
        }
      `}</style>
      {children}
    </div>
  )
}

const btnPrimary = (busy) => ({
  background: busy ? 'var(--slate-light)' : 'var(--sage)',
  color: 'var(--white)',
  border: 'none',
  padding: '12px 20px',
  borderRadius: 'var(--radius-btn)',
  fontSize: 14,
  fontWeight: 500,
  cursor: busy ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
})
