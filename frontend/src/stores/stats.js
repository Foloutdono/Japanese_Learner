import { createRemoteStore } from './remote'

// ── 統計 — /api/stats, shared ────────────────────────────────
// The route map reads it for the distance travelled on each line, and
// since plan 071 every station reads it too (the figures on the route
// stops: learned / total per level). One request, every consumer, a
// minute's TTL; a review lands on the stage and the next station
// visit is what refreshes it.
const store = createRemoteStore('/api/stats', { ttlMs: 60_000 })

export function useStats() {
  return store.use()
}

export function refreshStats() {
  return store.refresh()
}

export function seedStats(data) {
  store.seed(data)
}
