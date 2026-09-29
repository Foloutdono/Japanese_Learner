import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { apiJson } from '../lib/api'
import { nativePlatform, requestStoreReview } from '../lib/platform'

// ── 評価 — when a learner is asked about the app (plan 167) ────
// Two halves decide it. WHETHER, and how, is the server's
// (GET /api/rating/prompt, routes/rating.py: enough use to have an
// opinion, and each platform asked the way its store allows). WHEN is
// this module's: a calm moment in a visit that has been a real one --
// back in the chrome after VISIT_REVIEWS cards or more have been
// answered since the app opened, never in a run, never over another
// sheet. So the server is asked at most once a visit, and only by a
// learner who has just been studying.
//
// How it is asked:
//   store  the iOS and Android apps: the store's own review prompt, at
//          once, with nothing of the app's before it -- the one way
//          either store allows (App Review Guideline 5.6.1; Play's
//          in-app review guidelines). The server is told it was
//          requested, so it can space the next one out.
//   sheet  the web: the app's own sheet, components/rating/
//          RatingSheet.jsx.

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

/** 'ios', 'android' or 'web': what the server is told it is asking. */
function platform() {
  const p = nativePlatform()
  return p === 'ios' || p === 'android' ? p : 'web'
}

async function session() {
  const { data } = await supabase.auth.getSession()
  return data?.session ?? null
}

/** A card answered: lib/reviews.js, once the review has landed. */
export function noteReview() { reviews += 1 }

/** Whether a visit has earned the question and not yet asked it. */
export function readyToAsk() {
  return !asked && !asking && !open && reviews >= VISIT_REVIEWS
}

/** Ask the server, then ask the learner the way it says. Resolves to
 *  'store', 'sheet' or null. A failure leaves the visit free to ask
 *  again at the next calm moment. */
export async function askRating() {
  if (!readyToAsk()) return null
  asking = true
  try {
    const s = await session()
    if (!s) return null
    const where = platform()
    const { ask, how } = await apiJson(`/api/rating/prompt?platform=${where}`, s)
    asked = true
    if (!ask) return null
    if (how === 'store') {
      if (await requestStoreReview()) {
        await apiJson('/api/rating', s, {
          method: 'POST',
          body: JSON.stringify({ kind: 'store_prompt', platform: where }),
        }).catch(() => {})
      }
      return 'store'
    }
    open = true
    emit()
    return 'sheet'
  } catch {
    return null
  } finally {
    asking = false
  }
}

export function peekRatingOpen() { return open }
export function useRatingOpen() {
  return useSyncExternalStore(subscribe, () => open, () => false)
}

export function closeRating() {
  open = false
  emit()
}

function lang(l) {
  return l === 'fr' || l === 'en' ? l : null
}

function trimmed(text) {
  return text?.trim() ? text.trim() : null
}

/**
 * The web's sheet answered: `stars` 1-5 with an optional `comment`, or
 * no stars for "not now".
 */
export async function sendRating({ stars = null, comment = null, lang: l = null }) {
  const s = await session()
  if (!s) throw new Error('no session')
  const body = stars
    ? { kind: 'rating', stars, comment: trimmed(comment) }
    : { kind: 'put_off' }
  return apiJson('/api/rating', s, {
    method: 'POST',
    body: JSON.stringify({ ...body, platform: platform(), lang: lang(l) }),
  })
}

/** A message to us from Settings › Help, on any platform at any time. */
export async function sendFeedback(comment, l = null) {
  const s = await session()
  if (!s) throw new Error('no session')
  return apiJson('/api/feedback', s, {
    method: 'POST',
    body: JSON.stringify({ comment: trimmed(comment), platform: platform(), lang: lang(l) }),
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
