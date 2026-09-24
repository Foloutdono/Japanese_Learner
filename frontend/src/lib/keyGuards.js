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

// A key pressed while an input method is composing belongs to the
// input method. Japanese is typed through one: the Enter that commits
// くち, or the Esc that cancels a conversion, arrives as a keydown like
// any other -- with isComposing in Chrome and Firefox, and keyCode 229
// in Safari. Taken as the field's own Enter it graded a readings answer
// with one row filled, or created a deck named after its first word; an
// Esc that only cancelled a conversion closed a dock. Works on a DOM
// event and on React's synthetic one.
export function composing(e) {
  const n = e?.nativeEvent ?? e
  return Boolean(n?.isComposing) || n?.keyCode === 229
}
