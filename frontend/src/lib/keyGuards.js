import { dialogOpen } from './dialogOpen'

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

// A run's window keys -- Space and ZQSD turn the card, the digits pick
// an answer -- are the run's only when nothing else owns the press:
// not a held key, not a browser chord (Ctrl/⌘+S saves the page, ⌘+1
// goes to a tab; neither turns a card), not an input method's, not a
// field's, not a dialog's. RatingBar, HintBar, the exam and
// comprehension already asked all of this; the card and the choices
// now ask it the same way.
export function runKey(e) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || composing(e) || dialogOpen()) return false
  const target = e.target
  return !(target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? ''))
}

// Which control the pointer last pressed, until a Tab moves the focus
// on (plan 123). Chrome focuses a clicked button, so after a click the
// focus sits on it, and Enter would press it again -- a learner who
// clicked a lane off and pressed Enter to depart turned the lane back
// on instead. A page's Enter (components/chrome/DeskKeys' EnterKey, the
// boarding's keys) asks this and treats that control as not owning the
// key. Installed once, by the desk's first key listener; a phone never
// installs it.
let pressed = null
let tracking = false
export function trackPresses() {
  if (tracking || typeof window === 'undefined') return
  tracking = true
  window.addEventListener('pointerdown', e => {
    pressed = e.target?.closest?.('button, a[href], summary') ?? null
  }, true)
  window.addEventListener('keydown', e => { if (e.key === 'Tab') pressed = null }, true)
}

/** Whether `el` holds the focus because the pointer pressed it. */
export function pressedByPointer(el) {
  return el != null && el === pressed && document.activeElement === el
}
