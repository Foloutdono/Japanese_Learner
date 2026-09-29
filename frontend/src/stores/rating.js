import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { apiJson } from '../lib/api'
import { nativePlatform } from '../lib/platform'

// ── 評価 — when the rating sheet opens (plan 167) ─────────────
// Two halves decide it. WHETHER this learner is asked is the server's
// (GET /api/rating/prompt, routes/rating.py: enough use to have an
// opinion, never twice, "not now" a snooze). WHEN is this module's: a
// calm moment in a visit that has been a real one -- back in the chrome
// after VISIT_REVIEWS cards or more have been answered since the app
// opened, never in a run, never over another sheet. So the server is
// asked at most once a visit, and only by a learner who has just been
// studying. components/rating/RatingSheet.jsx draws it.

/** Cards answered in this visit before the question is worth asking. */
export const VISIT_REVIEWS = 10

let reviews = 0      // cards answered since the app opened (lib/reviews.js)
let asked = false    // the server has answered this visit
let asking = false
let open = false
const listeners = new Set()

function emit() { listeners.forEach(fn => fn()) }
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** A card answered: lib/reviews.js, once the review has landed. */
export function noteReview() { reviews += 1 }

/** Whether a visit has earned the question and not yet asked it. */
export function readyToAsk() {
  return !asked && !asking && !open && reviews >= VISIT_REVIEWS
}

/** Ask the server, and open the sheet if it says so. A failure leaves
 *  the visit free to ask again at the next calm moment. */
export async function askRating() {
  if (!readyToAsk()) return false
  asking = true
  try {
    const { data } = await supabase.auth.getSession()
    const session = data?.session
    if (!session) return false
    const { ask } = await apiJson('/api/rating/prompt', session)
    asked = true
    if (ask) {
      open = true
      emit()
    }
    return Boolean(ask)
  } catch {
    return false
  } finally {
    asking = false
  }
}

export function useRatingOpen() {
  return useSyncExternalStore(subscribe, () => open, () => false)
}

export function closeRating() {
  open = false
  emit()
}

/**
 * POST /api/rating: `stars` 1-5 with an optional `comment`, or stars
 * null for "not now". Resolves to the server's body ({ ok, store }).
 */
export async function sendRating({ stars, comment = null, lang = null }) {
  const { data } = await supabase.auth.getSession()
  const session = data?.session
  if (!session) throw new Error('no session')
  const platform = nativePlatform()
  return apiJson('/api/rating', session, {
    method: 'POST',
    body: JSON.stringify({
      stars,
      comment: comment?.trim() ? comment.trim() : null,
      platform: ['ios', 'android'].includes(platform) ? platform : 'web',
      lang: lang === 'fr' || lang === 'en' ? lang : null,
    }),
  })
}

/** For tests: a visit that has not begun. */
export function resetRating() {
  reviews = 0
  asked = false
  asking = false
  open = false
  emit()
}
