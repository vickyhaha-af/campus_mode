/**
 * Campus login page.
 *
 * Thin wrapper over the parent app's `/api/auth/login` (Supabase Auth).
 * Stores the access token in localStorage under `techvista_token` — same
 * convention as the parent frontend + `frontend/src/campus/api.js` interceptor.
 *
 * On success, redirects to the `?return=<path>` query param if present,
 * otherwise `/campus/pc` (PC dashboard).
 */
import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, Loader2, GraduationCap, UserPlus } from 'lucide-react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function CampusLogin() {
  const nav = useNavigate()
  const loc = useLocation()

  // Flip to signup mode for self-serve account creation.
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Parse ?return= from query string for post-login redirect.
  const returnTo = (() => {
    try {
      const sp = new URLSearchParams(loc.search)
      const r = sp.get('return')
      if (r && r.startsWith('/campus')) return r
    } catch (_) { /* ignore */ }
    return '/campus/pc'
  })()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup'
      const body = mode === 'login'
        ? { email, password }
        : { email, password, full_name: fullName || email.split('@')[0] }
      const res = await axios.post(API_BASE + endpoint, body, { timeout: 30000 })
      const token = res.data?.session?.access_token
      const user = res.data?.user
      if (token) {
        localStorage.setItem('techvista_token', token)
        if (user) localStorage.setItem('techvista_user', JSON.stringify(user))
        nav(returnTo)
      } else if (mode === 'signup') {
        // Signup may require email verification (no session returned).
        setError('Account created. Check your email for verification, then sign in.')
        setMode('login')
      } else {
        setError('Login failed: no session token returned.')
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: 'var(--cream, #FAF7F2)',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%', maxWidth: 420,
          background: '#fff',
          border: '1px solid var(--border, #E8E3DA)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 10px 40px rgba(40,60,60,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--gradient-accent, linear-gradient(135deg,#4A7C6F,#6FA08F))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GraduationCap size={19} color="#fff" strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>
              TechVista Campus
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate-mid, #7A8592)', marginTop: 2 }}>
              {mode === 'login' ? 'Sign in to your placement cell' : 'Create a placement cell account'}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', marginBottom: 14,
            background: 'rgba(199, 64, 64, 0.08)',
            border: '1px solid rgba(199, 64, 64, 0.2)',
            borderRadius: 8,
            fontSize: 13, color: '#8A2A2A',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <div style={{ position: 'relative' }}>
              <UserPlus size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--slate-mid, #7A8592)' }} />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name (optional)"
                style={inputStyle}
              />
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--slate-mid, #7A8592)' }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              style={inputStyle}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--slate-mid, #7A8592)' }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '10px 14px',
              border: 'none', borderRadius: 10,
              background: 'var(--gradient-accent, linear-gradient(135deg,#4A7C6F,#6FA08F))',
              color: '#fff', fontWeight: 600, fontSize: 14,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <Loader2 size={15} className="animate-spin" />
              : <>{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></>
            }
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--slate-mid, #7A8592)' }}>
          {mode === 'login' ? (
            <>
              New to TechVista Campus?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError('') }}
                style={linkBtnStyle}
              >Create an account</button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError('') }}
                style={linkBtnStyle}
              >Sign in</button>
            </>
          )}
        </div>

        <div style={{
          marginTop: 20, paddingTop: 16,
          borderTop: '1px solid var(--border, #E8E3DA)',
          textAlign: 'center', fontSize: 12,
        }}>
          <Link to="/campus" style={{ color: 'var(--slate-mid, #7A8592)', textDecoration: 'none' }}>
            ← Back to landing
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px 10px 36px',
  border: '1px solid var(--border, #E8E3DA)',
  borderRadius: 10,
  fontSize: 14,
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
}

const linkBtnStyle = {
  background: 'none', border: 'none', padding: 0,
  color: 'var(--sage-dim, #4A7C6F)', cursor: 'pointer',
  fontWeight: 600, fontSize: 13,
}
