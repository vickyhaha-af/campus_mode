/**
 * Keyboard shortcuts manager
 * ↑↓ = navigate candidates, E = export, C = compare, D = demo, T = theme, ? = help
 */

const SHORTCUTS = {
  ArrowUp: { key: '↑', desc: 'Previous candidate', action: 'navigate_up' },
  ArrowDown: { key: '↓', desc: 'Next candidate', action: 'navigate_down' },
  e: { key: 'E', desc: 'Export results', action: 'export' },
  c: { key: 'C', desc: 'Compare selected', action: 'compare' },
  d: { key: 'D', desc: 'Toggle demo mode', action: 'demo' },
  t: { key: 'T', desc: 'Toggle theme', action: 'theme' },
  '?': { key: '?', desc: 'Show shortcuts', action: 'help' },
  Escape: { key: 'Esc', desc: 'Close modal', action: 'close' },
}

export function initShortcuts(handlers) {
  const listener = (e) => {
    // Don't intercept when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return
    }

    const shortcut = SHORTCUTS[e.key]
    if (shortcut && handlers[shortcut.action]) {
      e.preventDefault()
      handlers[shortcut.action]()
    }
  }

  window.addEventListener('keydown', listener)
  return () => window.removeEventListener('keydown', listener)
}

export function getShortcutList() {
  return Object.values(SHORTCUTS)
}

export default SHORTCUTS
