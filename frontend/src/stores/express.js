import { useSyncExternalStore } from 'react'

// ── 特急 — the express in progress ────────────────────────
// The third of the station's transitions, and the one for the daily
// queue. The other two are both permissions to proceed:
//
//   改札  stores/departure — tap the pass, the flaps retract, walk
//         through to a section.
//   扉    stores/boarding  — the doors shut over the menu, the choice
//         is committed behind them, they part onto the quiz.
//
// Neither fits the queue, because the queue's whole claim is that it
// SKIPS the steps those two ceremonies exist to dignify: no level, no
// mode, no menu. So this is the limited express — the train that takes
// the platform at line speed and does not stop for any of it.
//
// Same reason for living outside React as the other two, and the same
// reason as boarding's specifically: what the express covers is the
// screen deciding to render a different tree, so a component inside
// that tree would be unmounted by the very change it is covering.
//
// `run` is the commit — starting the session with the lanes chosen.
let current = null
const listeners = new Set()

function emit() {
  listeners.forEach(fn => fn(current))
}

/**
 * Send the express through, then run `commit`.
 *
 * @param {() => void} commit  what the screen would otherwise have done
 *                             on the frame the button was pressed.
 */
export function runExpress(commit) {
  current = { commit, id: Date.now() }
  emit()
}

export function endExpress() {
  if (current === null) return
  current = null
  emit()
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useExpress() {
  return useSyncExternalStore(subscribe, () => current)
}
