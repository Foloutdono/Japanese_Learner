import { useSyncExternalStore } from 'react'

// ── 回送 — a card set aside, from inside a run (plan 328) ────────────
// Not every word in a deck is one a learner wants (テープレコーダー, the
// tape recorder: old tech). The eye beside an answered card's flag asks
// here; App renders the sheet beside <Routes/> (components/study/
// SetAside.jsx, SetAsideHost) for the reason the flag's sheet is there.
// Once the server has it, every run in hand drops the card, in all its
// modes (hooks/useCardSession listens), so the learner sees the next
// card without answering this one -- setting aside is not an answer.
//
// Two things, the same shape as stores/feedbackSheet: the card the sheet
// is open about (or null), and the listeners told a card left.
const listeners = new Set()
const goneListeners = new Set()
let open = null

function notify() { listeners.forEach(fn => fn()) }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

/** A card the eye may set aside: anything a run served by its id. */
export function settable(card) {
  const id = card?.card_id
  return typeof id === 'string' && id.length > 0 && id.length <= 160 && !id.includes(':')
}

export function askSetAside(card) {
  open = { card }
  notify()
}

export function closeSetAside() {
  if (open === null) return
  open = null
  notify()
}

export function useSetAsideAsk() {
  return useSyncExternalStore(subscribe, () => open, () => null)
}

/** Tell every run in hand that this card is gone. */
export function cardSetAside(cardId) {
  goneListeners.forEach(fn => fn(cardId))
}

/** Listen for cards set aside; returns the way to stop. */
export function onCardSetAside(fn) {
  goneListeners.add(fn)
  return () => goneListeners.delete(fn)
}
