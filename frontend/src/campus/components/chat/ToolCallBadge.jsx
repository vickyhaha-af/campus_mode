import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, BarChart3, FileText, CheckCircle, User, Sparkles, Wrench,
  ChevronDown, AlertTriangle,
} from 'lucide-react'

const TOOL_META = {
  search_students:     { icon: Search,      label: 'Searching students',   color: 'var(--sage)' },
  semantic_rank:       { icon: BarChart3,   label: 'Ranking candidates',   color: 'var(--accent-experience)' },
  fetch_drive:         { icon: FileText,    label: 'Loading drive',        color: 'var(--accent-education)' },
  check_eligibility:   { icon: CheckCircle, label: 'Checking eligibility', color: 'var(--moss)' },
  get_student_profile: { icon: User,        label: 'Fetching profile',     color: 'var(--slate)' },
  explain_fit:         { icon: Sparkles,    label: 'Analysing fit',        color: 'var(--sage-dim)' },
}

export default function ToolCallBadge({ name, args, result }) {
  const meta = TOOL_META[name] || { icon: Wrench, label: name, color: 'var(--slate)' }
  const Icon = meta.icon
  const [expanded, setExpanded] = useState(false)

  const done = result !== undefined && result !== null
  const hasResult = done && typeof result === 'object' && Object.keys(result).length > 0
  const isError = !!(result && result.error)
  const summary = done
    ? (isError ? `error: ${result.error}` : summariseToolResult(name, result))
    : null

  return (
    <div style={{ paddingLeft: 40 }}>
      <motion.button
        type="button"
        layout
        onClick={() => hasResult && setExpanded((v) => !v)}
        whileHover={hasResult ? { y: -1 } : {}}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px 6px 10px',
          background: isError ? 'var(--blush-light)' : 'var(--cream-mid)',
          border: `1px solid ${isError ? 'rgba(196,117,106,0.3)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-pill)',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          color: isError ? 'var(--blush)' : 'var(--ink-soft)',
          cursor: hasResult ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* shimmer overlay while running */}
        {!done && (
          <motion.span
            aria-hidden
            initial={{ x: '-100%' }}
            animate={{ x: '120%' }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: 0, width: '55%',
              background: 'linear-gradient(90deg, transparent, rgba(74,124,111,0.18), transparent)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Icon */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 20, borderRadius: '50%',
          background: done ? (isError ? 'rgba(196,117,106,0.14)' : 'var(--sage-light)') : 'var(--white)',
          border: `1px solid ${isError ? 'rgba(196,117,106,0.25)' : 'var(--border)'}`,
        }}>
          {!done ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-flex' }}
            >
              <Icon size={11} color={meta.color} />
            </motion.span>
          ) : isError ? (
            <AlertTriangle size={11} color="var(--blush)" />
          ) : (
            <CheckCircle size={11} color="var(--sage)" />
          )}
        </span>

        <span style={{ fontWeight: 500, position: 'relative', zIndex: 1 }}>
          {meta.label}
        </span>
        {summary && (
          <span style={{
            color: isError ? 'var(--blush)' : 'var(--slate-mid)',
            position: 'relative', zIndex: 1,
          }}>
            · {summary}
          </span>
        )}
        {!done && (
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ color: 'var(--slate-mid)', marginLeft: 2, position: 'relative', zIndex: 1 }}
          >
            running…
          </motion.span>
        )}
        {hasResult && (
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'inline-flex', marginLeft: 2, position: 'relative', zIndex: 1 }}
          >
            <ChevronDown size={12} color="var(--slate-mid)" />
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && hasResult && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {args && Object.keys(args).length > 0 && (
                <ExpandoBlock label="args" data={args} />
              )}
              <ExpandoBlock label="result" data={result} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ExpandoBlock({ label, data }) {
  return (
    <div style={{
      background: 'var(--cream-mid)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 10,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: 'var(--slate-mid)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>{label}</div>
      <pre style={{
        margin: 0,
        fontSize: 11, lineHeight: 1.5,
        color: 'var(--slate)',
        fontFamily: 'var(--font-mono)',
        overflowX: 'auto',
        maxHeight: 240,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

function summariseToolResult(name, r) {
  if (!r) return 'done'
  if (name === 'search_students' && r.count !== undefined) {
    const w = r.warnings?.length ? ' ⚠' : ''
    return `${r.count} match${r.count === 1 ? '' : 'es'}${w}`
  }
  if (name === 'semantic_rank' && Array.isArray(r.ranked)) {
    const top = r.ranked[0]
    const topName = top?.student?.name || '?'
    return `top fit: ${topName} (${top?.fit_score ?? '?'})`
  }
  if (name === 'fetch_drive' && r.role) return r.role
  if (name === 'check_eligibility') {
    return r.eligible ? 'eligible ✓' : `${r.violations?.length || 0} violation(s)`
  }
  if (name === 'get_student_profile' && r.name) return r.name
  if (name === 'explain_fit' && r.signals) {
    return `${r.signals.skill_overlap_with_jd?.length || 0} skill matches`
  }
  return 'done'
}

export { TOOL_META }
