import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, X, Loader, AlertTriangle, Mail, BookmarkPlus, UserX,
  ChevronDown, Link as LinkIcon,
} from 'lucide-react'
import { bulkShortlist, sendCommunication } from '../../api'

/**
 * ActionCard — inline confirmation UX for agent write proposals.
 *
 * Renders a preview of what the agent proposes to do (shortlist / interview
 * email / rejection email) and gates the actual write behind a "Confirm"
 * button. Cancel dismisses. On confirm, calls the appropriate API and
 * surfaces a success or error state.
 *
 * Props:
 *   toolName: 'propose_shortlist' | 'propose_interview_email' | 'propose_rejection_email'
 *   result:   the tool_result payload from the backend
 *   onToast:  optional (message, tone) => void — callers wire to a toast system
 */
export default function ActionCard({ toolName, result, onToast }) {
  const [state, setState] = useState('idle') // idle | running | done | cancelled | error
  const [err, setErr] = useState('')
  const [expandedDraftIdx, setExpandedDraftIdx] = useState(null)
  const [meetingLink, setMeetingLink] = useState('')

  if (!result || result.error) {
    return (
      <div style={errorBox}>
        <AlertTriangle size={14} /> {result?.error || 'Action failed'}
      </div>
    )
  }

  const isShortlist = toolName === 'propose_shortlist'
  const isInterview = toolName === 'propose_interview_email'
  const isRejection = toolName === 'propose_rejection_email'

  const meta = isShortlist
    ? { icon: BookmarkPlus, label: 'Proposed shortlist', color: 'var(--sage)', bg: 'var(--sage-light)' }
    : isInterview
    ? { icon: Mail, label: 'Interview invitations', color: 'var(--accent-experience)', bg: 'rgba(123,143,168,0.10)' }
    : { icon: UserX, label: 'Rejection emails', color: 'var(--accent-education)', bg: 'rgba(179,150,114,0.12)' }

  const Icon = meta.icon

  const onCancel = () => {
    setState('cancelled')
    onToast?.('Action cancelled', 'muted')
  }

  const onConfirm = async () => {
    setState('running')
    setErr('')
    try {
      if (isShortlist) {
        const driveId = result?.drive?.id
        const ids = (result.students || [])
          .filter((s) => s.eligible !== false)
          .map((s) => s.student_id)
          .filter(Boolean)
        if (!driveId || ids.length === 0) {
          throw new Error('No eligible students to shortlist')
        }
        const res = await bulkShortlist(driveId, ids)
        setState('done')
        onToast?.(`Added ${res.data?.created ?? ids.length} to shortlist`, 'success')
      } else if (isInterview || isRejection) {
        const driveId = result?.drive?.id
        const type = isInterview ? 'interview_invite' : 'rejection'
        const drafts = (result.drafts || []).filter((d) => d.body)
        if (!driveId || drafts.length === 0) {
          throw new Error('No drafts to send')
        }
        // Fire sequentially so a 500 on one doesn't tank all. Parallel would
        // be faster but for a PC confirming a handful of emails this is fine.
        let sent = 0
        for (const d of drafts) {
          try {
            await sendCommunication({
              drive_id: driveId,
              student_id: d.student_id,
              type,
              subject: d.subject || '',
              body: d.body || '',
              meeting_link: isInterview ? (meetingLink || null) : null,
            })
            sent += 1
          } catch (e) {
            console.warn('send failed for', d.student_id, e)
          }
        }
        setState('done')
        onToast?.(
          `Sent ${sent}/${drafts.length} ${isInterview ? 'interview invites' : 'rejection emails'}`,
          sent === drafts.length ? 'success' : 'warning',
        )
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Action failed'
      setErr(msg)
      setState('error')
      onToast?.(msg, 'error')
    }
  }

  return (
    <div style={{ paddingLeft: 40 }}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          background: meta.bg,
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 8,
            background: 'var(--white)', color: meta.color,
            border: '1px solid var(--border)',
          }}>
            <Icon size={14} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: meta.color,
            }}>
              {meta.label}
            </div>
            <div style={{
              fontSize: 13.5, color: 'var(--ink)', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {result?.drive?.role || 'Action'}{result?.drive?.company ? ` @ ${result.drive.company}` : ''}
            </div>
          </div>
          <StatusPill state={state} count={
            isShortlist
              ? (result?.eligible_count ?? (result?.students || []).length)
              : (result?.drafts || []).length
          } />
        </div>

        {/* body */}
        <div style={{ padding: '12px 16px' }}>
          {isShortlist && <ShortlistPreview result={result} />}
          {(isInterview || isRejection) && (
            <EmailDrafts
              drafts={result?.drafts || []}
              expandedIdx={expandedDraftIdx}
              setExpandedIdx={setExpandedDraftIdx}
            />
          )}

          {isInterview && state !== 'done' && state !== 'cancelled' && (
            <div style={{ marginTop: 12 }}>
              <label style={{
                display: 'block',
                fontSize: 11, fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--slate-mid)',
                marginBottom: 5,
              }}>
                Meeting link (substituted into {'{{meeting_link}}'})
              </label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--cream-mid)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 10px',
              }}>
                <LinkIcon size={12} color="var(--slate-mid)" />
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent', fontSize: 13,
                    fontFamily: 'var(--font-sans)', color: 'var(--ink)',
                  }}
                />
              </div>
            </div>
          )}

          {err && (
            <div style={errorBox}>
              <AlertTriangle size={12} /> {err}
            </div>
          )}
        </div>

        {/* footer */}
        <AnimatePresence initial={false}>
          {(state === 'idle' || state === 'running' || state === 'error') && (
            <motion.div
              key="footer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center',
                padding: '10px 16px 14px',
                borderTop: '1px solid var(--border)',
                background: 'var(--cream)',
              }}>
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onConfirm}
                  disabled={state === 'running'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    background: state === 'running' ? 'var(--cream-deep)' : 'var(--sage)',
                    color: state === 'running' ? 'var(--slate-light)' : 'var(--white)',
                    border: 'none',
                    borderRadius: 'var(--radius-btn)',
                    fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    cursor: state === 'running' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {state === 'running'
                    ? <><Loader size={13} className="cv-spin" /> Executing…</>
                    : <><CheckCircle2 size={13} /> Confirm and execute</>}
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onCancel}
                  disabled={state === 'running'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    background: 'var(--white)',
                    color: 'var(--slate)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-btn)',
                    fontSize: 13, fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    cursor: state === 'running' ? 'not-allowed' : 'pointer',
                  }}
                >
                  <X size={13} /> Cancel
                </motion.button>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--slate-mid)' }}>
                  This will {isShortlist
                    ? 'add students to the drive'
                    : 'mark the emails as sent'} once you confirm.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {state === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border)',
              background: 'var(--moss-light)',
              color: 'var(--moss)',
              fontSize: 12.5,
              display: 'flex', alignItems: 'center', gap: 6,
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={13} /> Done — action completed.
          </motion.div>
        )}
        {state === 'cancelled' && (
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--cream-mid)',
            color: 'var(--slate-mid)',
            fontSize: 12, fontStyle: 'italic',
          }}>
            Dismissed — no changes were made.
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ---------- preview pieces ----------

