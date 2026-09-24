// ── Who a key press belongs to (plan 123) ──────────────────────────
// The app answers keys at the window: a run's digits and Space, a
// cutscene's skip, the desk's Enter and Esc. These are the questions
// each such handler asks before it takes one, kept in one place so
// the answers agree.

// A cutscene (the 改札, the train door, the arrival) cuts to its end on
// any key, and the screen it is revealing is already mounted under it:
// a ride's card, a run's Esc. Listened for in the capture phase and
// stopped there, the key that skipped the scene is spent on it and
// never reaches that screen too -- Space no longer turned the first
// card under the gate, nor Esc left the ride it was opening. A browser
// chord (Ctrl/⌘/Alt) still skips but is not taken from the browser.
export function spendKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  e.preventDefault()
  e.stopPropagation()
}
