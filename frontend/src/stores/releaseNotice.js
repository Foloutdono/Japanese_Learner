import { useSyncExternalStore } from 'react'

// ── 工事 — a release is coming (plan 262) ────────────────────
// The daily release restarts the one-worker backend, and for a few
// minutes requests hang or fail with nothing saying why. The release
// workflow announces itself first (backend/core/release_notice.py), and
// every /api answer then carries the minute of the push in
// `X-Release-At` (epoch seconds). lib/api.js hands each answer here;
// this store keeps the one fact and flips `due` when the minute comes,
// so the note can say "at 05:27" and then "under way".
//
// An answer without the header (and below 500) means the server has
// none to announce — the new build, or a release cleared — and takes
// the note down. A 5xx or no answer at all is the restart itself, so
// it leaves the note standing. A notice the server never took down
// stops being shown GRACE_MS after its minute, as the server stops
// sending it.
export const GRACE_MS = 30 * 60 * 1000

let at = null              // ms, the announced minute
let due = false            // the minute has come
let dismissedFor = null    // the `at` the learner closed the note on
let snapshot = null        // null | { at, due }, what the note reads
let timers = []
const listeners = new Set()

function publish() {
  snapshot = at === null || dismissedFor === at ? null : { at, due }
  listeners.forEach(fn => fn())
}

function set(next) {
  if (next === at) return
  timers.forEach(clearTimeout)
  timers = []
  at = next
  due = false
  if (at !== null) {
    const now = Date.now()
    if (now > at + GRACE_MS) {
      at = null
    } else {
      if (now >= at) due = true
      else timers.push(setTimeout(() => { due = true; publish() }, at - now))
      timers.push(setTimeout(() => set(null), at + GRACE_MS - now))
    }
  }
  publish()
}

export const releaseNotice = {
  /** Every answer the request path receives (lib/api.js send). */
  seen(response) {
    const raw = response?.headers?.get?.('X-Release-At')
    const seconds = Number(raw)
    if (raw && Number.isFinite(seconds) && seconds > 0) set(seconds * 1000)
    else if (typeof response?.status === 'number' && response.status < 500) set(null)
  },
  /** The learner has read it: this release is not announced again. */
  dismiss() {
    dismissedFor = at
    publish()
  },
  /** null, or { at, due }: what the note reads. */
  current() {
    return snapshot
  },
  /** Tests only. */
  reset() {
    dismissedFor = null
    set(null)
  },
}

export function useReleaseNotice() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    releaseNotice.current,
    () => null,
  )
}
