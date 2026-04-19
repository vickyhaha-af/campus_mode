import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UploadCloud, Briefcase, Users, MessageSquareText, Settings, ArrowRight } from 'lucide-react'
import { listDrives, listStudents } from '../api'
import CampusNav from '../components/CampusNav'
import SetupBanner from '../components/SetupBanner'

export default function PCDashboard() {
  const collegeId = localStorage.getItem('campus_college_id')
  const [stats, setStats] = useState({ students: null, drives: null, unplaced: null })
  const [recentDrives, setRecentDrives] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!collegeId) return
    ;(async () => {
      try {
        const [s, d, u] = await Promise.all([
          listStudents({ college_id: collegeId, limit: 1000 }),
          listDrives({ college_id: collegeId }),
          listStudents({ college_id: collegeId, placed_status: 'unplaced', limit: 1000 }),
        ])
        setStats({
          students: s.data.length,
          drives: d.data.length,
          unplaced: u.data.length,
        })
        setRecentDrives(d.data.slice(0, 5))
      } catch (e) {
        setErr(e.response?.data?.detail || e.message || 'Failed to load dashboard')
      }
    })()
  }, [collegeId])

  if (!collegeId) {
    return (
      <EmptyState message="No college configured. Set one up first.">
        <Link to="/campus/setup" style={linkBtn}>Set up college →</Link>
      </EmptyState>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <CampusNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <SetupBanner />
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--ink)', marginBottom: 8 }}>
          Placement Dashboard
        </motion.h1>
        <p style={{ color: 'var(--slate)', marginBottom: 32 }}>
          All drives, all students, one view.
        </p>

        {err && <ErrorBox>{err}</ErrorBox>}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatCard label="Students in pool" value={stats.students} icon={Users} color="var(--sage)" />
          <StatCard label="Active drives" value={stats.drives} icon={Briefcase} color="var(--accent-experience)" />
          <StatCard label="Unplaced students" value={stats.unplaced} icon={Users} color="var(--blush)" />
        </div>

        {/* Quick actions */}
        <h2 style={sectionHeading}>Quick actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 32 }}>
          <ActionCard to="/campus/ingest" icon={UploadCloud} label="Ingest resumes" hint="Bulk upload 60–100" />
          <ActionCard to="/campus/drives" icon={Briefcase} label="Manage drives" hint="View or create" />
          <ActionCard to="/campus/students" icon={Users} label="Browse students" hint="Filter + search" />
          <ActionCard to="/campus/chat" icon={MessageSquareText} label="Matching chat" hint="Ask the bot" pending />
        </div>

        {/* Recent drives */}
        <h2 style={sectionHeading}>Recent drives</h2>
        {recentDrives.length === 0 ? (
          <p style={{ color: 'var(--slate-mid)', fontSize: 14 }}>
            No drives yet. <Link to="/campus/drives" style={{ color: 'var(--sage)' }}>Create one →</Link>
          </p>
        ) : (
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
            {recentDrives.map((d, i) => (
              <Link key={d.id} to={`/campus/drives/${d.id}`}
                style={{
                  display: 'flex', alignItems: 'center', padding: '14px 20px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  textDecoration: 'none', color: 'var(--ink)',
                }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{d.role}</div>
                  <div style={{ fontSize: 13, color: 'var(--slate-mid)' }}>
                    {d.location || '—'} · {d.status}
                  </div>
                </div>
                <ArrowRight size={16} color="var(--slate-light)" />
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--slate-mid)' }}>{label}</span>
        <Icon size={16} color={color} />
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', marginTop: 8 }}>
        {value === null ? '—' : value}
      </div>
    </div>
  )
}

function ActionCard({ to, icon: Icon, label, hint, pending }) {
  return (
    <Link to={to} style={{
      background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
      padding: 16, textDecoration: 'none', color: 'var(--ink)',
      display: 'block', transition: 'all 0.15s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sage)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={18} color="var(--sage)" />
        <span style={{ fontWeight: 500 }}>{label}</span>
        {pending && <span style={{ fontSize: 11, color: 'var(--accent-education)', background: 'var(--cream-deep)', padding: '2px 6px', borderRadius: 4 }}>Phase 2</span>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--slate-mid)', marginLeft: 28, marginTop: 4 }}>{hint}</div>
    </Link>
  )
}

const sectionHeading = { fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginBottom: 16, marginTop: 8 }
const linkBtn = { background: 'var(--sage)', color: 'var(--white)', padding: '10px 16px', borderRadius: 'var(--radius-btn)', textDecoration: 'none', fontSize: 14 }

function EmptyState({ message, children }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <p style={{ color: 'var(--slate)', fontSize: 16 }}>{message}</p>
      {children}
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{ background: 'var(--blush-light)', color: 'var(--blush)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
      {children}
    </div>
  )
}
