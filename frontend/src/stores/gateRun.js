import { useSyncExternalStore } from 'react'

// ── 区間 — what the desk's gate is about to send (plan 135) ───────
// The gate (components/station/GateCard's DeskGate) owns the run's
// length and the lanes switched off; the week ahead beside it prints
// what that choice leaves for tomorrow. One number, published by the
// gate as it draws and read by the side: the two are siblings, and
// neither owns the other.
let left = 0
const listeners = new Set()

export function publishLeft(n) {
  if (n === left) return
  left = n
  for (const fn of listeners) fn()
}

export function useLeft() {
  return useSyncExternalStore(
    fn => { listeners.add(fn); return () => listeners.delete(fn) },
    () => left,
  )
}
