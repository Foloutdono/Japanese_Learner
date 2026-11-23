import { apiJson } from '../lib/api'
import { createRemoteStore } from './remote'

// ── 任務 — the missions, as the screens read them (plan 331) ──────
// GET /api/missions: the day's three and its bonus, the week's three and
// what waits to be collected, read by the pill under Today's legend and
// its sheet. GET /api/missions/book: the discoveries and the achievements,
// read by the holder's insert. Two stores, because the gate must not wait
// on the book's dearer sweep (the boot asks for the screen first).
const store = createRemoteStore('/api/missions', { ttlMs: 60_000 })
const bookStore = createRemoteStore('/api/missions/book', { ttlMs: 120_000 })

export function useMissions() {
  return store.use().data
}

export function useMissionsBook() {
  return bookStore.use().data
}

export function refreshMissions() {
  return Promise.all([store.refresh(), bookStore.refresh()])
}

// The news sheet's "See the missions" asks the gate to open its sheet.
let openAsked = false
const openers = new Set()
export function askMissionsOpen() {
  openAsked = true
  openers.forEach(fn => fn())
}
/** Whether an open was asked since the gate last looked; reading takes it. */
export function takeMissionsOpen() {
  const asked = openAsked
  openAsked = false
  return asked
}
export function onMissionsOpen(fn) {
  openers.add(fn)
  return () => openers.delete(fn)
}

export function seedMissions(data) {
  store.seed(data)
}

export function seedMissionsBook(data) {
  bookStore.seed(data)
}

/** The learner these missions belong to has signed out (stores/account). */
export function forgetMissions() {
  store.forget()
  bookStore.forget()
}

/**
 * Collect one reward (POST /api/missions/claim): resolves to what was
 * paid, or null when there was nothing to collect (a tap another tab or
 * the settlement of an earlier day got to first). The missions' answer
 * rides back with it, so the pill and the sheet redraw on the same
 * reply; the balance and the level are asked again behind it.
 */
export async function claimMission(session, scope, kind) {
  const r = await apiJson('/api/missions/claim', session, { method: 'POST', body: JSON.stringify({ scope, kind }) })
  if (r.missions) store.seed(r.missions)
  if (r.paid) {
    bookStore.refresh()
    // Asked for when a reward was paid, not at load: the gate mounts this
    // store whatever the learner does, and a store it never moves should
    // not pull two more into its import (nor a test's partial mock of them).
    Promise.all([import('./credits'), import('./profileSummary')])
      .then(([credits, summary]) => { credits.refreshCredits(); summary.refreshSummary() })
      .catch(() => {})
  }
  return r.paid
}
