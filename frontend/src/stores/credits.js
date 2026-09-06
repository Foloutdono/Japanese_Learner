import { useSyncExternalStore } from 'react'

// ── 回数券 — the balance, as the chrome sees it ───────────────
// The commuter pass on the HUD prints the credit balance (plan 069:
// the ledger, the refill, the fare gate). Until that plan lands the
// store holds nothing and the pass shows its mark with no figure —
// the object is in place so the HUD and the stage head draw the same
// pass from day one, and 069 only has to fill it.
//
// Shape, once filled: { balance, cap, dailyRefill, refillAt, plan,
// unlimited }. `null` is "unknown", never "zero".
let credits = null
const listeners = new Set()

function emit() {
  listeners.forEach(fn => fn(credits))
}

export function setCredits(next) {
  credits = next
  emit()
}

export function useCredits() {
  return useSyncExternalStore(
    fn => { listeners.add(fn); return () => listeners.delete(fn) },
    () => credits,
    () => null,
  )
}
