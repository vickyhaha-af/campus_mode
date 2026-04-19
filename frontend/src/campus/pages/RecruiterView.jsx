import React from 'react'
import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'

export default function RecruiterView() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Briefcase size={28} color="var(--accent-education)" />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', marginTop: 12, marginBottom: 12 }}>
          Recruiter view
        </h1>
        <p style={{ color: 'var(--slate)', marginBottom: 24 }}>
          Signed-token view-only access to your drive shortlist lands in Phase 1.5. Your placement contact
          will share a link when the shortlist is ready.
        </p>
        <Link to="/campus" style={{ color: 'var(--slate)' }}>← Back</Link>
      </div>
    </div>
  )
}
