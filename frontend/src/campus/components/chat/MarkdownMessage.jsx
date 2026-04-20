import React from 'react'

/**
 * Lightweight, dependency-free Markdown renderer tuned for the bot's output.
 * Supports:
 *   - # / ## / ### / #### headings
 *   - **bold** and *italic* / _italic_
 *   - `inline code`
 *   - - and * bullets (single-level nesting via indent)
 *   - 1. 2. 3. ordered lists
 *   - > blockquotes
 *   - paragraphs separated by blank lines
 *   - horizontal rules (---)
 *
 * NOT a full Markdown spec — just what the bot emits.
 */
export default function MarkdownMessage({ source }) {
  if (!source) return null
  const blocks = parseBlocks(String(source))
  return (
    <div style={{
      fontSize: 14.5,
      lineHeight: 1.65,
      color: 'var(--ink-soft)',
      fontFamily: 'var(--font-sans)',
    }}>
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  )
}

// ---------- Block-level parsing ----------

function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Blank line => paragraph separator
    if (!trimmed) { i++; continue }

    // Horizontal rule
    if (/^(---+|\*\*\*+|___+)$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Heading
    const hMatch = trimmed.match(/^(#{1,4})\s+(.*)$/)
    if (hMatch) {
      blocks.push({ type: 'heading', level: hMatch[1].length, text: hMatch[2] })
      i++
      continue
    }

    // Blockquote (consecutive > lines)
    if (trimmed.startsWith('>')) {
      const buf = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ type: 'blockquote', text: buf.join('\n') })
      continue
    }

    // List (unordered or ordered). We collect consecutive list items,
    // including indented continuation/sub-lines.
    if (isListLine(line)) {
      const items = []
      const ordered = /^\s*\d+\.\s+/.test(line)
      while (i < lines.length && (isListLine(lines[i]) || isContinuation(lines[i], items.length > 0))) {
        const cur = lines[i]
        if (isListLine(cur)) {
          const indent = (cur.match(/^\s*/)?.[0].length) || 0
          const stripped = cur.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
          items.push({ indent, text: stripped, sub: [] })
        } else if (items.length > 0 && cur.trim()) {
          // continuation line — attach as sub-text to previous item
          items[items.length - 1].sub.push(cur.trim())
        }
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // Paragraph: collect until blank line or new block trigger
    const paraLines = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isListLine(lines[i]) &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !/^(---+|\*\*\*+|___+)$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') })
    }
  }

  return blocks
}

function isListLine(line) {
  return /^\s*(?:[-*+]|\d+\.)\s+/.test(line)
}

function isContinuation(line, hasPrev) {
  // An indented non-list line after a list item is treated as continuation.
  return hasPrev && /^\s{2,}\S/.test(line) && !isListLine(line)
}

// ---------- Render ----------

function renderBlock(block, key) {
  switch (block.type) {
    case 'heading':
      return <Heading key={key} level={block.level} text={block.text} />
    case 'hr':
      return (
        <hr key={key} style={{
          border: 'none',
          borderTop: '1px solid var(--border)',
          margin: '14px 0',
        }} />
      )
    case 'blockquote':
      return (
        <blockquote key={key} style={{
          margin: '10px 0',
          paddingLeft: 12,
          borderLeft: '3px solid var(--sage-light)',
          color: 'var(--slate)',
          fontStyle: 'italic',
        }}>
          {renderInline(block.text)}
        </blockquote>
      )
    case 'list':
      return (
        <ListBlock key={key} ordered={block.ordered} items={block.items} />
      )
    case 'paragraph':
    default:
      return (
        <p key={key} style={{ margin: '6px 0' }}>
          {renderInline(block.text)}
        </p>
      )
  }
}

