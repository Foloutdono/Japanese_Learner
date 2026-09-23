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

// Where the last train was boarded from: the page the learner was on
// when they chose it. A run's way out uses it (returnsTo, below) to go
// BACK to that page rather than pile a second copy of it on top of the
// run in the history — which is what made Back, or a mouse's back
// button, re-board a run the learner had just left.
let boardedFrom = null

function here() {
  return typeof window === 'undefined' ? null : window.location.pathname
}

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
  boardedFrom = here()
  current = { commit, color, id: Date.now() }
  emit()
}

/**
 * Whether leaving the run for `path` is a step back in the history:
 * the run was boarded from exactly that page, in this tab, and there
 * is an entry to go back to. Asked once per way out — the record is
 * spent by the asking, so a reloaded run never reads a stale one.
 */
export function returnsTo(path) {
  const hit = boardedFrom === path && (window.history.state?.idx ?? 0) > 0
  boardedFrom = null
  return hit
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
