import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, UserPlus, Trash2, ArrowRight } from 'lucide-react'
import {
  listShortlists, listStudents, bulkShortlist, changeShortlistStage, removeShortlist,
} from '../api'
import { useToast } from './Toast'
import EmailDraftModal from './EmailDraftModal'
import { Mail } from 'lucide-react'


const STAGE_ORDER = [
  'shortlisted', 'interview_1', 'interview_2', 'interview_3',
  'offered', 'accepted', 'joined',
]
const STAGE_LABEL = {
  shortlisted: 'Shortlisted', interview_1: 'Interview 1', interview_2: 'Interview 2',
  interview_3: 'Interview 3', offered: 'Offered', accepted: 'Accepted', joined: 'Joined',
  rejected: 'Rejected', withdrawn: 'Withdrawn',
}


export default function DriveShortlist({ drive }) {
  const [shortlists, setShortlists] = useState([])
  const [students, setStudents] = useState([])
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [emailingSl, setEmailingSl] = useState(null)  // shortlist row to email
  const toast = useToast()
  const collegeId = drive?.college_id

  const refresh = async () => {
    if (!drive?.id) return
    try {
      const { data } = await listShortlists(drive.id)
      setShortlists(data || [])
    } catch (e) {
      setErr(e.response?.data?.detail || e.message)
    }
  }

  useEffect(() => { refresh() }, [drive?.id])

  const loadEligibleStudents = async () => {
    if (!collegeId) return
    setAdding(true); setErr('')
    try {
      const { data } = await listStudents({ college_id: collegeId, placed_status: 'unplaced', limit: 500 })
      // Apply drive eligibility rules
      const rules = drive.eligibility_rules || {}
      const filtered = (data || []).filter((s) => {
        if (rules.min_cgpa != null && (s.cgpa || 0) < rules.min_cgpa) return false
        if (rules.max_active_backlogs != null && (s.backlogs_active || 0) > rules.max_active_backlogs) return false
        if (rules.allowed_branches?.length && !rules.allowed_branches.includes(s.branch)) return false
        if (rules.allowed_years?.length && !rules.allowed_years.includes(s.year)) return false
        if (rules.gender_restriction && (s.gender || '').toLowerCase() !== rules.gender_restriction.toLowerCase()) return false
        // Exclude already shortlisted
        if (shortlists.some((sl) => sl.student_id === s.id)) return false
        return true
      })
      setStudents(filtered)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message)
    }
  }

  const addStudent = async (studentId) => {
    setBusyId(studentId)
    try {
      await bulkShortlist(drive.id, [studentId])
      setStudents((cur) => cur.filter((s) => s.id !== studentId))
      toast.success('Student added to shortlist')
      refresh()
    } catch (e) {
      setErr(e.response?.data?.detail || e.message)
    } finally {
      setBusyId(null)
    }
  }

  const moveStage = async (slId, nextStage) => {
    setBusyId(slId)
    try {
      await changeShortlistStage(slId, nextStage)
      toast.success(`Moved to ${nextStage.replace('_', ' ')}`)
      refresh()
    } catch (e) {
      setErr(e.response?.data?.detail || e.message)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (slId) => {
    if (!confirm('Remove from shortlist?')) return
    setBusyId(slId)
    try {
      await removeShortlist(slId)
      toast.info('Removed from shortlist')
      refresh()
    } catch (e) {
      setErr(e.response?.data?.detail || e.message)
    } finally {
      setBusyId(null)
    }
  }

  // Group by stage for Kanban
  const byStage = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = shortlists.filter((s) => s.stage === stage)
    return acc
  }, {})

  const hasAny = shortlists.length > 0
  const totalActive = shortlists.filter((s) => !['rejected', 'withdrawn'].includes(s.stage)).length

  return (
    <div>
      {err && <div style={{ background: 'var(--blush-light)', color: 'var(--blush)', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ color: 'var(--slate)', fontSize: 13 }}>
          {hasAny
            ? `${totalActive} active · ${shortlists.length - totalActive} closed`
            : 'No students shortlisted yet.'}
        </div>
        <button onClick={loadEligibleStudents} style={primary}>
          <UserPlus size={13} /> Add eligible students
        </button>
      </div>

      {/* Kanban lanes */}
      {hasAny && (
        <div className="campus-kanban-lanes" style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGE_ORDER.length}, minmax(170px, 1fr))`, gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {STAGE_ORDER.map((stage, idx) => (
            <div key={stage} style={lane}>
              <div style={laneHeader}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--slate-mid)' }}>
                  {STAGE_LABEL[stage]}
                </span>
                <span style={{ fontSize: 11, color: 'var(--slate-mid)' }}>{byStage[stage].length}</span>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 60 }}>
                <AnimatePresence>
                  {byStage[stage].map((sl) => (
                    <motion.div
                      key={sl.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      style={card(busyId === sl.id)}
                    >
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--ink)' }}>
                        {sl._student?.name || sl.student_id.slice(0, 8)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--slate-mid)' }}>
                        {sl._student?.branch || '—'} · CGPA {sl._student?.cgpa || '—'}
                        {sl.fit_score && ` · fit ${sl.fit_score}`}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        {idx < STAGE_ORDER.length - 1 && (
                          <button
                            onClick={() => moveStage(sl.id, STAGE_ORDER[idx + 1])}
                            title={`→ ${STAGE_LABEL[STAGE_ORDER[idx + 1]]}`}
                            style={smallBtn('var(--sage)')}
                          >
                            <ArrowRight size={11} />
                          </button>
                        )}
                        <button
                          onClick={() => moveStage(sl.id, 'rejected')}
                          title="Reject"
                          style={smallBtn('var(--blush)')}
                        >
                          ×
                        </button>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setEmailingSl(sl)} title="Email student" style={smallBtn('var(--accent-experience)')}>
                          <Mail size={10} />
                        </button>
                        <button onClick={() => remove(sl.id)} title="Remove"
                          style={smallBtn('var(--slate-light)')}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Closed lanes (collapsed count only) */}
      {hasAny && shortlists.some((s) => ['rejected', 'withdrawn'].includes(s.stage)) && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--slate-mid)' }}>
          {shortlists.filter((s) => s.stage === 'rejected').length} rejected ·{' '}
          {shortlists.filter((s) => s.stage === 'withdrawn').length} withdrawn
        </div>
      )}

      {/* Add-students tray */}
      {adding && students.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 20, background: 'var(--cream-mid)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14 }}
        >
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500, marginBottom: 10 }}>
            {students.length} eligible student(s) not yet shortlisted
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
            {students.map((s) => (
              <div key={s.id} style={eligCard}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--slate-mid)' }}>
                    {s.branch} · CGPA {s.cgpa}
                  </div>
                </div>
                <button onClick={() => addStudent(s.id)} disabled={busyId === s.id}
                  style={{ ...smallBtn('var(--sage)'), padding: '4px 8px' }}>
                  {busyId === s.id ? '…' : <UserPlus size={11} />}
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => { setAdding(false); setStudents([]) }}
            style={{ ...secondary, marginTop: 10 }}>Close</button>
        </motion.div>
      )}
      <AnimatePresence>
        {emailingSl && (
          <EmailDraftModal
            driveId={emailingSl.drive_id}
            studentId={emailingSl.student_id}
            studentName={emailingSl._student?.name}
            onClose={() => setEmailingSl(null)}
            onSent={refresh}
          />
        )}
      </AnimatePresence>

      {adding && students.length === 0 && (
        <div style={{ marginTop: 20, padding: 12, background: 'var(--cream-mid)', borderRadius: 8, fontSize: 13, color: 'var(--slate-mid)' }}>
          No eligible students remaining (all either shortlisted or don&apos;t meet rules).
          <button onClick={() => setAdding(false)} style={{ ...secondary, marginLeft: 10 }}>Close</button>
        </div>
      )}
    </div>
  )
}

const lane = { background: 'var(--cream-mid)', borderRadius: 8 }
const laneHeader = { padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }
const card = (busy) => ({
  background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 6,
  padding: 10, opacity: busy ? 0.6 : 1,
})
const primary = { background: 'var(--sage)', color: 'var(--white)', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-btn)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
const secondary = { background: 'transparent', color: 'var(--slate)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 'var(--radius-btn)', fontSize: 12, cursor: 'pointer' }
const smallBtn = (color) => ({ background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 })
const eligCard = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 6, padding: 8, display: 'flex', alignItems: 'center', gap: 8 }
