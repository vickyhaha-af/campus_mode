import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles, Loader, Mail, Link as LinkIcon, Calendar } from 'lucide-react'
import { draftEmail } from '../api'
import campus from '../api'
import { useToast } from './Toast'


const TYPE_LABELS = {
  interview_invite: 'Interview invite',
  shortlist_notify: 'Shortlist notification',
  offer: 'Offer letter',
  rejection: 'Rejection (polite)',
  custom: 'Custom',
}


/**
 * Compose and send an email to a shortlisted student. LLM-drafts the subject +
 * body, then lets the PC review + edit + add meeting link + send.
 *
 * Props:
 *   driveId (str)
 *   studentId (str)
 *   studentName (str) — for display
 *   type (str) — optional initial type; defaults to interview_invite
 *   onClose (fn)
 *   onSent (fn, optional) — called after successful send
 */
export default function EmailDraftModal({ driveId, studentId, studentName, type = 'interview_invite', onClose, onSent }) {
  const toast = useToast()
  const [emailType, setEmailType] = useState(type)
  const [tone, setTone] = useState('professional')
  const [slotText, setSlotText] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  const handleDraft = async () => {
    setDrafting(true); setErr('')
    try {
      const { data } = await draftEmail({
        drive_id: driveId,
        student_id: studentId,
        type: emailType,
        tone,
        slot_text: slotText || null,
        custom_instructions: customInstructions || null,
      })
      setSubject(data.subject)
      setBody(data.body)
      toast.success('Draft ready — review and edit before sending')
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Drafting failed'
      setErr(msg); toast.error(msg)
    } finally {
      setDrafting(false)
    }
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setErr('Subject and body can\'t be empty'); return }
    setSending(true); setErr('')
    try {
      await campus.post('/communications/send', {
        drive_id: driveId,
        student_id: studentId,
        type: emailType,
        subject: subject.trim(),
        body: body.trim(),
        meeting_link: meetingLink.trim() || null,
      })
      toast.success(`Email sent to ${studentName || 'student'}`)
      onSent?.()
      onClose?.()
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Send failed'
      setErr(msg); toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 20, 30, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)', borderRadius: 16,
          padding: 26, maxWidth: 620, width: '100%', maxHeight: '92vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div className="text-eyebrow" style={{ color: 'var(--sage)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Mail size={11} /> Compose
            </div>
            <h2 className="text-display" style={{ fontSize: 24, marginTop: 6 }}>
              Email to {studentName || 'student'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--slate-mid)', padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <Field label="Type">
            <select value={emailType} onChange={(e) => setEmailType(e.target.value)} style={inputStyle}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Tone">
            <select value={tone} onChange={(e) => setTone(e.target.value)} style={inputStyle}>
              <option value="professional">Professional</option>
              <option value="warm">Warm</option>
              <option value="formal">Formal</option>
            </select>
          </Field>
        </div>

        {emailType === 'interview_invite' && (
          <Field label="Interview slot (optional)">
            <div style={{ position: 'relative' }}>
              <Calendar size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-mid)' }} />
              <input value={slotText} onChange={(e) => setSlotText(e.target.value)} placeholder="e.g. Friday 2 pm IST"
                style={{ ...inputStyle, paddingLeft: 30 }} />
            </div>
          </Field>
        )}

        <Field label="Extra instructions for the drafter (optional)">
          <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. mention that HR round is before technical"
            rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={handleDraft} disabled={drafting} style={secondaryBtn}>
            {drafting
              ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</>
              : <><Sparkles size={13} /> {subject ? 'Redraft' : 'Draft with AI'}</>}
          </button>
        </div>

        {/* Subject + body — editable */}
        <Field label="Subject">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" style={inputStyle} />
        </Field>
        <Field label="Body">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
            placeholder={drafting ? 'Generating draft…' : 'Click "Draft with AI" to let Groq write a first pass, then edit.'}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
        </Field>

        {body.includes('{{meeting_link}}') && (
          <Field label="Meeting link (replaces {{meeting_link}})">
            <div style={{ position: 'relative' }}>
              <LinkIcon size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-mid)' }} />
              <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..."
                style={{ ...inputStyle, paddingLeft: 30 }} />
            </div>
          </Field>
        )}

        {err && (
          <div style={{ background: 'var(--blush-light)', color: 'var(--blush)', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()} style={primaryBtn}>
            {sending
              ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
              : <><Send size={13} /> Send email</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}


function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--slate-mid)', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  )
}


const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 13.5,
  color: 'var(--ink)',
  background: 'var(--cream)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
}
const primaryBtn = { background: 'var(--sage)', color: 'var(--white)', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
const secondaryBtn = { background: 'var(--sage-light)', color: 'var(--sage-dim)', border: '1px solid var(--sage)', padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
const ghostBtn = { background: 'transparent', color: 'var(--slate)', border: '1px solid var(--border)', padding: '9px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
