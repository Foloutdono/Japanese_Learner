import { useSyncExternalStore } from 'react'

// ── 机 — who holds Esc (plan 123) ───────────────────────────────────
// On the desk a run's head prints Esc beside its way out (StageHead),
// and Esc leaves the run -- until a door opened in the run's side holds
// the key: an entry opened from a breakdown (SideLookup), a dock in a
// column (DeskDock), a door opened inside a docked entry (the lookup
// body's `escBack`). Each of those spends the Esc itself, so the run's
// own cap was a promise the key did not keep: it said "leave" while Esc
// closed the entry. A holder registers while it holds; the head drops
// its cap while anyone does.
//
// A count rather than a flag: a dock and a lookup can hold at once, and
// the first to let go must not clear the other's hold. Same shape as
// stores/guide: a value and a set of listeners.
const listeners = new Set()
let held = 0

function notify() { listeners.forEach(fn => fn()) }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

/** Hold Esc; returns the release, safe to call twice (an effect's
 *  cleanup). */
export function holdEsc() {
  held += 1
  notify()
  let released = false
  return () => {
    if (released) return
    released = true
    held -= 1
    notify()
  }
}

export function useEscHeld() {
  return useSyncExternalStore(subscribe, () => held > 0, () => false)
}
