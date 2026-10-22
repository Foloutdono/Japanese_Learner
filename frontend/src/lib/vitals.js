// ── 速度 — how fast the app felt, measured by the browser (plan 218) ──
//
// app_open's boot_ms is the API's wait; this is the page's own: the
// largest paint (LCP), the slowest interaction (an INP approximation:
// the longest event duration seen), the layout shift (CLS, sent x1000
// as an integer) and the time to the document's first byte. Read from
// the browser's PerformanceObserver with no library -- web-vitals is
// small, but the four numbers are a page of code -- and sent ONCE per
// page load, on the first hide, with the route the page was loaded on.
// A browser that supports none of the entry types sends nothing.
//
// Since 2026-10-18 the two figures are measured as their thresholds
// are defined (web.dev's "poor": CLS over 0.25, INP over 500 ms), not
// in a way of our own that read every long page as poor:
//   cls  the worst SESSION WINDOW of shifts no input explains (shifts
//        under a second apart, five seconds at most), never the sum over
//        the page's life -- a first ride and its Today, three minutes on
//        one page, summed to 1.32 out of six small windows;
//   inp  the slowest INTERACTION (a tap, a click, a key: entries with an
//        interactionId, grouped), the 98th percentile once there are
//        fifty, never the longest event of any kind.
// Older rows are the old measure; the dashboards' window
// (09-fiabilite.sql) rolls past them.
import { routePattern } from './routePattern'
import { track } from './track'
import { beforeHide } from './pageHide'

let started = false
let sent = false
let route = null
const m = { ttfb: undefined }
const shifts = []
const interactions = new Map()
// Every largest-paint candidate's time, in order, and when the page was
// first hidden (Infinity while it has not been). See lcpOf.
const paints = []
let hiddenAt = Infinity

/**
 * The page's LCP as the learner saw it: the last largest-paint candidate
 * before the page was first hidden. A page loaded in a background tab is
 * hidden from the start (`hiddenAt` 0), so it has no LCP of its own; a
 * candidate after the page was hidden is a paint from its restore, not its
 * load. Without this, the dashboards read LCP in tens of minutes (the
 * trail of 2026-10-22: 2,763,078 ms on /learn).
 */
export function lcpOf(candidates, until) {
  let best
  for (const at of candidates) if (at <= until) best = Math.round(at)
  return best
}

/** The worst session window of `shifts` ({t, value}), in order. */
export function clsOf(list) {
  let best = 0
  let cur = 0
  let first = -Infinity
  let last = -Infinity
  for (const { t, value } of list) {
    if (t - last > 1000 || t - first > 5000) { cur = 0; first = t }
    cur += value
    last = t
    best = Math.max(best, cur)
  }
  return best
}

/** INP from each interaction's longest duration: the slowest, or the
 *  98th percentile once there are fifty (one skipped per fifty). */
export function inpOf(durations) {
  if (!durations.length) return undefined
  const sorted = [...durations].sort((a, b) => b - a)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 50))]
}

function observe(type, onEntry, opts = {}) {
  try {
    const po = new PerformanceObserver(list => list.getEntries().forEach(onEntry))
    po.observe({ type, buffered: true, ...opts })
  } catch { /* an entry type this browser does not have */ }
}

export function watchVitals() {
  if (started || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
  started = true
  route = routePattern(window.location.pathname)
  try {
    const [nav] = performance.getEntriesByType('navigation')
    if (nav) m.ttfb = Math.round(nav.responseStart)
  } catch { /* no navigation timing */ }
  if (document.visibilityState === 'hidden') hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Math.min(hiddenAt, performance.now())
  })
  observe('largest-contentful-paint', e => { paints.push(e.startTime) })
  observe('layout-shift', e => { if (!e.hadRecentInput) shifts.push({ t: e.startTime, value: e.value }) })
  observe('event', e => {
    if (!e.interactionId) return
    interactions.set(e.interactionId, Math.max(interactions.get(e.interactionId) ?? 0, Math.round(e.duration)))
  }, { durationThreshold: 16 })
  beforeHide(sendVitals)
}

function sendVitals() {
  if (sent || !route) return
  sent = true
  track('vitals', {
    route,
    lcp: lcpOf(paints, hiddenAt),
    inp: inpOf([...interactions.values()]),
    cls: Math.round(clsOf(shifts) * 1000),
    ttfb: m.ttfb,
  })
}
