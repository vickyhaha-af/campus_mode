import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Users, Briefcase, MessageSquareText, UploadCloud,
  LogOut, GraduationCap, Menu, X, ShieldCheck,
} from 'lucide-react'
import DarkModeToggle from './DarkModeToggle'

const LINKS = [
  { to: '/campus/pc',       icon: Home,              label: 'Dashboard' },
  { to: '/campus/students', icon: Users,             label: 'Students'  },
  { to: '/campus/drives',   icon: Briefcase,         label: 'Drives'    },
  { to: '/campus/ingest',   icon: UploadCloud,       label: 'Ingest'    },
  { to: '/campus/chat',     icon: MessageSquareText, label: 'Chat'      },
  { to: '/campus/audit',    icon: ShieldCheck,       label: 'Audit'     },
]

// Breakpoints: <768 mobile (hamburger), 768-1023 tablet (icons only), >=1024 desktop (full)
function useViewport() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return {
    width: w,
    isMobile: w < 768,
    isTablet: w >= 768 && w < 1024,
    isDesktop: w >= 1024,
  }
}

export default function CampusNav() {
  const loc = useLocation()
  const nav = useNavigate()
  const { isMobile, isTablet } = useViewport()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isDemo = typeof window !== 'undefined' && localStorage.getItem('campus_demo_mode') === '1'
  const slug = typeof window !== 'undefined' ? localStorage.getItem('campus_college_slug') : ''

  const exitDemo = () => {
    localStorage.removeItem('campus_demo_mode')
    localStorage.removeItem('campus_college_id')
    localStorage.removeItem('campus_college_slug')
    setDrawerOpen(false)
    nav('/campus')
  }

  // Close drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false) }, [loc.pathname])

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (drawerOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [drawerOpen])

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--nav-bg, rgba(255,255,255,0.78))',
        backdropFilter: 'saturate(180%) blur(14px)',
        WebkitBackdropFilter: 'saturate(180%) blur(14px)',
        borderBottom: '1px solid var(--border)',
        padding: isMobile ? '10px 16px' : '12px 24px',
        display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 24,
      }}
    >
      {/* Logo */}
      <Link to="/campus/pc" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}>
        <motion.div
          whileHover={{ rotate: -8, scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          style={{
            width: 32, height: 32,
            borderRadius: 9,
            background: 'var(--gradient-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(74,124,111,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
            flexShrink: 0,
          }}
        >
          <GraduationCap size={17} color="#fff" strokeWidth={2.2} />
        </motion.div>
        {!isMobile && (
          <div style={{ lineHeight: 1.1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 16, color: 'var(--ink)',
              letterSpacing: '-0.015em',
              whiteSpace: 'nowrap',
            }}>
              TechVista <span style={{ color: 'var(--sage-dim)', fontStyle: 'italic' }}>Campus</span>
            </div>
            {slug && (
              <div style={{
                fontSize: 10.5, color: 'var(--slate-mid)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 600, marginTop: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{slug}</div>
            )}
          </div>
        )}
      </Link>

      {/* Desktop / tablet nav links */}
      {!isMobile && (
        <nav style={{ display: 'flex', gap: 2, flex: 1, marginLeft: 12, position: 'relative' }}>
          {LINKS.map((l) => {
            const active = loc.pathname === l.to || loc.pathname.startsWith(l.to + '/')
            return (
              <Link
                key={l.to} to={l.to}
                title={l.label}
                style={{
                  position: 'relative',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: isTablet ? '8px 10px' : '8px 14px',
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
                {!isTablet && <span>{l.label}</span>}
              </Link>
            )
          })}
        </nav>
      )}

      {/* Spacer on mobile */}
      {isMobile && <div style={{ flex: 1 }} />}

      {/* Right-side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, flexShrink: 0 }}>
        <DarkModeToggle compact={isMobile || isTablet} />

        {!isMobile && (isDemo ? (
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
        ))}

        {isMobile && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            style={{
              width: 36, height: 36,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--white)',
              color: 'var(--slate)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Menu size={16} />
          </motion.button>
        )}
      </div>

      {/* Mobile slideover drawer */}
      <AnimatePresence>
        {isMobile && drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(26,32,44,0.55)',
                zIndex: 60,
              }}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: 'min(82vw, 320px)',
                background: 'var(--white)',
                borderLeft: '1px solid var(--border)',
                boxShadow: 'var(--shadow-xl)',
                zIndex: 61,
                display: 'flex', flexDirection: 'column',
                padding: 16,
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 18, paddingBottom: 14,
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                  color: 'var(--ink)',
                }}>
                  Menu
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--white)',
                    color: 'var(--slate)',
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {LINKS.map((l) => {
                  const active = loc.pathname === l.to || loc.pathname.startsWith(l.to + '/')
                  return (
                    <Link
                      key={l.to} to={l.to}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        fontSize: 14, fontWeight: 500,
                        color: active ? 'var(--sage-dim)' : 'var(--ink-soft)',
                        background: active ? 'var(--sage-light)' : 'transparent',
                      }}
                    >
                      <l.icon size={15} strokeWidth={2.1} />
                      {l.label}
                    </Link>
                  )
                })}
              </nav>

              <div style={{ flex: 1 }} />

              <div style={{
                paddingTop: 14,
                borderTop: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {isDemo ? (
                  <>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'linear-gradient(90deg, var(--accent-warm) 0%, var(--blush) 100%)',
                      color: '#fff',
                      padding: '6px 12px', borderRadius: 'var(--radius-pill)',
                      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                      alignSelf: 'flex-start',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                      Demo mode
                    </div>
                    <button onClick={exitDemo} className="btn-ghost" style={{ justifyContent: 'flex-start' }}>
                      <LogOut size={13} /> Exit demo
                    </button>
                  </>
                ) : (
                  <Link to="/" style={{
                    color: 'var(--slate)',
                    fontSize: 13,
                    textDecoration: 'none',
                    padding: '10px 4px',
                  }}>
                    ← Back to Tech Vista
                  </Link>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
