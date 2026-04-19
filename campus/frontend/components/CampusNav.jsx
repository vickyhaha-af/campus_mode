import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Users, Briefcase, MessageSquareText, UploadCloud, LogOut, Zap } from 'lucide-react'

const LINKS = [
  { to: '/campus/pc',       icon: Home,              label: 'Dashboard' },
  { to: '/campus/students', icon: Users,             label: 'Students'  },
  { to: '/campus/drives',   icon: Briefcase,         label: 'Drives'    },
  { to: '/campus/ingest',   icon: UploadCloud,       label: 'Ingest'    },
  { to: '/campus/chat',     icon: MessageSquareText, label: 'Chat'      },
]

export default function CampusNav() {
  const loc = useLocation()
  const nav = useNavigate()
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('campus_demo_mode') === '1'
  const slug = typeof window !== 'undefined' ? localStorage.getItem('campus_college_slug') : ''

  const exitDemo = () => {
    localStorage.removeItem('campus_demo_mode')
    localStorage.removeItem('campus_college_id')
    localStorage.removeItem('campus_college_slug')
    nav('/campus')
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24,
      }}
    >
      <Link to="/campus/pc" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <Zap size={18} color="var(--sage)" />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)', lineHeight: 1 }}>
            TechVista Campus
          </div>
          {slug && (
            <div style={{ fontSize: 11, color: 'var(--slate-mid)', marginTop: 2 }}>{slug}</div>
          )}
        </div>
      </Link>

      <nav style={{ display: 'flex', gap: 4, flex: 1, marginLeft: 12 }}>
        {LINKS.map((l) => {
          const active = loc.pathname === l.to || loc.pathname.startsWith(l.to + '/')
          return (
            <Link
              key={l.to} to={l.to}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', fontSize: 13, textDecoration: 'none',
                borderRadius: 'var(--radius-pill)',
                color: active ? 'var(--sage-dim)' : 'var(--slate)',
                background: active ? 'var(--sage-light)' : 'transparent',
                fontWeight: active ? 500 : 400,
                transition: 'all 0.15s',
              }}
            >
              <l.icon size={13} />
              {l.label}
            </Link>
          )
        })}
      </nav>

      {isDemo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            background: 'var(--accent-education)', color: 'var(--white)',
            padding: '3px 10px', borderRadius: 'var(--radius-pill)',
            fontSize: 11, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase',
          }}>Demo</span>
          <button onClick={exitDemo} style={{
            background: 'transparent', color: 'var(--slate)', border: '1px solid var(--border)',
            padding: '4px 10px', borderRadius: 'var(--radius-btn)', fontSize: 12, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <LogOut size={11} /> Exit
          </button>
        </div>
      ) : (
        <Link to="/" style={{ color: 'var(--slate-mid)', fontSize: 12, textDecoration: 'none' }}>
          ← Tech Vista
        </Link>
      )}
    </motion.header>
  )
}
