import { useSyncExternalStore } from 'react'

// ── 本日の乗車 — this run's tally (plan 113) ────────────────────
// What the desk's session panel prints beside a run: how many cards
// this run has rated, how many of them good or better, and the XP they
// earned. Module state rather than screen state because the six SRS
// runs already share one review path (hooks/useReviewGates), and that
// hook is where the count is kept — so every run counts the same way
// and no screen had to learn a new prop.
//
// "Good" is quality ≥ 3, the line the scheduler graduates on and the
// statistics screen calls retention (domain/statsModel.js). The XP is
// what the review's own preview said it earned, the figure the toast
// and the level bar show.
//
// The phone counts too — a few integers, no DOM — and nothing reads it.
const EMPTY = Object.freeze({ key: null, reviewed: 0, good: 0, xp: 0 })

let tally = EMPTY
const listeners = new Set()
function emit() { listeners.forEach(fn => fn()) }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }

/** A new run: the session's identity, and every figure back to zero. */
export function startTally(key) {
  tally = { ...EMPTY, key }
  emit()
}

/** One rated card. */
export function countReview({ quality, xp } = {}) {
  tally = {
    ...tally,
    reviewed: tally.reviewed + 1,
    good: tally.good + (quality >= 3 ? 1 : 0),
    xp: tally.xp + (Number.isFinite(xp) ? xp : 0),
  }
  emit()
}

/** The share rated good or better, as a whole percent; null before the first. */
export function tallyAccuracy({ reviewed, good }) {
  return reviewed > 0 ? Math.round((good / reviewed) * 100) : null
}

export function peekTally() {
  return tally
}

export function useRunTally() {
  return useSyncExternalStore(subscribe, peekTally, peekTally)
}
