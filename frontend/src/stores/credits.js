import { useSyncExternalStore } from 'react'
import { createRemoteStore } from './remote'

// ── 回数券 — the balance, as the chrome sees it (plan 069) ────
// One cached answer from GET /api/credits, printed on the HUD's pass
// and the gate card; the pass shows its mark and no figure until it
// arrives. Shape: { balance, cap, dailyRefill, refillAt, plan,
// unlimited, enforced } — `balance` null on a pass, never "zero".
//
// A review moves it twice: an optimistic decrement the moment the
// rating lands (the HUD figure must not lag the tap), then the
// server's own figure from the review response (lib/reviews.js), which
// wins — a refill that landed between the two, a fare the shadow mode
// did not charge, anything the client could not know.
const store = createRemoteStore('/api/credits', { ttlMs: 60_000 })

export function useCredits() {
  return store.use().data
}

export function refreshCredits() {
  return store.refresh()
}

export function seedCredits(data) {
  store.seed(data)
}

/** The last known balance, outside React (tests, the review helper). */
export function peekBalance() {
  const cur = store.peek()
  return cur ? (cur.unlimited ? null : cur.balance) : undefined
}

/** The optimistic decrement, before the response. */
export function applySpend(n = 1) {
  const cur = store.peek()
  if (!cur || cur.unlimited || cur.balance == null) return
  store.seed({ ...cur, balance: Math.max(0, cur.balance - n) })
}

/** The server's figure from a review response: `credits: { balance, unlimited }`. */
export function reconcileCredits(fare) {
  const cur = store.peek()
  if (!fare || !cur) return
  store.seed({ ...cur, unlimited: !!fare.unlimited, balance: fare.unlimited ? null : fare.balance })
}

// ── The two sheets the balance opens (components/credits/) ──
// Module state rather than screen state for the same reason the
// departure is: the balance sheet opens off the HUD (outside every
// screen) and the run-out sheet is raised by a review the screen fired
// and forgot. Both mount beside <Routes/> in App.jsx.
let balanceOpen = false
let runOut = null   // { balance, refillAt, cleared } or null
const listeners = new Set()
function emit() { listeners.forEach(fn => fn()) }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }

export function openBalance() { balanceOpen = true; emit() }
export function closeBalance() { balanceOpen = false; emit() }
export function useBalanceOpen() {
  return useSyncExternalStore(subscribe, () => balanceOpen, () => false)
}

/** A 402 out_of_credits mid-run: the run stops at the balance and says so. */
export function markRunOut(payload) {
  runOut = payload
  if (payload) {
    const cur = store.peek()
    if (cur) store.seed({ ...cur, balance: 0 })
  }
  emit()
}
export function clearRunOut() { runOut = null; emit() }
export function peekRunOut() { return runOut }
export function useRunOut() {
  return useSyncExternalStore(subscribe, () => runOut, () => null)
}