function Heading({ level, text }) {
  const base = {
    color: 'var(--ink)',
    margin: '14px 0 6px',
    lineHeight: 1.25,
  }
  if (level === 1) {
    return (
      <h1 style={{
        ...base,
        fontFamily: 'var(--font-display)',
        fontSize: 22, fontWeight: 600,
        letterSpacing: '-0.3px',
      }}>{renderInline(text)}</h1>
    )
  }
  if (level === 2) {
    return (
      <h2 style={{
        ...base,
        fontFamily: 'var(--font-display)',
        fontSize: 18, fontWeight: 600,
        letterSpacing: '-0.2px',
      }}>{renderInline(text)}</h2>
    )
  }
  if (level === 3) {
    return (
      <h3 style={{
        ...base,
        fontFamily: 'var(--font-sans)',
        fontSize: 15, fontWeight: 600,
        color: 'var(--ink)',
      }}>{renderInline(text)}</h3>
    )
  }
  return (
    <h4 style={{
      ...base,
      fontFamily: 'var(--font-sans)',
      fontSize: 13, fontWeight: 600,
      color: 'var(--slate)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>{renderInline(text)}</h4>
  )
}

function ListBlock({ ordered, items }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag style={{
      margin: '6px 0',
      paddingLeft: 20,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      {items.map((item, i) => (
        <li key={i} style={{
          margin: 0,
          listStyleType: ordered ? 'decimal' : 'disc',
          paddingLeft: 2,
        }}>
          <div>{renderInline(item.text)}</div>
          {item.sub.length > 0 && (
            <div style={{
              color: 'var(--slate)',
              fontSize: 13.5,
              marginTop: 2,
              lineHeight: 1.55,
            }}>
              {item.sub.map((s, j) => (
                <div key={j}>{renderInline(s)}</div>
              ))}
            </div>
          )}
        </li>
      ))}
    </Tag>
  )
}

// ---------- Inline parsing ----------
//
// We walk the string character-by-character and produce an array of React
// nodes. Supports **bold**, *italic*, _italic_, `code`.

function renderInline(text) {
  if (!text) return null
  const tokens = tokenizeInline(text)
  return tokens.map((t, i) => {
    if (t.type === 'text') return <span key={i}>{t.value}</span>
    if (t.type === 'bold') return (
      <strong key={i} style={{ fontWeight: 600, color: 'var(--ink)' }}>
        {renderInline(t.value)}
      </strong>
    )
    if (t.type === 'italic') return (
      <em key={i} style={{ fontStyle: 'italic', color: 'var(--slate)' }}>
        {renderInline(t.value)}
      </em>
    )
    if (t.type === 'code') return (
      <code key={i} style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.9em',
        padding: '1px 5px',
        background: 'var(--cream-mid)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        color: 'var(--ink-soft)',
      }}>{t.value}</code>
    )
    return null
  })
}

function tokenizeInline(text) {
  const out = []
  let buf = ''
  let i = 0

  const flush = () => { if (buf) { out.push({ type: 'text', value: buf }); buf = '' } }

  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]

    // inline code
    if (ch === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) {
        flush()
        out.push({ type: 'code', value: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    // **bold**
    if (ch === '*' && next === '*') {
      const end = text.indexOf('**', i + 2)
      if (end !== -1) {
        flush()
        out.push({ type: 'bold', value: text.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }

    // *italic* — require non-space boundary to avoid munching bullet markers
    if (ch === '*' && next !== '*' && next && next !== ' ') {
      const end = text.indexOf('*', i + 1)
      if (end !== -1 && text[end - 1] !== ' ') {
        flush()
        out.push({ type: 'italic', value: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    // _italic_
    if (ch === '_' && next && next !== ' ' && (i === 0 || /\s|[(\[{,.]/.test(text[i - 1]))) {
      const end = text.indexOf('_', i + 1)
      if (end !== -1 && text[end - 1] !== ' ') {
        flush()
        out.push({ type: 'italic', value: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    buf += ch
    i++
  }
  flush()
  return out
}

// ---------- Candidate extraction ----------
//
// Best-effort parser that pulls a list of candidates out of a "Top N fits" /
// "matches" markdown block the agent emits. Used to render rich cards when we
// don't have structured tool output.
//
// Example line:
//   - **Aarav Mehta** · CSE · CGPA 9.3 · fit 35.4
//     Skills: Python, PyTorch, TensorFlow. Strong data science signal.

export function parseCandidatesFromMarkdown(markdown) {
  if (!markdown) return null
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n')
  const candidates = []
  let current = null

  const headerRe = /^\s*[-*]\s+\*\*([^*]+)\*\*\s*(.*)$/  // - **Name** · rest
  const metaRe = /·/

  for (const raw of lines) {
    const m = raw.match(headerRe)
    if (m) {
      if (current) candidates.push(current)
      current = {
        name: m[1].trim(),
        branch: null, year: null, cgpa: null,
        fit_score: null, top_role: null,
        skills: [], rationale: '',
      }
      const rest = m[2] || ''
      if (metaRe.test(rest)) {
        const parts = rest.split('·').map((p) => p.trim()).filter(Boolean)
        for (const p of parts) {
          const lc = p.toLowerCase()
          const cgpaM = p.match(/cgpa\s*([\d.]+)/i)
          const fitM = p.match(/fit\s*([\d.]+)/i)
          const yearM = p.match(/(\d)(?:st|nd|rd|th)?\s*year/i)
          if (cgpaM) current.cgpa = Number(cgpaM[1])
          else if (fitM) current.fit_score = Number(fitM[1])
          else if (yearM) current.year = Number(yearM[1])
          else if (/^[A-Z]{2,5}$/.test(p)) current.branch = p       // CSE, ECE, etc.
          else if (lc.startsWith('branch')) current.branch = p.split(/:\s*/)[1] || p
          else if (!current.branch && /[A-Za-z]/.test(p) && p.length <= 40) current.branch = p
        }
      }
    } else if (current && raw.trim()) {
      // Continuation line — could contain "Skills:" / rationale
      const line = raw.trim()
      const skillsM = line.match(/^skills?\s*:\s*(.+?)(?:\.\s|$)/i)
      if (skillsM) {
        current.skills = skillsM[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean)
        const remainder = line.slice(skillsM[0].length).trim()
        if (remainder) {
          current.rationale = current.rationale
            ? `${current.rationale} ${remainder}`
            : remainder
        }
      } else {
        current.rationale = current.rationale ? `${current.rationale} ${line}` : line
      }

      // Pick up "top role" hints inside rationale
      const roleM = line.match(/\b(?:top\s+role|role)[:\s]+([A-Za-z][A-Za-z0-9\s\-/]{2,30})/i)
      if (roleM && !current.top_role) current.top_role = roleM[1].trim()
    } else if (!raw.trim() && current) {
      // blank line ends candidate block
      candidates.push(current)
      current = null
    }
  }
  if (current) candidates.push(current)

  // Only return if we parsed at least 2 candidates with a fit score
  const scored = candidates.filter((c) => c.fit_score != null)
  if (scored.length >= 2) return scored
  return null
}

/**
 * Heuristic: does the markdown look like a "Top N fits" / ranking block?
 */
export function looksLikeRankingResponse(markdown) {
  if (!markdown) return false
  const s = String(markdown).toLowerCase()
  return (
    /top\s+\d+\s+(fits?|matches?|candidates?)/i.test(s) ||
    /ranked\s+candidates?/i.test(s) ||
    /best\s+(fits?|matches?)\s+for/i.test(s)
  )
}
