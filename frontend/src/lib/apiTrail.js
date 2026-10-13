// ── 足跡 — the requests that failed ─────────────────────────────────
// `api_error` was declared in the trail's closed set from the start and
// sent by nothing. lib/api.js says THAT a request failed (5xx, or no
// answer at all -- never a 4xx the endpoint meant); this file decides
// what is recorded of it, and App.jsx wires the two once.
import { onApiFailure } from './apiFailure'
import { apiArea } from './routePattern'
import { track } from './track'

// A server that is down fails every screen at once, so one row per
// (area, status) a minute says as much as a hundred.
const GAP_MS = 60_000
const last = new Map()

/**
 * The AREA of the path (`/api/decks`, not `/api/decks/<id>`), never the
 * path, and never the trail's own batch: a flush that fails must not
 * queue a row about itself.
 */
export function recordApiFailure({ path, status }) {
  const area = apiArea(path)
  if (!area || area === '/api/events') return
  const key = `${area}:${status}`
  const now = Date.now()
  if (now - (last.get(key) ?? -Infinity) < GAP_MS) return
  last.set(key, now)
  track('api_error', { path: area, status })
}

export function watchApiFailures() {
  onApiFailure(recordApiFailure)
}

// For tests: the dedupe window is module state.
export function _reset() {
  last.clear()
}
