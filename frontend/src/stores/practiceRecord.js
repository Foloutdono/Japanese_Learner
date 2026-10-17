import { createRemoteStore } from './remote'

// ── 実践の記録 — /api/practice/record, shared (plan 130) ─────────
// What the learner has done at each grade on each practice platform,
// read by the Practice gate's board on the desk (components/practice/
// gate/DeskGate, plan 244; its grade rows, plan 130, before it) and by
// nothing on a phone, which never mounts it. No TTL: the record changes
// exactly when a run ends and the learner comes back to the gate, which
// is the moment the board is read, so every visit asks again and draws
// the last answer meanwhile.
const store = createRemoteStore('/api/practice/record', { ttlMs: 0 })

export function usePracticeRecord() {
  return store.use()
}

/** The learner these figures belong to has signed out (stores/account). */
export function forgetPracticeRecord() {
  store.forget()
}
