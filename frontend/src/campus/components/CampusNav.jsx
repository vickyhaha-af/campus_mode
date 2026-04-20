import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Users, Briefcase, MessageSquareText, UploadCloud, LogOut, GraduationCap } from 'lucide-react'

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
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'saturate(180%) blur(14px)',
        WebkitBackdropFilter: 'saturate(180%) blur(14px)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 24,
      }}
    >
      {/* Logo with gradient mark */}
      <Link to="/campus/pc" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <motion.div
          whileHover={{ rotate: -8, scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          style={{
            width: 32, height: 32,
            borderRadius: 9,
            background: 'var(--gradient-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(74,124,111,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          <GraduationCap size={17} color="#fff" strokeWidth={2.2} />
        </motion.div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 16, color: 'var(--ink)',
            letterSpacing: '-0.015em',
          }}>
            TechVista <span style={{ color: 'var(--sage-dim)', fontStyle: 'italic' }}>Campus</span>
          </div>
          {slug && (
            <div style={{
              fontSize: 10.5, color: 'var(--slate-mid)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              fontWeight: 600, marginTop: 2,
            }}>{slug}</div>
          )}
        </div>
      </Link>

      <nav style={{ display: 'flex', gap: 2, flex: 1, marginLeft: 12, position: 'relative' }}>
        {LINKS.map((l) => {
          const active = loc.pathname === l.to || loc.pathname.startsWith(l.to + '/')
          return (
            <Link
              key={l.to} to={l.to}
              style={{
                position: 'relative',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 14px',
                fontSize: 13, fontWeight: 500,
                textDecoration: 'none',
                color: active ? 'var(--sage-dim)' : 'var(--slate)',
                borderRadius: 10,
                transition: 'color 180ms',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--slate)' }}
            >
              {active && (
                <motion.span
                  layoutId="campusnav-active"
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'var(--sage-light)',
                    borderRadius: 10,
                    zIndex: -1,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <l.icon size={13} strokeWidth={2.2} />
              <span>{l.label}</span>
            </Link>
          )
        })}
      </nav>

      {isDemo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.span
            animate={{ opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(90deg, var(--accent-warm) 0%, var(--blush) 100%)',
              color: '#fff',
              padding: '4px 12px', borderRadius: 'var(--radius-pill)',
              fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
              boxShadow: '0 2px 6px rgba(199,138,62,0.3)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
            Demo
          </motion.span>
          <button
            onClick={exitDemo}
            className="btn-ghost"
            style={{ padding: '5px 10px', fontSize: 12 }}
          >
            <LogOut size={12} /> Exit
          </button>
        </div>
      ) : (
        <Link to="/" style={{
          color: 'var(--slate-mid)', fontSize: 12, textDecoration: 'none',
          padding: '6px 10px', borderRadius: 8,
          transition: 'color 180ms, background 180ms',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--cream-mid)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--slate-mid)'; e.currentTarget.style.background = 'transparent' }}
        >
          ← Tech Vista
        </Link>
      )}
    </motion.header>
  )
}
