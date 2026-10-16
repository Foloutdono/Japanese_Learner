// ── 滞在と利用 — how long a screen held someone, and what they used on it ──
//
// Plan 218. screen_view says a screen was ARRIVED at; nothing said how
// long it was looked at, so "where do learners spend their time" had no
// answer. This module keeps the screen that is up, times it with
// lib/dwell.js (engaged time: a hidden tab stops the clock) and sends
// `screen_leave` with that time when the route changes or the page is
// hidden. Coming back to the tab starts a new stretch on the same
// screen, without a second screen_view: views count arrivals, leaves
// count time, and the sum of a visit's leaves is how long it really
// lasted.
//
// It also counts the small features while the screen is up
// (countUse('speech', 'play')) and sends one `feature_use` per
// (feature, action) when the screen is left, `n` the count. One row per
// screen rather than one per press: a run that plays forty readings is
// one row saying forty, not forty rows.
//
// A practice run (lib/runTrail.js) is ended when its screen is left.
import { stopwatch } from './dwell'
import { track } from './track'
import { beforeHide } from './pageHide'
import { endOpenRun } from './runTrail'

let current = null   // { route, tab, watch }
let uses = new Map() // `${feature}:${action}` -> n

/** The screen that is up now: App.jsx's Trail, on every pathname. */
export function enterScreen(route, tab) {
  if (current && current.route === route) return
  leaveScreen({ ended: true })
  current = { route, tab: tab ?? null, watch: stopwatch() }
}

/**
 * Close the stretch on the current screen: its dwell and its counts.
 * `ended` (a route change, the page going away) also forgets the
 * screen; a mere hide keeps it, to resume on the tab's return.
 */
export function leaveScreen({ ended = false } = {}) {
  if (!current) return
  const ms = current.watch.read()
  sendUses(current.route)
  // A screen up for less than a frame is a redirect passing through,
  // not a screen anyone saw.
  if (ms > 0) track('screen_leave', { route: current.route, tab: current.tab, ms })
  if (ended) {
    current.watch.stop()
    endOpenRun(current.route)
    current = null
  } else {
    current.watch.lap()
  }
}

function sendUses(route) {
  for (const [key, n] of uses) {
    const [feature, action] = key.split(':')
    track('feature_use', { feature, action, route, n })
  }
  uses = new Map()
}

/** One use of a small feature on the screen that is up. */
export function countUse(feature, action) {
  // No screen up is a path routePattern did not know, which records
  // nothing; its uses go with it rather than onto the next screen.
  if (!current) return
  const key = `${feature}:${action}`
  uses.set(key, (uses.get(key) ?? 0) + 1)
}

// The page hidden: the stretch ends, the screen stays. The page gone
// (pagehide): both end, and an open practice run with them.
beforeHide(kind => leaveScreen({ ended: kind === 'pagehide' }))

// ── For tests ─────────────────────────────────────────────────────
export function _current() { return current && { route: current.route, tab: current.tab } }
export function _uses() { return new Map(uses) }
export function _resetScreen() {
  current?.watch.stop()
  current = null
  uses = new Map()
}
