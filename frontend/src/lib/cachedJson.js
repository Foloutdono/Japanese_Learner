import { useEffect, useState } from 'react'
import { apiJson } from './api'

// ── One answer per path, shared (plan 211) ─────────────────────
// A learner walking a selector fast (the frequency plate's 100 / 200 /
// 500 / 1000, the deck's words or the ones beyond, a radical, a tier)
// used to send a request per step and per figure beside it: a desk
// station's three to five platforms each asked their own stats, and
// every return to a stop asked them all again. The server now queues a
// learner past a few requests at once and refuses a flood, so the
// client stops making one: an answer is asked once per learner and
// path, shared by every caller while it is on its way, and kept for a
// while after.
//
//   useCachedJson(path, session, { ttlMs })   a hook: undefined while
//       the CURRENT path's answer is on its way (never another path's),
//       null when it failed, else the body. No path asks nothing.
//   cachedJson(path, session, { ttlMs })      the same, as a promise
//       that rejects on a failure.
//   invalidateCachedJson(prefix)              the answers under these
//       paths are stale (a level was changed).
//   invalidateMine()                          the learner's own figures
//       are stale (a review has landed).
//   lastCachedJson(path, session)             the last answer kept for
//       the path, however old, or undefined: what a gate draws on its
//       first frame while it asks again (plan 291).
//   keepCachedJson(path, session, body)       an answer a screen asked
//       for itself, kept for the next visit's first frame.
//
// A gate (Learn's shelf, the Dictionary's opening page, Profile's
// boards) asks again on every visit and draws the last answer kept
// meanwhile, which lib/warm.js asks for ahead of the first visit, with
// `ttlMs: 0`: whatever is on its way is shared, anything else asked anew.
// Asked again on every read, such an answer is never taken for a fresh
// figure, so a review does not drop it.
//
// Kept under the learner and the path, the shape of
// lib/dictionaryLookup: an answer carries the learner's own figures, so
// TTL_MS is short by default, and content the same for every learner
// passes a longer one. Only answers are kept; a failure is asked again
// by the next caller. Bounded, the least recently used going first.
//
// The cache is per account and a sign-out does not reload the page, so
// stores/account drops it (forgetCachedJson), and a request asked for
// the leaving learner that lands afterwards is not kept.

export const TTL_MS = 60_000
// For an answer the same for every learner (the tiers' ranges, the
// themes): it changes with a deploy, not with a run.
export const CONTENT_TTL_MS = 10 * 60_000
// For the learner's own figures beside a stop. A review moves them, so
// lib/reviews drops every answer kept this briefly (invalidateMine).
export const MINE_TTL_MS = 30_000
const MAX = 200
const cache = new Map()
let generation = 0

function keyOf(session, path) {
  return `${session?.user?.id ?? ''} ${path}`
}

// An entry is good while on its way, and for the caller's TTL after.
function fresh(entry, ttlMs) {
  return entry && (!entry.done || Date.now() - entry.at < ttlMs)
}

// Most recently used last, so the first key is the one to drop.
function touch(key, entry) {
  cache.delete(key)
  cache.set(key, entry)
  while (cache.size > MAX) cache.delete(cache.keys().next().value)
}

function hit(key, ttlMs) {
  const entry = cache.get(key)
  if (!fresh(entry, ttlMs)) return null
  touch(key, entry)
  return entry
}

/** The answer for this path: the one in hand, the one on its way, or a
 *  new request. Rejects when the request fails, and keeps nothing new
 *  then: the answer before it, if any, stays the last one kept. */
export function cachedJson(path, session, { ttlMs = TTL_MS } = {}) {
  const key = keyOf(session, path)
  const kept = hit(key, ttlMs)
  if (kept) return kept.promise
  const gen = generation
  // An answer past its TTL, still the last one kept while this is asked.
  const before = cache.get(key)
  const entry = {
    at: Date.now(), done: false, value: undefined, promise: null, last: before?.value,
    mine: ttlMs > 0 && ttlMs <= MINE_TTL_MS,
  }
  entry.promise = apiJson(path, session).then(
    body => {
      // A sign-out or an invalidation since: hand the answer to whoever
      // asked, but keep nothing.
      if (gen === generation && cache.get(key) === entry) {
        entry.done = true
        entry.at = Date.now()
        entry.value = body
      }
      return body
    },
    err => {
      if (cache.get(key) === entry) {
        if (before?.done) cache.set(key, before)
        else cache.delete(key)
      }
      throw err
    },
  )
  touch(key, entry)
  return entry.promise
}

/** Keep an answer a screen asked for itself (a gate's, above). */
export function keepCachedJson(path, session, body) {
  if (body === undefined) return
  touch(keyOf(session, path), {
    at: Date.now(), done: true, value: body, promise: Promise.resolve(body), last: undefined, mine: false,
  })
}

/** The last answer kept for this path, however old, or undefined. */
export function lastCachedJson(path, session) {
  const entry = cache.get(keyOf(session, path))
  return entry?.done ? entry.value : entry?.last
}

// The body already in hand for this path, or undefined.
function peek(key, ttlMs) {
  const entry = cache.get(key)
  return entry?.done && fresh(entry, ttlMs) ? entry.value : undefined
}

export function useCachedJson(path, session, { ttlMs = TTL_MS } = {}) {
  const key = path ? keyOf(session, path) : null
  const [got, setGot] = useState(() => {
    const value = key ? peek(key, ttlMs) : undefined
    return value === undefined ? null : { key, body: value }
  })
  useEffect(() => {
    if (!path) return undefined
    let live = true
    cachedJson(path, session, { ttlMs }).then(
      body => { if (live) setGot(prev => (prev?.key === key && prev.body === body ? prev : { key, body })) },
      () => { if (live) setGot({ key, body: null }) },
    )
    return () => { live = false }
  }, [key, path, session, ttlMs])
  if (!key) return undefined
  if (got?.key === key) return got.body
  // The path has just changed: an answer in hand is drawn on this
  // frame, with no wait between; anything else is a wait.
  return peek(key, ttlMs)
}

/** Drop every answer whose path starts with `prefix` (all, without one):
 *  the next caller asks again. */
export function invalidateCachedJson(prefix = '') {
  // A request on its way under it is dropped too: what it brings back
  // was asked before the change, and is handed over but not kept.
  for (const key of [...cache.keys()]) {
    if (key.slice(key.indexOf(' ') + 1).startsWith(prefix)) cache.delete(key)
  }
}

/** Drop every answer kept as the learner's own (MINE_TTL_MS or less). */
export function invalidateMine() {
  for (const [key, entry] of [...cache]) {
    if (entry.mine) cache.delete(key)
  }
}

/** The learner these answers belong to has signed out (stores/account). */
export function forgetCachedJson() {
  generation += 1
  cache.clear()
}
