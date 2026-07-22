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

// Call right after a review response comes back (xp_earned /
// leveled_up / new_level, exactly what srs.review() already returns)
// to move the ring/level bar immediately instead of waiting on the
// next cached fetch. On a level-up, xpPrevLevel/xpForNext are
// recomputed from the client-side curve mirror so the bar reflects
// the new level's span (with any XP earned past the threshold
// already carried over) rather than snapping to 0% or 100%.
export function applyXpGain({ amount, leveledUp, newLevel }) {
  if (!cache || !amount) return

  const xp = cache.xp + amount

  if (leveledUp && typeof newLevel === 'number') {
    setCache({
      ...cache,
      xp,
      level: newLevel,
      xpPrevLevel: xpThreshold(newLevel),
      xpForNext: xpThreshold(newLevel + 1),
    })
  } else {
    setCache({ ...cache, xp })
  }
}