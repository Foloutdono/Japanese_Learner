import { api } from './origin'
import { supabase } from './supabase'

// ── 記録 — the funnel, reported ────────────────────────────────
// The client half of POST /api/events (backend/routes/events.py). Two
// funnels run through here and nothing else does: the boarding, and
// the paywall. It is NOT a general analytics layer — the backend's
// allowlist refuses any name that is not one of the seven, so a stray
// logEvent('button_clicked') is a 422 rather than a new column in a
// table nobody pruned.
//
// Three properties this has to have, in order:
//
//   1. It never blocks the UI. Every call returns immediately; the
//      flush is a promise nobody awaits and every failure is dropped.
//      A funnel that can break a paywall is worse than no funnel.
//   2. It never throws. Callers sit inside onClick handlers and
//      render paths; an unhandled rejection from a metrics call would
//      surface as an error boundary on a screen that worked fine.
//   3. It survives the page going away. Onboarding abandonment is the
//      single most valuable thing this measures, and it happens
//      exactly when the tab closes — so a pending batch is flushed on
//      the way out with `keepalive`.
//
// Events are queued and flushed together because the boarding fires
// one per answered question: eleven separate POSTs during a flow whose
// whole point is to feel like a train pulling out is the wrong trade.
const FLUSH_MS = 1500
const MAX_BATCH = 25       // backend/routes/events.py's _MAX_BATCH

let queue = []
let timer = null

async function post(events, keepalive = false) {
  if (!events.length) return
  try {
    // The session is read here rather than passed in: these calls come
    // from sheets and steps that have no reason to hold one, and a
    // funnel that makes every call site thread a session through is a
    // funnel that stops being added to.
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    await fetch(api('/api/events'), {
      method: 'POST',
      keepalive,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events }),
    })
  } catch {
    // Deliberately silent. See (2) above.
  }
}

/** Send whatever is queued now. Called on the timer and on page hide. */
export function flushEvents(keepalive = false) {
  if (timer) { clearTimeout(timer); timer = null }
  const batch = queue
  queue = []
  void post(batch, keepalive)
}

/**
 * Record one funnel event. Fire-and-forget: returns nothing useful and
 * never rejects.
 *
 * @param {string} name  one of backend/routes/events.py's ALLOWED
 * @param {object} props shallow scalars only — { source } or { step }
 */
export function logEvent(name, props = {}) {
  queue.push({ name, props })
  if (queue.length >= MAX_BATCH) { flushEvents(); return }
  if (!timer) timer = setTimeout(() => flushEvents(), FLUSH_MS)
}

// The tab going away takes the queue with it unless it is spent here.
// `visibilitychange` rather than `unload`, which iOS Safari does not
// fire for a backgrounded tab — the case that matters most, because a
// learner who abandons the boarding usually does it by leaving.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents(true)
  })
}

/** Drop anything queued without sending it. Tests only. */
export function __resetEvents() {
  if (timer) { clearTimeout(timer); timer = null }
  queue = []
}
