import { useEffect } from 'react'

// ── 机 — a list walked with the arrow keys (plan 115) ───────────────
// A station's stops in the desk's split (components/selection/RouteStops,
// StationSplit) are one tab stop — the open stop — and ↑/↓ move along
// them, Home and End to either end, the way a desktop list is read.
// Moving is focus only: Enter or Space opens the stop, as a click does.
// The list's own keydown handler, or nothing where the list is not
// walked (a phone).
//
// The stops are links on the desk (plan 117, SplitRow). Enter opens a
// link on its own; Space does not — on a link it scrolls the page — so
// the walk presses it, keeping the list's promise.
//
// Every list beside a page walks this way (plan 123): the grammar
// points, the tiers, the library's shelf and the exam's review as well
// as the stops, each naming its rows with `items` -- a grammar point is
// a link inside a list item, a review row sits in its part's group.
export const ROWS = ':scope > :is(a[href], button)'

export function useListWalk(active, { items = ROWS } = {}) {
  return active ? e => walk(e, items) : undefined
}

function walk(e, selector) {
  if (![' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  const items = [...e.currentTarget.querySelectorAll(selector)]
  const at = items.indexOf(document.activeElement)
  if (at < 0) return
  if (e.key === ' ') {
    if (items[at].tagName !== 'A' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    items[at].click()
    return
  }
  const last = items.length - 1
  const next = e.key === 'Home' ? 0
    : e.key === 'End' ? last
    : Math.min(last, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))
  e.preventDefault()
  items[next].focus()
}

// The page's ←/→ open the neighbouring row (the grammar points, the
// exam's questions). While the focus is in the list it goes with the
// open row, so the ring and the gold row agree -- Enter on a row left
// behind reopened the point just walked away from (plan 123).
export function useFollowFocus(listRef, open, active = true) {
  useEffect(() => {
    const list = listRef.current
    if (!active || !list || !list.contains(document.activeElement)) return
    const row = list.querySelector('[aria-current="page"]')
    if (row && row !== document.activeElement) row.focus({ preventScroll: true })
  }, [listRef, open, active])
}
