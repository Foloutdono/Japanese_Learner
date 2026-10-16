import { useSyncExternalStore } from 'react'

// ── Nous écrire, raised from inside a run (plan 222) ────────────────
// The link under a failure and the flag on an answered card open their
// sheet through here, and App renders it beside <Routes/>
// (components/feedback/FeedbackSheet.jsx, FeedbackHost) -- for the
// reason RunOutSheet is there. What raised it does not last: a run
// whose batch failed clears its error to retry on its own after 1, 2,
// 4 and 8 seconds (hooks/useCardSession), which unmounted the failure
// and the sheet with it while the learner was still typing; a card's
// flag goes with the rating. The sheet holds what it was opened about.
//
// The value: null, or { failure } (an API area and status, or null)
// for the form, or { card } for the card's own sheet. Same shape as
// stores/escHold: a value and a set of listeners.
const listeners = new Set()
let open = null

function notify() { listeners.forEach(fn => fn()) }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export function openFeedback(failure = null) {
  open = { failure }
  notify()
}

export function openCardReport(card) {
  open = { card }
  notify()
}

export function closeFeedback() {
  if (open === null) return
  open = null
  notify()
}

export function useFeedbackSheet() {
  return useSyncExternalStore(subscribe, () => open, () => null)
}
