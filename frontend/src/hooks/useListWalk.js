// ── 机 — a list walked with the arrow keys (plan 114) ───────────────
// A station's stops in the desk's split (components/selection/RouteStops,
// StationSplit) are one tab stop — the open stop — and ↑/↓ move along
// them, Home and End to either end, the way a desktop list is read.
// Moving is focus only: Enter or Space opens the stop, as a click does.
// The list's own keydown handler, or nothing where the list is not
// walked (a phone).
export function useListWalk(active) {
  return active ? walk : undefined
}

function walk(e) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  const items = [...e.currentTarget.querySelectorAll(':scope > button')]
  const at = items.indexOf(document.activeElement)
  if (at < 0) return
  const last = items.length - 1
  const next = e.key === 'Home' ? 0
    : e.key === 'End' ? last
    : Math.min(last, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))
  e.preventDefault()
  items[next].focus()
}
