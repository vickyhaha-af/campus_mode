import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, Award, ChevronDown, Sparkles, Target,
} from 'lucide-react'
import FitRing from './FitRing'
import SkillChip from './SkillChip'

/**
 * Rich candidate card used in chat responses.
 *
 * Props:
 *   candidate: {
 *     id?, name, branch?, year?, cgpa?, top_role?, fit_score, skills?: string[],
 *     rationale?: string,   // italicized quote beneath card
 *     warnings?: string[],
 *     signals?: {...}       // if explain_fit has been pulled in
 *   }
 *   index: position in the list (drives stagger animation)
 *   normalizedScore: fit_score normalized to 0-100 (caller handles scaling)
 */
export default function CandidateCard({ candidate, index = 0, normalizedScore }) {
  const [expanded, setExpanded] = useState(false)
  const {
    name, branch, year, cgpa, top_role, fit_score,
    skills = [], rationale, signals, warnings = [],
  } = candidate || {}

  const score100 = normalizedScore != null ? normalizedScore : Math.min(100, Number(fit_score) || 0)
  const hasDetail = !!(rationale || (signals && Object.keys(signals).length > 0) || warnings.length > 0)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, boxShadow: 'var(--shadow-elevated)' }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px',
        boxShadow: 'var(--shadow-card)',
        transition: 'box-shadow 0.2s',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Rank badge + ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--slate-mid)', letterSpacing: '0.08em',
          }}>
            #{index + 1}
          </span>
          <FitRing score={score100} displayValue={Math.round(Number(fit_score) || 0)} />
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline',
            gap: 10, flexWrap: 'wrap', marginBottom: 6,
          }}>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18, fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.2px',
              lineHeight: 1.2,
            }}>
              {name || 'Unknown candidate'}
            </h3>
            {top_role && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
                color: 'var(--accent-experience)',
                background: 'rgba(123,143,168,0.12)',
                border: '1px solid rgba(123,143,168,0.25)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                textTransform: 'uppercase',
              }}>
                <Target size={9} /> {top_role}
              </span>
            )}
          </div>

          {/* meta pills: branch / year / cgpa */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: skills.length ? 10 : 0 }}>
            {branch && <MetaPill icon={GraduationCap} value={branch} />}
            {year && <MetaPill value={yearLabel(year)} />}
            {cgpa != null && (
              <MetaPill
                icon={Award}
                value={`CGPA ${Number(cgpa).toFixed(cgpa % 1 === 0 ? 0 : 2)}`}
                highlight={cgpa >= 8.5}
              />
            )}
          </div>

          {/* Skills row */}
          {skills.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: rationale ? 10 : 0 }}>
              {skills.slice(0, 8).map((s, i) => (
                <SkillChip key={`${s}-${i}`} tone="match">{s}</SkillChip>
              ))}
              {skills.length > 8 && (
                <SkillChip tone="neutral">+{skills.length - 8} more</SkillChip>
              )}
            </div>
          )}

          {/* Rationale quote */}
          {rationale && (
            <blockquote style={{
              margin: 0,
              paddingLeft: 10,
              borderLeft: '2px solid var(--sage-light)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontStyle: 'italic',
              color: 'var(--slate)',
              lineHeight: 1.55,
            }}>
              {rationale}
            </blockquote>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {warnings.map((w, i) => (
                <span key={i} style={{
                  fontSize: 11, color: 'var(--blush)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  ⚠ {w}
                </span>
              ))}
            </div>
          )}

          {/* Expand button */}
          {hasDetail && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 10,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'transparent',
                border: 'none',
                padding: '2px 0',
                fontSize: 11.5, fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--sage)',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={11} /> {expanded ? 'Hide reasoning' : 'Explain fit'}
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'inline-flex' }}
              >
                <ChevronDown size={12} />
              </motion.span>
            </button>
          )}

          <AnimatePresence initial={false}>
            {expanded && signals && (
              <motion.div
                key="signals"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <SignalsPanel signals={signals} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  )
}

function MetaPill({ icon: Icon, value, highlight }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11.5,
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      color: highlight ? 'var(--moss)' : 'var(--slate)',
      background: highlight ? 'var(--moss-light)' : 'var(--cream-mid)',
      border: `1px solid ${highlight ? 'rgba(94,122,82,0.22)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-pill)',
      padding: '2px 9px',
    }}>
      {Icon && <Icon size={10} />}
      {value}
    </span>
  )
}

function SignalsPanel({ signals }) {
  const {
    top_role_fits,
    skill_overlap_with_jd,
    passion_alignment,
    personality_hints,
    achievement_weight,
    summary,
  } = signals || {}

  return (
    <div style={{
      marginTop: 12,
      padding: 12,
      background: 'var(--cream)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      display: 'grid', gap: 10,
    }}>
      {summary && (
        <p style={{
          fontSize: 13, lineHeight: 1.55,
          color: 'var(--ink-soft)',
          margin: 0,
        }}>
          {summary}
        </p>
      )}
      {Array.isArray(skill_overlap_with_jd) && skill_overlap_with_jd.length > 0 && (
        <SignalBlock label="Skill overlap">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {skill_overlap_with_jd.map((s, i) => (
              <SkillChip key={i} tone="match">{s}</SkillChip>
            ))}
          </div>
        </SignalBlock>
      )}
      {Array.isArray(top_role_fits) && top_role_fits.length > 0 && (
        <SignalBlock label="Top role fits">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {top_role_fits.map((r, i) => (
              <SkillChip key={i} tone="accent">
                {typeof r === 'string' ? r : `${r.role} · ${r.score ?? ''}`}
              </SkillChip>
            ))}
          </div>
        </SignalBlock>
      )}
      {passion_alignment && (
        <SignalBlock label="Passion alignment">
          <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>
            {typeof passion_alignment === 'string'
              ? passion_alignment
              : JSON.stringify(passion_alignment)}
          </span>
        </SignalBlock>
      )}
      {Array.isArray(personality_hints) && personality_hints.length > 0 && (
        <SignalBlock label="Personality">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {personality_hints.map((p, i) => (
              <SkillChip key={i} tone="neutral">{p}</SkillChip>
            ))}
          </div>
        </SignalBlock>
      )}
      {achievement_weight != null && (
        <SignalBlock label="Achievements">
          <span style={{
            fontSize: 12.5, fontFamily: 'var(--font-mono)',
            color: 'var(--slate)',
          }}>
            {typeof achievement_weight === 'number'
              ? achievement_weight.toFixed(2)
              : String(achievement_weight)}
          </span>
        </SignalBlock>
      )}
    </div>
  )
}

function SignalBlock({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: 'var(--slate-mid)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 5,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function yearLabel(y) {
  if (y == null) return ''
  const n = Number(y)
  if (!Number.isFinite(n)) return String(y)
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${n}${suffix} year`
}