function ShortlistPreview({ result }) {
  const students = result?.students || []
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 8, fontSize: 12, color: 'var(--slate-mid)',
      }}>
        <Pill color="var(--moss)" bg="var(--moss-light)">
          {result?.eligible_count ?? 0} eligible
        </Pill>
        {(result?.ineligible_count ?? 0) > 0 && (
          <Pill color="var(--blush)" bg="var(--blush-light)">
            {result.ineligible_count} ineligible
          </Pill>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--slate-light)' }}>
          Only eligible students will be shortlisted.
        </span>
      </div>
      <div style={{ display: 'grid', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
        {students.map((s) => (
          <div
            key={s.student_id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px',
              background: s.eligible ? 'var(--cream-mid)' : 'var(--blush-light)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              opacity: s.eligible ? 1 : 0.75,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: s.eligible ? 'var(--moss)' : 'var(--blush)',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                {s.name || s.student_id}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--slate-mid)' }}>
                {[s.branch, s.year, s.cgpa != null ? `CGPA ${s.cgpa}` : null].filter(Boolean).join(' · ')}
                {s.top_role?.role && (
                  <> · top fit: {s.top_role.role}</>
                )}
              </div>
              {!s.eligible && s.violations?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--blush)', marginTop: 2 }}>
                  {s.violations.join('; ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmailDrafts({ drafts, expandedIdx, setExpandedIdx }) {
  return (
    <div style={{ display: 'grid', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
      {drafts.map((d, i) => {
        const open = expandedIdx === i
        return (
          <div key={d.student_id || i}
            style={{
              background: 'var(--cream-mid)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setExpandedIdx(open ? null : i)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Mail size={12} color="var(--slate-mid)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {d.name || d.student_id}
                </div>
                <div style={{
                  fontSize: 11.5, color: 'var(--slate-mid)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {d.subject || '(no subject)'}
                </div>
              </div>
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'inline-flex' }}
              >
                <ChevronDown size={13} color="var(--slate-mid)" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open && d.body && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <pre style={{
                    margin: 0,
                    padding: '10px 12px',
                    fontSize: 12.5, lineHeight: 1.5,
                    color: 'var(--slate)',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--white)',
                  }}>
                    {d.body}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

function StatusPill({ state, count }) {
  const palette = state === 'done'
    ? { bg: 'var(--moss-light)', color: 'var(--moss)' }
    : state === 'cancelled'
    ? { bg: 'var(--cream-mid)', color: 'var(--slate-mid)' }
    : state === 'error'
    ? { bg: 'var(--blush-light)', color: 'var(--blush)' }
    : { bg: 'var(--white)', color: 'var(--slate)' }
  const label = state === 'done' ? 'Done'
    : state === 'cancelled' ? 'Cancelled'
    : state === 'error' ? 'Error'
    : state === 'running' ? 'Running…'
    : `${count} pending`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px',
      background: palette.bg,
      color: palette.color,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  )
}

function Pill({ color, bg, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 'var(--radius-pill)',
      background: bg, color,
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

const errorBox = {
  marginTop: 8,
  background: 'var(--blush-light)',
  color: 'var(--blush)',
  padding: '8px 10px',
  borderRadius: 8,
  display: 'flex', gap: 6, alignItems: 'center',
  fontSize: 12,
  border: '1px solid rgba(196,117,106,0.25)',
}

export const PROPOSE_TOOLS = new Set([
  'propose_shortlist',
  'propose_interview_email',
  'propose_rejection_email',
])
