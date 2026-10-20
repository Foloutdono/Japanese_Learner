import { createRemoteStore } from './remote'

// ── 実践の記録 — /api/practice/record, shared (plan 130) ─────────
// What the learner has done at each grade on each practice platform,
// read by the Practice gate's plates on a phone (screens/PracticeScreen,
// plan 254: the learner's grade at each plate's foot, between what was
// done there and the share right), by the desk's practice stations
// (components/practice/PracticeStation, every grade's) and by the mock
// exam's station. No TTL: the record changes exactly when a run ends and
// the learner comes back to the gate, which is the moment it is read, so
// every visit asks again and draws the last answer meanwhile.
const store = createRemoteStore('/api/practice/record', { ttlMs: 0 })

export function usePracticeRecord() {
  return store.use()
}

/** The learner these figures belong to has signed out (stores/account). */
export function forgetPracticeRecord() {
  store.forget()
}
