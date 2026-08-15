import { useSyncExternalStore } from 'react'

// ── Boarding ──────────────────────────────────────────────
// The other half of stores/departure. The ticket gate is leaving the
// concourse for a platform; this is stepping onto the train once the
// last choice is made — the moment a selection screen becomes a quiz.
//
// It has to live outside the screen for the same reason the gate does,
// and the reason is sharper here: committing the choice is precisely
// what makes the screen render a different tree. A door rendered by
// the selection branch would be unmounted by the very state change it
// is covering, on the frame it was supposed to be opening.
//
// `run` is the commit itself — usually the screen's own setMode. The
// door calls it while the panels are still shut, so what they part to
// reveal is the quiz rather than the menu that was there a moment ago.
let current = null
const listeners = new Set()

function emit() {
  listeners.forEach(fn => fn(current))
}

/**
 * Board a train, then run `commit`.
 *
 * @param {() => void} commit   what the selection screen would have
 *                              done immediately — setMode and friends.
 * @param {string}     [color]  the line colour to paint the doors in;
 *                              defaults to whatever the screen's own
 *                              --line-color already is.
 */
export function board(commit, color) {
  current = { commit, color, id: Date.now() }
  emit()
}

export function endBoarding() {
  if (current === null) return
  current = null
  emit()
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useBoarding() {
  return useSyncExternalStore(subscribe, () => current)
}
