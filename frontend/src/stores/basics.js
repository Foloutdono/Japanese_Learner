import { createRemoteStore } from './remote'

// ── 基礎 — the basics course, unit by unit (plan 186g) ───────────
// /api/basics: the fourteen units with their figures and the unit the
// course is at. Read by the Learn gate's 基礎 plate and the course's
// station; a minute's TTL, and the station asks again after a run.
const store = createRemoteStore('/api/basics', { ttlMs: 60_000 })

export function useBasics() {
  return store.use()
}

export function refreshBasics() {
  return store.refresh()
}

/** The learner this course belongs to has signed out (stores/account). */
export function forgetBasics() {
  store.forget()
}
