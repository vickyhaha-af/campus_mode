import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, Shield, BarChart3, Target, Play, Zap, Scale, ArrowUpRight, CheckCircle,
  GraduationCap,
} from 'lucide-react'
import MagneticButton from '../components/MagneticButton'
import SpotlightCard from '../components/SpotlightCard'
import NumberTicker from '../components/NumberTicker'
import StaggeredText from '../components/StaggeredText'

/* ─── Data ───────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Zap, title: 'Semantic AI Scoring', desc: 'Gemini embeddings rank by meaning, not keywords — across Skills, Experience, and Education.', large: true },
  { icon: Shield, title: 'Statistical Bias Audit', desc: 'Mann-Whitney U & Kruskal-Wallis tests detect institution-tier and experience-cohort bias.', large: false },
  { icon: Target, title: 'Skill Gap Analysis', desc: 'Per-candidate breakdown of matched, adjacent, and missing JD requirements.', large: false },
  { icon: BarChart3, title: 'Explainable AI', desc: 'Every score has a plain-English rationale from Gemini Flash — no black-box decisions.', large: true },
  { icon: Scale, title: 'HR-in-the-Loop Weights', desc: 'Adjust Skills / Experience / Education weighting in real-time.', large: false },
  { icon: ArrowRight, title: 'DPDPA-Compliant Exports', desc: 'PDF reports and CSV exports strip raw resume text — data minimisation built in.', large: false },
]

const STEPS = [
  { n: '01', title: 'Upload JD + Resumes', desc: 'Paste or upload any PDF / DOCX. Up to 50 resumes at once.' },
  { n: '02', title: 'AI Analyses & Scores', desc: 'Gemini parses, embeds, and ranks all candidates in ~60 seconds.' },
  { n: '03', title: 'Bias Audit Runs', desc: 'Statistical tests detect systemic bias and normalize if flagged.' },
  { n: '04', title: 'Export & Share', desc: 'Download a branded PDF report or CSV.' },
]

const BADGES = ['No signup required', 'Works in your browser', 'Results in <90s', 'DPDPA 2023 Compliant']

/* ─── Main Component ────────────────────────────────────────── */
export default function LandingPage({ onStart }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div style={{ background: 'var(--cream)', color: 'var(--slate)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 1000,
        background: scrolled ? 'rgba(250, 248, 244, 0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        display: 'flex', alignItems: 'center', padding: '0 48px',
        justifyContent: 'space-between',
        transition: 'all 300ms ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--sage)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: '#fff',
            boxShadow: '0 2px 8px rgba(74,124,111,0.25)',
          }}>TV</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Tech Vista
          </span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--slate-light)',
            marginLeft: 2, letterSpacing: '0.02em'
          }}>by M S Vikram</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/campus" style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--sage-dim)',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            background: 'var(--sage-light)', border: '1px solid var(--sage-pale)',
            fontWeight: 500, transition: 'all 150ms',
          }} onMouseOver={e => { e.currentTarget.style.background = 'var(--sage)'; e.currentTarget.style.color = 'var(--white)' }}
             onMouseOut={e => { e.currentTarget.style.background = 'var(--sage-light)'; e.currentTarget.style.color = 'var(--sage-dim)' }}>
            <GraduationCap size={13} /> Campus Mode <ArrowUpRight size={11} />
          </Link>
          <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/docs`} target="_blank" rel="noopener noreferrer" style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-mid)',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 8, transition: 'color 150ms'
          }} onMouseOver={e => e.currentTarget.style.color = 'var(--ink)'} onMouseOut={e => e.currentTarget.style.color = 'var(--slate-mid)'}>
            API Docs <ArrowUpRight size={12} />
          </a>
          <MagneticButton className="btn-primary" onClick={onStart}>
            Get Started <ArrowRight size={14} />
          </MagneticButton>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden' }}>

        {/* Subtle mesh grid for texture */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          opacity: 0.3,
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 80%)'
        }} />

        {/* Elegant soft blurred blobs - VERY light */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <motion.div animate={{ x: [0, 50, 20, 0], y: [0, 40, 80, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', width: '50vw', height: '50vw', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.4, background: 'var(--sage-pale)', top: '-10%', left: '-5%' }} />
          <motion.div animate={{ x: [0, -40, -20, 0], y: [0, 60, 20, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            style={{ position: 'absolute', width: '40vw', height: '40vw', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.5, background: 'var(--blush-pale)', top: '10%', right: '-5%' }} />
        </div>

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 880, padding: '0 24px', paddingTop: 60 }}>

          {/* Badge row */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--white)', border: '1px solid var(--border)',
              borderRadius: 999, padding: '6px 16px',
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11,
              color: 'var(--sage)', letterSpacing: '0.08em', textTransform: 'uppercase',
              boxShadow: 'var(--shadow-card)'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)' }} />
              Powered by Gemini Flash · DPDPA Compliant
            </div>
          </motion.div>

          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(46px, 6.5vw, 84px)',
            lineHeight: 1.05, letterSpacing: '-0.03em',
            marginBottom: 24, color: 'var(--ink)',
          }}>
            <StaggeredText initialDelay={0.2}>Resume screening that</StaggeredText>
            <br />
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              style={{ color: 'var(--sage)', fontStyle: 'italic' }}
            >
              audits its own bias.
            </motion.span>
          </h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 19, lineHeight: 1.6,
              color: 'var(--slate)', maxWidth: 640, margin: '0 auto 40px', fontWeight: 400
            }}
          >
            Upload a JD and up to 50 resumes. Gemini AI scores candidates
            semantically, while statistical tests flag bias before the shortlist leaves your desk.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}
          >
            <MagneticButton className="btn-primary" onClick={onStart} style={{ padding: '14px 32px', fontSize: 16 }} glow>
              Start Screening <ArrowRight size={18} />
            </MagneticButton>
            <MagneticButton className="btn-secondary" onClick={() => {
              window.dispatchEvent(new CustomEvent('load-demo'))
              onStart()
            }} style={{ padding: '14px 32px', fontSize: 16 }}>
              <Play size={16} /> See Demo Results
            </MagneticButton>
          </motion.div>

          {/* Campus Mode callout — different user, different workflow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.95 }}
            style={{ marginBottom: 40 }}
          >
            <Link to="/campus" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '10px 20px', borderRadius: 999,
                background: 'var(--cream-mid)', border: '1px dashed var(--sage)',
                fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--sage-dim)',
                transition: 'all 150ms', cursor: 'pointer',
              }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'var(--sage)'
                  e.currentTarget.style.color = 'var(--white)'
                  e.currentTarget.style.borderStyle = 'solid'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'var(--cream-mid)'
                  e.currentTarget.style.color = 'var(--sage-dim)'
                  e.currentTarget.style.borderStyle = 'dashed'
                }}>
                <GraduationCap size={16} />
                <span>
                  <strong>For college placement cells</strong> — try <strong>Campus Mode</strong>
                </span>
                <ArrowRight size={14} />
              </div>
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            {BADGES.map((b, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-mid)', fontWeight: 500
              }}>
                <CheckCircle size={14} color="var(--moss)" /> {b}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────── */}
      <section style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '48px',
        background: 'var(--white)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24
        }}>
          {[
            { to: 50, suffix: '+', label: 'Resumes per batch' },
            { to: 60, suffix: 's', label: 'Avg. processing time' },
            { to: 3, suffix: '', label: 'Scoring dimensions' },
            { to: 2, suffix: '', label: 'Bias audit tests' },
          ].map((s, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '8px 0',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 42,
                color: 'var(--ink)', lineHeight: 1, marginBottom: 8
              }}>
                <NumberTicker value={s.to} suffix={s.suffix} />
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-mid)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section style={{ padding: '120px 48px', background: 'var(--cream-mid)' }}>
        <div className="page-container">
          <div className="section-label" style={{ textAlign: 'center', width: '100%', marginBottom: 16 }}>HOW IT WORKS</div>
          <h2 className="text-h1" style={{ textAlign: 'center', marginBottom: 80 }}>
            From upload to shortlist <span style={{ color: 'var(--slate-light)', fontStyle: 'italic' }}>in four steps</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, position: 'relative' }}>
            {/* Connector line */}
            <div style={{
              position: 'absolute', top: 28, left: '12.5%', right: '12.5%', height: 2,
              background: 'linear-gradient(90deg, transparent, var(--border), var(--border), transparent)',
            }} />
            
            {STEPS.map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                style={{ padding: '0 16px', textAlign: 'center', position: 'relative', zIndex: 1 }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 24px',
                  background: 'var(--white)', border: '2px solid var(--sage)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--sage)',
                  boxShadow: 'var(--shadow-elevated)'
                }}>{s.n}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 12 }}>{s.title}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>{s.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features — Glassmorphism Bento ───────────────────── */}
      <section style={{
        padding: '120px 48px',
        background: 'var(--cream-deep)',
      }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div className="section-label" style={{ textAlign: 'center', marginBottom: 16 }}>FEATURES</div>
          <h2 className="text-h1" style={{ textAlign: 'center', marginBottom: 64 }}>
            Everything a fair hiring team needs
          </h2>

          {/* Bento grid using SpotlightCards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 }}>
            
            {/* Large card 7 cols */}
            <SpotlightCard style={{ gridColumn: 'span 7', padding: 40 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12,
                background: 'var(--sage-light)', border: '1px solid rgba(74,124,111,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--sage)', marginBottom: 24
              }}><Zap size={24} /></div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Semantic AI Scoring</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--slate)', lineHeight: 1.65 }}>
                Gemini <code style={{ background: 'var(--sage-light)', color: 'var(--sage)', borderRadius: 4, padding: '2px 6px', fontSize: 13 }}>text-embedding-004</code> ranks candidates by semantic meaning — not keyword frequency — across Skills, Experience and Education dimensions.
              </div>
            </SpotlightCard>

            {/* Medium 5 cols */}
            <SpotlightCard style={{ gridColumn: 'span 5', padding: 32 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--sage-light)', border: '1px solid rgba(74,124,111,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sage)', marginBottom: 20 }}><Shield size={22} /></div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', marginBottom: 10 }}>Statistical Bias Audit</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>Mann-Whitney U & Kruskal-Wallis tests detect institution-tier and experience-cohort bias. Scores are normalized if flagged.</div>
            </SpotlightCard>

            {/* Medium 5 cols */}
            <SpotlightCard style={{ gridColumn: 'span 5', padding: 32 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--sage-light)', border: '1px solid rgba(74,124,111,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sage)', marginBottom: 20 }}><Target size={22} /></div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', marginBottom: 10 }}>Skill Gap Analysis</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>Per-candidate matched, adjacent, and missing skill breakdown with AI reasoning — instantly visible.</div>
            </SpotlightCard>

            {/* Large 7 cols */}
            <SpotlightCard style={{ gridColumn: 'span 7', padding: 40 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--sage-light)', border: '1px solid rgba(74,124,111,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sage)', marginBottom: 24 }}><BarChart3 size={24} /></div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Explainable AI</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--slate)', lineHeight: 1.65 }}>Gemini Flash generates plain-English rationale for every score decision. Every hire/reject recommendation is backed by a human-readable explanation, not just a number.</div>
            </SpotlightCard>

            {/* Small 6 cols */}
            <SpotlightCard style={{ gridColumn: 'span 6', padding: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--sage-light)', border: '1px solid rgba(74,124,111,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sage)', marginBottom: 16 }}><Scale size={20} /></div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>HR-in-the-Loop Weights</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>Adjust dimension weights in real-time. Scores recalculate server-side instantly.</div>
            </SpotlightCard>

            <SpotlightCard style={{ gridColumn: 'span 6', padding: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--sage-light)', border: '1px solid rgba(74,124,111,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sage)', marginBottom: 16 }}><ArrowRight size={20} /></div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>DPDPA-Compliant Exports</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>PDF & CSV exports strip raw resume text. Data minimization is enforced, not optional.</div>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section style={{
        padding: '120px 48px',
        textAlign: 'center',
        background: 'var(--white)',
        borderTop: '1px solid var(--border)',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Subtle blur behind CTA */}
        <div style={{ 
          position: 'absolute', bottom: -150, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300, background: 'var(--sage-pale)', filter: 'blur(100px)', borderRadius: '50%'
        }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div className="section-label" style={{ marginBottom: 20 }}>GET STARTED</div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52,
            color: 'var(--ink)', marginBottom: 20, lineHeight: 1.1, letterSpacing: '-0.02em',
          }}>
            Screen smarter.<br />
            <span style={{ color: 'var(--slate-light)', fontStyle: 'italic' }}>Ship fair shortlists.</span>
          </h2>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--slate)',
            marginBottom: 48, fontWeight: 400
          }}>No signup. No credit card. In your browser in 30 seconds.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <MagneticButton className="btn-primary" onClick={onStart} style={{ padding: '14px 32px', fontSize: 16 }} glow>
              Start Free Screening <ArrowRight size={18} />
            </MagneticButton>
            <MagneticButton className="btn-secondary" onClick={() => {
              window.dispatchEvent(new CustomEvent('load-demo'))
              onStart()
            }} style={{ padding: '14px 32px', fontSize: 16 }}>
              <Play size={16} /> View Demo Results
            </MagneticButton>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '32px 48px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--cream)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 24, height: 24, borderRadius: 6, 
            background: 'var(--sage)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: '#fff' 
          }}>TV</div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-mid)', fontWeight: 500 }}>
            Tech Vista · Built by M S Vikram · Bias-Aware AI Resume Screening
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--slate-light)' }}>
          v2.0.0 · Gemini Flash 2.0 + text-embedding-004
        </span>
      </footer>
    </div>
  )
}
