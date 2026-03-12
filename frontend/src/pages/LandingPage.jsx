import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, BarChart3, Target, Play, Zap, Scale } from 'lucide-react'

const FEATURES = [
  {
    icon: <Zap size={20} />,
    title: 'Semantic AI Scoring',
    desc: 'Gemini embeddings rank candidates by meaning, not keywords — across Skills, Experience, and Education.'
  },
  {
    icon: <Shield size={20} />,
    title: 'Statistical Bias Audit',
    desc: 'Mann-Whitney U & Kruskal-Wallis tests flag institution-tier and experience-cohort bias automatically.'
  },
  {
    icon: <Target size={20} />,
    title: 'Skill Gap Analysis',
    desc: 'See exactly which JD requirements each candidate meets, partially meets, or misses — at a glance.'
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'Explainable AI',
    desc: 'Every score has a plain-English explanation from Gemini Flash — no black-box decisions.'
  },
  {
    icon: <Scale size={20} />,
    title: 'HR-in-the-Loop Weights',
    desc: 'Adjust Skills / Experience / Education weighting in real-time. Scores recalculate instantly.'
  },
  {
    icon: <ArrowRight size={20} />,
    title: 'DPDPA-Compliant Exports',
    desc: 'PDF reports and CSV exports strip raw resume text — data minimisation built in.'
  },
]

const STEPS = [
  { n: '01', title: 'Upload JD + Resumes', desc: 'Paste or upload any PDF / DOCX. Up to 50 resumes at once.' },
  { n: '02', title: 'AI Analyses & Scores', desc: 'Gemini parses, embeds, and scores all candidates in ~60 seconds.' },
  { n: '03', title: 'Bias Audit Runs', desc: 'Statistical tests check for systemic bias. Scores are normalised if flagged.' },
  { n: '04', title: 'Export & Share', desc: 'Download a branded PDF report or CSV. Share with hiring managers.' },
]

function CountUp({ target, suffix = '' }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let start = 0
        const step = target / 40
        const interval = setInterval(() => {
          start = Math.min(start + step, target)
          setVal(Math.round(start))
          if (start >= target) clearInterval(interval)
        }, 30)
      }
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target])
  return <span ref={ref}>{val}{suffix}</span>
}

export default function LandingPage({ onStart }) {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 100,
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 48px',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: 'var(--sage)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: '#fff'
          }}>TV</div>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
            Tech Vista
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--slate-light)', marginLeft: 4 }}>
            by M S Vikram
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--slate-mid)', textDecoration: 'none' }}>
            API Docs
          </a>
          <button className="btn-primary" onClick={onStart} style={{ height: 36, fontSize: 13, padding: '0 18px' }}>
            Get Started <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: 140, paddingBottom: 100, textAlign: 'center', position: 'relative' }}>
        {/* Background gradient blobs */}
        <div style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 400, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(74,124,111,0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ position: 'relative' }}
        >
          <span style={{
            display: 'inline-block',
            background: 'var(--sage-light)', color: 'var(--sage)',
            borderRadius: 'var(--radius-pill)', padding: '5px 14px',
            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11,
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 24
          }}>
            Built for Indian Startups · DPDPA 2023 Compliant
          </span>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(36px, 5vw, 62px)',
            color: 'var(--ink)', lineHeight: 1.12,
            letterSpacing: '-1.5px', marginBottom: 20,
            maxWidth: 720, margin: '0 auto 20px'
          }}>
            Resume screening that<br />
            <span style={{ color: 'var(--sage)' }}>audits its own bias</span>
          </h1>

          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--slate)',
            lineHeight: 1.7, maxWidth: 520, margin: '0 auto 36px'
          }}>
            Upload a JD and up to 50 resumes. Gemini AI scores candidates
            semantically, then statistical tests flag bias before the shortlist leaves your desk.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={onStart}
              style={{ height: 48, fontSize: 15, padding: '0 28px', gap: 10 }}>
              Start Screening <ArrowRight size={16} />
            </button>
            <button className="btn-secondary" onClick={() => {
              window.dispatchEvent(new CustomEvent('load-demo'))
              onStart()
            }} style={{ height: 48, fontSize: 15, padding: '0 28px', gap: 10 }}>
              <Play size={14} /> Try Demo
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Stats strip ── */}
      <section style={{
        background: 'var(--white)', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)', padding: '36px 48px'
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0
        }}>
          {[
            { val: 50, suffix: '+', label: 'Resumes per batch' },
            { val: 60, suffix: 's', label: 'Avg. processing time' },
            { val: 3, suffix: ' dims', label: 'Scoring dimensions' },
            { val: 2, suffix: ' tests', label: 'Bias audit tests run' },
          ].map((s, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '8px 24px',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 36,
                color: 'var(--sage)', lineHeight: 1
              }}>
                <CountUp target={s.val} suffix={s.suffix} />
              </div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 13,
                color: 'var(--slate-mid)', marginTop: 6
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '80px 48px', maxWidth: 900, margin: '0 auto' }}>
        <div className="section-label" style={{ textAlign: 'center', marginBottom: 12 }}>HOW IT WORKS</div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32,
          color: 'var(--ink)', textAlign: 'center', marginBottom: 52
        }}>From upload to shortlist in four steps</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {STEPS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 28,
                color: 'var(--cream-deep)', marginBottom: 12
              }}>{s.n}</div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15,
                color: 'var(--ink)', marginBottom: 8
              }}>{s.title}</div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 13,
                color: 'var(--slate-mid)', lineHeight: 1.6
              }}>{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{
        background: 'var(--white)', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)', padding: '80px 48px'
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="section-label" style={{ textAlign: 'center', marginBottom: 12 }}>FEATURES</div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32,
            color: 'var(--ink)', textAlign: 'center', marginBottom: 52
          }}>Every feature a fair hiring team needs</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                style={{
                  background: 'var(--cream)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)', padding: 24
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'var(--sage-pale)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--sage)', marginBottom: 14
                }}>{f.icon}</div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15,
                  color: 'var(--ink)', marginBottom: 8
                }}>{f.title}</div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13,
                  color: 'var(--slate-mid)', lineHeight: 1.6
                }}>{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '100px 48px', textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36,
            color: 'var(--ink)', marginBottom: 16, lineHeight: 1.2
          }}>Ready to screen your next batch?</h2>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--slate-mid)',
            marginBottom: 32
          }}>No signup required. Works in your browser. Results in under 90 seconds.</p>
          <button className="btn-primary" onClick={onStart}
            style={{ height: 52, fontSize: 16, padding: '0 36px', gap: 10 }}>
            Start Screening <ArrowRight size={16} />
          </button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '24px 48px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--slate-light)' }}>
          Tech Vista · Bias-Aware AI Resume Screening · Built by M S Vikram
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate-light)' }}>
          v2.0.0 · Gemini Flash + Embedding API
        </span>
      </footer>
    </div>
  )
}
