// ── 入口 — where a learner came from (plan 313) ─────────────────────
// The boarding's last event says which door a new learner came in by,
// as one closed class (`boarding_done.source`, events.VALUES): the
// business plan's first question is which channel brings learners who
// stay, and nothing answered it.
//
// What is noted, on this device only, is the first arrival's `?src=`
// (the links the app's own posts carry: /?src=tiktok) and the HOST of
// the page that sent the visitor, never a path. The landing page notes
// it before it forwards anyone (landing/page.mjs, forwardScript), since
// /app is reached from there and its own referrer is always the site;
// the app notes it too, for a link straight into /app. The first note
// wins: a learner who came from TikTok and returned from Google came
// from TikTok. Only the class ever leaves the device.

export const ARRIVAL_KEY = 'tsuji.arrival'

export const SOURCES = ['tiktok', 'instagram', 'youtube', 'reddit', 'search', 'store', 'other', 'direct']

const SRC = { tiktok: 'tiktok', tt: 'tiktok', instagram: 'instagram', ig: 'instagram', youtube: 'youtube', yt: 'youtube', reddit: 'reddit' }

const HOSTS = [
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)(google|bing|duckduckgo|qwant|ecosia|yahoo|yandex|startpage|brave)\.[a-z.]+$/, 'search'],
]

// The app's own hosts: a visitor moving from the landing page to /app,
// or between two of our pages, arrived from nowhere new.
const OWN = /(^|\.)(tsuji\.app|vercel\.app|localhost)$/

const SRC_SHAPE = /^[a-z0-9_-]{1,20}$/

/** The class of a noted arrival: a known ?src= first, then the host. */
export function classify(note, native = false) {
  const src = typeof note?.src === 'string' ? note.src.toLowerCase() : null
  if (src && SRC[src]) return SRC[src]
  const ref = typeof note?.ref === 'string' ? note.ref.toLowerCase() : null
  if (ref) {
    for (const [pattern, source] of HOSTS) if (pattern.test(ref)) return source
    return 'other'
  }
  if (src) return 'other'
  return native ? 'store' : 'direct'
}

function read(storage) {
  try {
    const raw = storage.getItem(ARRIVAL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Note this arrival, unless one is noted already. `search` and
 * `referrer` are the page's own (location.search, document.referrer).
 */
export function noteArrival({ search = '', referrer = '', storage = globalThis.localStorage } = {}) {
  if (!storage || read(storage)) return
  let src = null
  try { src = new URLSearchParams(search).get('src')?.toLowerCase() ?? null } catch { /* no query */ }
  if (src && !SRC_SHAPE.test(src)) src = null
  let ref = null
  try { ref = referrer ? new URL(referrer).hostname : null } catch { /* not a URL */ }
  if (ref && OWN.test(ref)) ref = null
  if (!src && !ref) return
  try { storage.setItem(ARRIVAL_KEY, JSON.stringify({ src, ref })) } catch { /* private mode */ }
}

/** The class `boarding_done` carries. */
export function arrivalSource({ storage = globalThis.localStorage, native = false } = {}) {
  return classify(storage ? read(storage) : null, native)
}
