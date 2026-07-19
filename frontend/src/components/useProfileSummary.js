import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { apiFetch } from '../api'

// ── Level/XP summary, shared by TopBar's profile ring and mobile
// level bar ──────────────────────────────────────────────────
// Both just need { level, xp, xpPrevLevel, xpForNext } from
// /api/profile — not the goals/badges/leaderboard the full Profile
// screen fetches. Module-level cache (with a short TTL) so navigating
// between screens — which remounts TopBar every time — doesn't fire a
// fresh request on every single navigation.
let cache = null
let cacheAt = 0
const TTL_MS = 30_000

export function useProfileSummary() {
  const [summary, setSummary] = useState(cache)

  useEffect(() => {
    if (cache && Date.now() - cacheAt < TTL_MS) {
      setSummary(cache)
      return
    }

    let cancelled = false

    supabase.auth.getSession()
      .then(({ data }) => {
        const session = data?.session
        if (!session) return Promise.reject()
        return apiFetch('/api/profile', session)
      })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        if (cancelled) return
        cache = data
        cacheAt = Date.now()
        setSummary(data)
      })
      // Silent fail — this is a background HUD element, not worth a
      // visible error state the way the full Profile screen's fetch is.
      .catch(() => {})

    return () => { cancelled = true }
  }, [])

  return summary
}
