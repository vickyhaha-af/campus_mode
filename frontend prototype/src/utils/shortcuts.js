export function initShortcuts(handlers) {
  const handleKeyDown = (e) => {
    // Ignore if typing in an input
    if (e.target.matches('input, textarea, [contenteditable]')) return

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        handlers.navigate_up?.()
        break
      case 'ArrowDown':
        e.preventDefault()
        handlers.navigate_down?.()
        break
      case 'e':
      case 'E':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          handlers.export?.()
        }
        break
      case 'c':
      case 'C':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          handlers.compare?.()
        }
        break
      case 't':
      case 'T':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          handlers.theme?.()
        }
        break
      case '?':
        e.preventDefault()
        handlers.help?.()
        break
      case 'Escape':
        e.preventDefault()
        handlers.close?.()
        break
      default:
        break
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}
