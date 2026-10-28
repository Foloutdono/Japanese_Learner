import { createRemoteStore } from './remote'

// ── 対戦 — the duels at a glance, shared (plan 279) ──────────────
// GET /api/pvp: the learner's Elo and record, the duels waiting on
// them, the ones running and the last ones played, the friends and the
// requests waiting. Read by the door into the duels wherever it stands
// (the holder, Today's key and its board's row, plan 286) and by the duels' own
// hall, so the badge and the hall never disagree. A short TTL: a friend's
// challenge arriving is the thing it says.
const store = createRemoteStore('/api/pvp', { ttlMs: 30_000 })

export function useDuels() {
  return store.use()
}

export function refreshDuels() {
  return store.refresh()
}

/** The learner these duels belong to has signed out (stores/account). */
export function forgetDuels() {
  store.forget()
}
