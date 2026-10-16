// ── 速度 — how fast the app felt, measured by the browser (plan 215) ──
//
// app_open's boot_ms is the API's wait; this is the page's own: the
// largest paint (LCP), the slowest interaction (an INP approximation:
// the longest event duration seen), the layout shift (CLS, sent x1000
// as an integer) and the time to the document's first byte. Read from
// the browser's PerformanceObserver with no library -- web-vitals is
// small, but the four numbers are a page of code -- and sent ONCE per
// page load, on the first hide, with the route the page was loaded on.
// A browser that supports none of the entry types sends nothing.
import { routePattern } from './routePattern'
import { track } from './track'
import { beforeHide } from './pageHide'

let started = false
let sent = false
let route = null
const m = { lcp: undefined, inp: undefined, cls: 0, ttfb: undefined }

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
  observe('largest-contentful-paint', e => { m.lcp = Math.round(e.startTime) })
  observe('layout-shift', e => { if (!e.hadRecentInput) m.cls += e.value })
  observe('event', e => { m.inp = Math.max(m.inp ?? 0, Math.round(e.duration)) }, { durationThreshold: 40 })
  beforeHide(sendVitals)
}

function sendVitals() {
  if (sent || !route) return
  sent = true
  track('vitals', {
    route,
    lcp: m.lcp,
    inp: m.inp,
    cls: Math.round(m.cls * 1000),
    ttfb: m.ttfb,
  })
}
