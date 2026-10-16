// ── The page going away, and what must be queued before it ───────────
//
// lib/track.js flushes when the page is hidden or closed. Whatever has
// to be in THAT flush registers here: the screen's dwell and its feature
// counts (lib/screenTrail.js), the page's vitals (lib/vitals.js). track.js
// runs these, in order, and then flushes -- listeners of their own would
// fire after the flush had already taken the queue, leaving the last
// screen of a visit to the next visit (plan 215).
//
// A module of its own, not an export of track.js, so the many tests that
// mock track.js with `{ track }` alone can still import what registers.
const hooks = new Set()

/** Run `fn(kind)` just before the flush a page hide triggers; kind is
 *  'hidden' or 'pagehide'. Returns the unsubscribe. */
export function beforeHide(fn) {
  hooks.add(fn)
  return () => hooks.delete(fn)
}

/** track.js's page listeners call this, then flush. */
export function runHideHooks(kind) {
  for (const fn of hooks) {
    try { fn(kind) } catch { /* one hook's failure must not lose the flush */ }
  }
}
