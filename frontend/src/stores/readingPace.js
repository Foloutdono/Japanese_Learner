import { useEffect, useSyncExternalStore } from 'react'
import { useProfileSummary, refreshSummary } from './profileSummary'
import { apiJson } from '../lib/api'
import { DEFAULT_READING_PACE, isReadingPace } from '../domain/readingPace'

// ── How long the reading exercises leave the text up ──────────────
// The rating bar's shape (stores/ratingScale.js): the profile is the
// source of truth (user_profiles.reading_pace, on the /api/profile
// every screen already fetches), so the pace follows the learner
// between devices, and localStorage mirrors the last answer so the
// first sentence of a run is timed at the learner's pace rather than
// at the standard one and then corrected under them.

const KEY = 'jl.readingPace'

function read() {
  try {
    const stored = localStorage.getItem(KEY)
    return isReadingPace(stored) ? stored : null
  } catch {
    // Private mode, blocked site data — a missing mirror is not an error.
    return null
  }
}

let mirrored = read()

// The pace just chosen, until the profile says it back: the run's chip
// (components/reading/ReadingPieces.jsx, PaceChip) is pressed to see
// the clock change, and waiting on the save and the profile's refetch
// made each press a beat late -- and a second press in that beat
// counted from the old pace. Cleared once the refetch lands, or on a
// failed save, which falls back to what the profile holds.
let pending = null
const listeners = new Set()
const subscribe = l => { listeners.add(l); return () => listeners.delete(l) }
const getPending = () => pending
function setPending(id) {
  pending = id
  listeners.forEach(l => l())
}

// One save at a time, in the order pressed, so three quick presses
// cannot land on the server as the second one.
let saving = Promise.resolve()

function mirror(id) {
  if (id === mirrored) return
  mirrored = id
  try { localStorage.setItem(KEY, id) } catch { /* see read() */ }
}

/** 'standard' | 'relaxed' | 'slow' | 'untimed' — never null. */
export function useReadingPace() {
  const summary = useProfileSummary()
  const chosen = useSyncExternalStore(subscribe, getPending)
  const served = isReadingPace(summary?.readingPace) ? summary.readingPace : null
  useEffect(() => { if (served) mirror(served) }, [served])
  return chosen ?? served ?? mirrored ?? DEFAULT_READING_PACE
}

/** Write the choice through and refresh the summary every consumer
 *  reads, the mirror first so a reload during the request still comes
 *  back to the pace the learner just picked. */
export function setReadingPace(id, session) {
  mirror(id)
  setPending(id)
  const saved = saving.then(() => apiJson('/api/profile/learning', session, {
    method: 'PATCH',
    body: JSON.stringify({ readingPace: id }),
  }))
  saving = saved.catch(() => {})
  return saved
    .then(() => refreshSummary())
    .finally(() => { if (pending === id) setPending(null) })
}
