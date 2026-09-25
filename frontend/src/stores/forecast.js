import { createRemoteStore } from './remote'

// ── 七日 — /api/today/forecast, the week ahead (plan 135) ─────────
// What comes due each of the next seven days, read by the bars under
// the journey beside the desk's fare gate (components/journey/
// WeekAhead) and by nothing on a phone, which never mounts them. No
// TTL: it moves when a run ends and the learner comes back to Today,
// which is when it is read.
const store = createRemoteStore('/api/today/forecast', { ttlMs: 0 })

export function useForecast() {
  return store.use()
}

/** The learner these figures belong to has signed out (stores/account). */
export function forgetForecast() {
  store.forget()
}
