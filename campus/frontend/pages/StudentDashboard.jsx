import React from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'

export default function StudentDashboard() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <GraduationCap size={28} color="var(--accent-experience)" />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', marginTop: 12, marginBottom: 12 }}>
          Student Dashboard
        </h1>
        <p style={{ color: 'var(--slate)', marginBottom: 24 }}>
          Coming in Phase 1.5. Will show your profile preview, eligible upcoming drives, shortlist status,
          and interview invites.
        </p>
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24 }}>
          <div style={{ color: 'var(--slate-mid)', fontSize: 14 }}>
            Student-facing surfaces aren&apos;t live yet. PC admins currently drive all workflows from{' '}
            <Link to="/campus/pc" style={{ color: 'var(--sage)' }}>PC Dashboard</Link>.
          </div>
        </div>
        <Link to="/campus" style={{ display: 'inline-block', marginTop: 24, color: 'var(--slate)' }}>← Back</Link>
      </div>
    </div>
  )
}
