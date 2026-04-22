import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Plus, Clock, Loader, RefreshCw, PanelLeftClose,
} from 'lucide-react'
import { listChatSessions } from '../../api'

/**
 * HistorySidebar — left-rail of chat sessions.
 *
 * Props:
 *   collegeId:       string
 *   activeSessionId: string | null
 *   onSelect:        (sessionId) => void
 *   onNewChat:       () => void
 *   refreshKey:      any — bump to force a re-fetch (after sending a message)
 *   onClose:         () => void    (mobile only)
 */
export default function HistorySidebar({
  collegeId, activeSessionId, onSelect, onNewChat, refreshKey, onClose,
}) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!collegeId) return
    setLoading(true)
    setErr('')
    try {
      const res = await listChatSessions(collegeId, 50)
      setSessions(res.data || [])
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [collegeId])

  useEffect(() => { load() }, [load, refreshKey])

  return (
    <aside style={{
      width: '100%',
      height: '100%',
      background: 'var(--cream)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--white)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <MessageSquare size={14} color="var(--sage)" />
          <span style={{
            fontSize: 12.5, fontWeight: 600,
            color: 'var(--ink-soft)',
            letterSpacing: '0.04em',
          }}>
            Chats
          </span>
          <span style={{ flex: 1 }} />
          <IconButton
            Icon={RefreshCw}
            onClick={load}
            title="Refresh"
            spinning={loading}
          />
          {onClose && (
            <IconButton
              Icon={PanelLeftClose}
              onClick={onClose}
              title="Close sidebar"
            />
          )}
        </div>
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewChat}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px',
            background: 'var(--sage)',
            color: 'var(--white)',
            border: 'none',
            borderRadius: 'var(--radius-btn)',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} /> New chat
        </motion.button>
      </div>

      {/* Sessions list */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '8px 8px 20px',
      }}>
        {err && (
          <div style={{
            fontSize: 11.5, color: 'var(--blush)',
            background: 'var(--blush-light)',
            border: '1px solid rgba(196,117,106,0.25)',
            padding: '6px 8px', borderRadius: 8, margin: '4px 4px 8px',
          }}>
            {err}
          </div>
        )}
        {!loading && sessions.length === 0 && !err && (
          <div style={{
            fontSize: 12, color: 'var(--slate-mid)',
            padding: '14px 10px',
            textAlign: 'center',
          }}>
            No past chats yet. Your conversations appear here once you start one.
          </div>
        )}
        <AnimatePresence initial={false}>
          {sessions.map((s) => (
            <motion.button
              key={s.id}
              type="button"
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              onClick={() => onSelect?.(s.id)}
              whileHover={{ x: 2 }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 11px',
                marginBottom: 4,
                background: s.id === activeSessionId ? 'var(--sage-pale)' : 'transparent',
                border: `1px solid ${s.id === activeSessionId ? 'rgba(74,124,111,0.28)' : 'transparent'}`,
                borderRadius: 10,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                color: 'var(--ink)',
                transition: 'background 0.12s',
              }}
            >
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: 'var(--ink)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
              }}>
                {s.title || 'New chat'}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginTop: 4,
                fontSize: 10.5, color: 'var(--slate-mid)',
              }}>
                <Clock size={9} />
                <span>{formatRelative(s.last_active || s.created_at)}</span>
                <span style={{ flex: 1 }} />
                <span>{s.message_count} msg{s.message_count === 1 ? '' : 's'}</span>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  )
}

function IconButton({ Icon, onClick, title, spinning }) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={title}
      style={{
        width: 24, height: 24,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 6,
        cursor: 'pointer',
        color: 'var(--slate-mid)',
      }}
    >
      {spinning
        ? <Loader size={11} className="cv-spin" />
        : <Icon size={11} />}
    </motion.button>
  )
}

function formatRelative(iso) {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  const diff = (Date.now() - dt.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return dt.toLocaleDateString()
}
