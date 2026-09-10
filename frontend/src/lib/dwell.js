// ── 滞在 — how long they actually stayed ───────────────────────
// A stopwatch that stops while the tab is not being looked at.
//
// Wall-clock would be the obvious thing to send and the wrong number
// to keep. A learner who opens the boarding, switches tabs, and comes
// back after lunch did not spend two hours choosing a study rhythm —
// but wall-clock says they did, and a handful of those is enough to
// move a mean into fiction and to make "which question stalls people"
// unanswerable. So hidden time is not counted, and what these events
// carry is time the screen was actually in front of someone.
//
// `performance.now()` rather than `Date.now()`: monotonic, so a clock
// correction or a DST jump mid-boarding cannot produce a negative lap.
//
// Deliberately NOT here: idle detection. A learner staring at a
// question IS spending time on it, and calling that idle would hide
// exactly the hesitation the funnel is trying to find.
const perf = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

const visible = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden'

/**
 * Start a stopwatch. Returns { read, lap, stop }:
 *   read() — engaged milliseconds so far, as a rounded integer
 *   lap()  — read(), then reset to zero (one question's dwell)
 *   stop() — detach the listener; a stopwatch that is never stopped
 *            keeps a listener alive for the life of the document
 */
export function stopwatch() {
  let banked = 0
  let since = visible() ? perf() : null

  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      if (since != null) { banked += perf() - since; since = null }
    } else if (since == null) {
      since = perf()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  const read = () => Math.round(banked + (since != null ? perf() - since : 0))

  return {
    read,
    lap() {
      const ms = read()
      banked = 0
      since = visible() ? perf() : null
      return ms
    },
    stop() {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    },
  }
}
