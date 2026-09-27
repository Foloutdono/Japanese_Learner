import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

// ── 実践の停車駅 — one stop of a practice platform, for its page (plan 158) ──
// /api/practice/stop/{platform}?stop=: what the learner has done at one
// stop of a practice platform -- a grade, a frequency tier, their own
// cards -- for the page the desk's practice station stands beside its
// list: the record (done, right, of, the last time), the newest misses
// (or, for comprehension, the newest texts) and the grade's grammar
// points already studied at Learn.
//
// Keyed on the path, like stores/stationSamples: a station walks its
// stops by replacing the URL, and each stop's answer is kept, so going
// back to a stop draws its last answer at once. Unlike the samples it
// is the learner's own and it changes when a run ends, so every mount
// asks again and draws the kept answer meanwhile. Read on the desk only:
// a phone never passes `enabled`.
const answers = new Map()
const inflight = new Set()
const listeners = new Set()
// Which account the answers belong to (stores/remote's rule): a request
// that lands after a sign-out must not refill the map.
let generation = 0

function notify() {
  listeners.forEach(fn => fn())
}

function ask(path) {
  if (inflight.has(path)) return
  inflight.add(path)
  const gen = generation
  supabase.auth.getSession()
    .then(({ data }) => (data?.session ? apiFetch(path, data.session) : Promise.reject()))
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(body => {
      if (gen !== generation) return
      answers.set(path, body)
      notify()
    })
    // Quiet: the page draws its figures as "—" and its lists empty
    // without it, and the next mount asks again.
    .catch(() => {})
    .finally(() => { if (gen === generation) inflight.delete(path) })
}

function subscribe(fn) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function stopPath(platform, stop) {
  return stop ? `/api/practice/stop/${platform}?stop=${encodeURIComponent(stop)}` : null
}

/** {stop, record, misses, known} for one stop of a practice platform,
 *  or null while it is on its way (or when `enabled` is false). */
export function usePracticeStop(platform, stop, enabled = true) {
  const path = stopPath(platform, stop)
  useEffect(() => { if (enabled && path) ask(path) }, [enabled, path])
  const data = useSyncExternalStore(subscribe, () => (path ? answers.get(path) ?? null : null))
  return enabled ? data : null
}

/** The learner these answers belong to has signed out (stores/account). */
export function forgetPracticeStops() {
  generation += 1
  answers.clear()
  inflight.clear()
  notify()
}
