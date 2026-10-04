import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

// ── A small shared store over one GET ─────────────────────────
// The third copy of stores/profileSummary's shape was about to be
// written (the tab bar's due badge, the HUD's goal status), so the
// shape is a factory now: one cached answer, a TTL so remounting
// consumers do not refetch on every navigation, a set of listeners,
// and a `failed` flag so a screen drawing a wait can tell "not yet"
// from "not coming". profileSummary keeps its own code because it
// carries the optimistic XP maths on top; everything else that only
// needs "the last answer from /api/x" comes from here.
//
//   const today = createRemoteStore('/api/today', { ttlMs: 60_000 })
//   today.use()      -> { data, failed, at }   (a hook; `at` is when the
//                       answer arrived, so a consumer that needs a clock
//                       reading can take the answer's own instead of
//                       reading Date.now() in render)
//   today.refresh()  -> Promise, bypassing the TTL
//   today.seed(data) -> for the dev workbenches; never resets the TTL
//   today.forget()   -> the account that answered has left (stores/account)
export function createRemoteStore(path, { ttlMs = 30_000 } = {}) {
  let cache = null
  let cacheAt = 0
  // Which account the cache belongs to, as a count of the times one
  // has left (forget below). A request asked on behalf of the previous
  // learner can land after the next one has signed in -- the sign-out
  // does not abort it -- and without this it would quietly refill the
  // cache with somebody else's answer.
  let generation = 0
  // When a seed was planted (the workbenches, the tests): `at` falls
  // back to it, so a consumer taking the answer's own clock reading
  // has one; the TTL clock itself stays untouched by a seed.
  let seededAt = 0
  let failed = false
  let inflight = null
  const listeners = new Set()

  function notify() {
    listeners.forEach(fn => fn())
  }

  function fetchOnce() {
    if (inflight) return inflight
    const gen = generation
    inflight = supabase.auth.getSession()
      .then(({ data }) => {
        const session = data?.session
        if (!session) return Promise.reject()
        return apiFetch(path, session)
      })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        if (gen !== generation) return
        cache = data
        cacheAt = Date.now()
        failed = false
        notify()
      })
      // Quiet by design: these feed chrome, and a broken HUD element
      // is worse than its absence. The flag is what a consumer that
      // draws a wait reads instead.
      .catch(() => { if (gen === generation) { failed = true; notify() } })
      // Only if nobody has started a fresh one since: forget() drops
      // the in-flight request along with the answer it was for.
      .finally(() => { if (gen === generation) inflight = null })
    return inflight
  }

  function use() {
    const [state, setState] = useState(() => ({ data: cache, failed, at: cacheAt || seededAt }))
    useEffect(() => {
      const sync = () => setState(prev => (
        prev.data === cache && prev.failed === failed && prev.at === (cacheAt || seededAt)
          ? prev
          : { data: cache, failed, at: cacheAt || seededAt }
      ))
      listeners.add(sync)
      // An answer that landed between the first render and this effect
      // notified nobody: take it now, or a fresh cache would keep this
      // consumer on its first render's null until the next answer.
      sync()
      if (!cache || Date.now() - cacheAt >= ttlMs) fetchOnce()
      return () => { listeners.delete(sync) }
    }, [])
    return state
  }

  return {
    use,
    refresh: fetchOnce,
    seed(data) { cache = data; seededAt = Date.now(); failed = false; notify() },
    /**
     * Drop the answer: the learner it belongs to has signed out.
     *
     * Every one of these caches is per-account, and signing out does
     * not reload the page -- the next learner's app is the same
     * modules with the same module state. Without this, an account
     * created a moment after another signed out reads the last one's
     * queue, balance and standing until each TTL runs out (five
     * minutes, for the journey). See stores/account.js.
     */
    forget() {
      generation += 1
      inflight = null
      cache = null
      cacheAt = 0
      seededAt = 0
      failed = false
      notify()
    },
    /** The last answer, outside React (a store mutating another). */
    peek: () => cache,
  }
}
