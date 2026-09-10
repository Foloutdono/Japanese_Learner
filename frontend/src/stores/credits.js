import { useSyncExternalStore } from 'react'
import { createRemoteStore } from './remote'
import { track } from '../lib/track'
import { stopwatch } from '../lib/dwell'

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

/** The optimistic decrement, before the response. Nothing to apply on
 *  a free line — see lib/reviews.js. */
export function applySpend(n = 1) {
  if (!(n > 0)) return
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

// ── 定期券 — the offer (the paywall) ────────────────────────────
// Module state for the same reason the balance sheet is: it opens from
// five unrelated places — the last boarding screen, the balance sheet,
// the profile, the settings list, and a run that hit zero — and three
// of those are outside any screen that could hold the state.
//
// The funnel is recorded HERE rather than in the sheet, on purpose.
// Every open must produce exactly one `offer_view` and exactly one of
// `offer_intent` / `offer_dismiss` (lib/track.js's closed set), and
// the only way to guarantee that across five call sites is to make the
// call sites unable to get it wrong: they open, take and close, and
// the events are a consequence. The door rides along as `where`, so
// the dashboard can say which of the five converts.
let paywall = null   // { source, taken } or null
// How long the offer has been in front of them. Started on open and
// read once, on whichever of the two answers comes first — the gap
// between seeing the pass and deciding about it is the difference
// between a glance and an actual consideration, and a door with a high
// intent rate but a one-second median is a mis-tap, not demand.
let dwell = null

/** Open the offer from one of domain/paywall.js's SOURCES. */
export function openPaywall(source) {
  paywall = { source, taken: false }
  dwell?.stop()
  dwell = stopwatch()
  track('offer_view', { where: source })
  emit()
}

/** Engaged ms since the sheet opened, and the stopwatch spent. */
function spendDwell() {
  if (!dwell) return {}
  const ms = dwell.read()
  dwell.stop()
  dwell = null
  return { ms }
}

/**
 * "Prévenez-moi" taken. Recorded once per open — a second tap is the
 * same answer, and counting it twice would inflate the only number
 * this whole feature exists to produce.
 */
export function takePaywall() {
  if (!paywall || paywall.taken) return
  paywall = { ...paywall, taken: true }
  track('offer_intent', { where: paywall.source, ...spendDwell() })
  emit()
}

/** Close it. A close that follows an intent is not a dismissal. */
export function closePaywall() {
  // The stopwatch is spent either way: an intent already read it, and
  // leaving it running would carry one learner's deliberation into the
  // next open.
  if (paywall && !paywall.taken) {
    track('offer_dismiss', { where: paywall.source, ...spendDwell() })
  } else {
    spendDwell()
  }
  paywall = null
  emit()
}

export function peekPaywall() { return paywall }
export function usePaywall() {
  return useSyncExternalStore(subscribe, () => paywall, () => null)
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
