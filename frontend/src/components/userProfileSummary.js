import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { apiFetch } from '../api'
import { xpThreshold } from './xpCurve'

// ── Level/XP summary, shared by TopBar's profile ring, the mobile
// level bar, and the burger menu's profile row ──────────────────
// A small shared store rather than one fetch per consumer: `cache` is
// the last known summary, `listeners` are every currently-mounted
// hook instance's setState. Real fetches are TTL'd so navigating
// between screens (which remounts these components constantly)
// doesn't refetch on every single navigation; `applyXpGain` pushes an
// immediate optimistic update to every listener in between fetches,
// so the level bar/ring visibly move right after a review instead of
// sitting frozen until the next real fetch lands.
let cache = null
let cacheAt = 0
const TTL_MS = 30_000
const listeners = new Set()

function setCache(data, { real = false } = {}) {
  cache = data
  // Only a genuine backend fetch resets the TTL clock — an optimistic
  // bump must never postpone the next real fetch, or a wrong client-
  // side guess (see applyXpGain) could linger indefinitely.
  if (real) cacheAt = Date.now()
  listeners.forEach(fn => fn(cache))
}

function fetchSummary() {
  return supabase.auth.getSession()
    .then(({ data }) => {
      const session = data?.session
      if (!session) return Promise.reject()
      return apiFetch('/api/profile', session)
    })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(data => setCache(data, { real: true }))
    // Silent fail — this is a background HUD element, not worth a
    // visible error state the way the full Profile screen's fetch is.
    .catch(() => {})
}

export function useProfileSummary() {
  const [summary, setSummary] = useState(cache)

  useEffect(() => {
    listeners.add(setSummary)
    if (!cache || Date.now() - cacheAt >= TTL_MS) fetchSummary()
    return () => { listeners.delete(setSummary) }
  }, [])

  return summary
}

// Call right after a review response comes back (xp_earned, from
// either srs.review() or a card's precomputed review_preview) to
// move the ring/level bar immediately instead of waiting on the next
// cached fetch, and to find out whether this particular gain crosses
// into a new level.
//
// This deliberately does NOT take a `leveledUp`/`newLevel` from the
// caller anymore. A batch's review_preview (see srs.py's
// preview_reviews_bulk) computes those once, at batch-fetch time,
// against whatever the user's lifetime XP was *then* — the same
// stale baseline for every card in the batch (up to 10-25 of them).
// It has no way to know about any other card in that same batch
// that's already been rated since, because the actual review POST is
// fire-and-forget now and its response is never read. So a level-up
// reached through the *combined* XP of several reviews in a row —
// the normal case, not an edge case — never gets flagged true by any
// single card's own preview, and trusting it silently drops both the
// celebration toast and the level-bar update right when they should
// fire.
//
// `cache` is the one running total that's actually kept accurate
// across every gain (it's this very function that keeps it that
// way), so the threshold check belongs here, against the live cache,
// not against a number computed once at fetch time. `xpForNext` is
// walked forward in a loop (not a single if) in case one gain is
// large enough to cross more than one threshold at once.
export function applyXpGain({ amount }) {
  if (!cache || !amount) return { leveledUp: false, newLevel: cache?.level }

  let xp = cache.xp + amount
  let level = cache.level
  let xpPrevLevel = cache.xpPrevLevel
  let xpForNext = cache.xpForNext
  let leveledUp = false

  while (xpForNext != null && xp >= xpForNext) {
    level += 1
    xpPrevLevel = xpForNext
    xpForNext = xpThreshold(level + 1)
    leveledUp = true
  }

  setCache({ ...cache, xp, level, xpPrevLevel, xpForNext })
  return { leveledUp, newLevel: level }
}