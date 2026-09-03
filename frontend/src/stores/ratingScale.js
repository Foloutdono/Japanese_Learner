import { useEffect } from 'react'
import { useProfileSummary, refreshSummary } from './profileSummary'
import { apiJson } from '../lib/api'
import { DEFAULT_RATING_SCALE, RATING_SCALES } from '../domain/ratingScales'

const isScale = id => typeof id === 'string' && Object.hasOwn(RATING_SCALES, id)

// ── Which rating bar to draw ──────────────────────────────────────
// The profile is the source of truth (user_profiles.rating_scale, on
// the /api/profile every screen already fetches), so the choice follows
// the learner between devices rather than living in one browser.
//
// localStorage is a MIRROR of that answer, not a second opinion. The
// summary arrives asynchronously, and the rating bar is rendered — held
// inert — from the moment a study screen mounts, so without a mirror
// the first paint of every session would draw whichever bar the code
// defaults to and then swap the buttons out from under a learner who
// may already be reaching for one. Reading the last known answer
// synchronously makes that flash impossible for everyone except a
// genuinely new browser.

const KEY = 'jl.ratingScale'

function read() {
  try {
    const stored = localStorage.getItem(KEY)
    return isScale(stored) ? stored : null
  } catch {
    // Private mode, blocked site data — a missing mirror is not an error.
    return null
  }
}

let mirrored = read()

function mirror(id) {
  if (id === mirrored) return
  mirrored = id
  try { localStorage.setItem(KEY, id) } catch { /* see read() */ }
}

/** 'simple' | 'full' — never null, so callers never branch on unknown. */
export function useRatingScale() {
  const summary = useProfileSummary()
  const served = isScale(summary?.ratingScale) ? summary.ratingScale : null
  useEffect(() => { if (served) mirror(served) }, [served])
  return served ?? mirrored ?? DEFAULT_RATING_SCALE
}

/** Write the choice through and refresh the summary every consumer
 *  reads. The mirror is updated first so a reload during the request
 *  still comes back to the bar the learner just picked. */
export function setRatingScale(id, session) {
  mirror(id)
  return apiJson('/api/profile/learning', session, {
    method: 'PATCH',
    body: JSON.stringify({ ratingScale: id }),
  }).then(() => refreshSummary())
}
