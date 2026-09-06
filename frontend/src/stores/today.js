import { createRemoteStore } from './remote'

// ── 本日 — today's summary, shared ───────────────────────────
// /api/today used to be fetched by the home screen alone and handed
// down to the gate card and the map's due chips. The chrome reads it
// too now — the tab bar's badge is the day's total — so it is a store:
// one request, every consumer. A minute's TTL: the figure changes
// when a review lands, and the run (plan 070) calls refreshToday()
// when it does rather than waiting the minute out.
const store = createRemoteStore('/api/today', { ttlMs: 60_000 })

export function useTodaySummary() {
  return store.use()
}

export function refreshToday() {
  return store.refresh()
}

export function seedTodaySummary(data) {
  store.seed(data)
}
