import { apiJson } from '../lib/api'
import { createRemoteStore } from './remote'

// ── 縁 — the referral, as the screens read it (plan 332) ──────────
// GET /api/referral: the learner's own parrain (or the door to name one),
// the learners they sponsor and the requests waiting on them, their link,
// and what each step pays. Read by the holder's door, and by Today's
// notice only when GET /api/profile's `referralNotice` says there is
// something to say, so a learner the referral has nothing for asks nothing.
// Every write answers with the referral again, which redraws on the reply.
const store = createRemoteStore('/api/referral', { ttlMs: 60_000 })

export function useReferral() {
  return store.use().data
}

export function seedReferral(data) {
  store.seed(data)
}

export function refreshReferral() {
  return store.refresh()
}

/** The learner this referral belongs to has signed out (stores/account). */
export function forgetReferral() {
  store.forget()
}

// The balance, the level and the gate's flag, asked again once something
// was paid or answered. Imported when needed, as the missions' claim does:
// a store the gate mounts should not pull two more into its import.
function refreshAround() {
  Promise.all([import('./credits'), import('./profileSummary')])
    .then(([credits, summary]) => { credits.refreshCredits(); summary.refreshSummary() })
    .catch(() => {})
}

async function post(path, session, body = {}) {
  return apiJson(path, session, { method: 'POST', body: JSON.stringify(body) })
}

/** Name a parrain: rejects with the server's code (ApiError.code). */
export async function chooseSponsor(session, username) {
  store.seed(await post('/api/referral/choose', session, { username }))
  refreshAround()
}

/** A parrain accepts or refuses a learner who named them. */
export async function answerRequest(session, username, accept) {
  store.seed(await post('/api/referral/answer', session, { username, accept }))
  refreshAround()
}

/** A parrain lets a quiet filleul go. */
export async function releaseFilleul(session, username) {
  store.seed(await post('/api/referral/release', session, { username }))
}

/** Collect what one filleul has earned: what was paid, or null. */
export async function claimReferral(session, username) {
  const r = await post('/api/referral/claim', session, { username })
  if (r.referral) store.seed(r.referral)
  if (r.paid) refreshAround()
  return r.paid
}

/** The filleul has been shown that their reward was paid. */
export async function toldReferral(session) {
  await post('/api/referral/told', session)
  store.refresh()
  refreshAround()
}
