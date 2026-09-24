import { useSyncExternalStore } from 'react'

// ── 案内 — the guide's own state (plan 100) ────────────────────────
// Two things the guide has to know that no screen owns:
//
//   held   — the 改札 cutscene is still playing over the router
//            (App.jsx's 'finishing' gate), so no guide may open yet:
//            a note over a scrim is a note nobody reads, and the first
//            gate's guide would end before the learner saw its start.
//   shown  — which gates opened their guide this SESSION, so a gate
//            revisited before the profile store has caught up with the
//            stamp does not open it twice.
//
// Same shape as stores/departure: a value and a set of listeners.
const listeners = new Set()
let held = false
const shown = new Set()

function notify() { listeners.forEach(fn => fn()) }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export function holdGuide(value) {
  if (held === Boolean(value)) return
  held = Boolean(value)
  notify()
}

/** The same, read once, for a key handler (components/chrome/DeskKeys). */
export function guideHeld() { return held }

export function useGuideHeld() {
  return useSyncExternalStore(subscribe, () => held, () => false)
}

export function markShown(gate) { shown.add(gate) }
export function wasShown(gate) { return shown.has(gate) }
export function forgetShown() { shown.clear() }
