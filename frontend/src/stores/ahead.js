import { useSyncExternalStore } from 'react'

// ── 発車案内 — the last plan of the day ahead (plan 156) ─────────
// NativeBridge plans the daily notifications whenever the app opens,
// comes back to the front or a run lands; Settings › Notifications
// prints the next one it scheduled, so the page shows the learner the
// real words at the real hour rather than a sample. `failed` is a plan
// that could not be fetched: what was scheduled before stays scheduled.
let state = { nudges: null, failed: false }
const listeners = new Set()

export function setAheadPlan(next) {
  state = { ...state, ...next }
  listeners.forEach(fn => fn())
}

export function forgetAheadPlan() {
  setAheadPlan({ nudges: null, failed: false })
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAheadPlan() {
  return useSyncExternalStore(subscribe, () => state, () => state)
}
