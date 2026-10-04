// ── 正面口 — Board pressed on the landing page ───────────────────
// The landing page (plan 167, frontend/landing/) is the site's `/`, and
// its Embarquer used to open `/app` bare: a visitor who had just chosen
// to board was met by the app's own Welcome, a second crossroads asking
// the same question. So the page's Board says what was pressed --
// `/app?board` -- and App mints the guest pass at once, with the
// boarding opening on its first question, the name. The Welcome stays
// the front door everywhere else (the native shells, a bare `/app`, a
// sign-out).
//
// Read once, before React mounts (main.jsx: StrictMode calls a state
// initialiser twice, and the second call would find the address already
// cleaned), and taken off the address, so a reload or a later sign-out
// is not read as a second press.
export const BOARD_PARAM = 'board'

const NONE = Object.freeze({ entry: null, back: '/' })

/**
 * What the landing page asked for on this load: `{ entry, back }`, where
 * `entry` is 'board' or null and `back` is the page to return to when
 * the learner backs out of the boarding's first question -- the landing
 * page they came from (its language included), else `/`.
 */
export function takeEntry(win = typeof window === 'undefined' ? null : window) {
  if (!win) return NONE
  let url
  try { url = new URL(win.location.href) } catch { return NONE }
  if (!url.searchParams.has(BOARD_PARAM)) return NONE
  url.searchParams.delete(BOARD_PARAM)
  try {
    win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash)
  } catch { /* a browser refusing replaceState: the marker stays, harmlessly */ }
  return { entry: 'board', back: pageBehind(win.document?.referrer, url.origin) }
}

// The landing page's addresses are `/` and one per other language
// (`/en`); anything else -- another site, an app route -- is no page to
// go back to.
const LANDING_PATH = /^\/([a-z]{2}\/?)?$/

function pageBehind(referrer, origin) {
  try {
    const from = new URL(referrer)
    if (from.origin === origin && LANDING_PATH.test(from.pathname)) return from.pathname
  } catch { /* no referrer, or not a URL */ }
  return '/'
}
