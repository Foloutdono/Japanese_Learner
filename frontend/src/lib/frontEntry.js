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

// Se connecter pressed on the landing page: `/app?signin`. Without it the
// link opened `/app` bare, and the visitor who had asked to sign in was
// met by the Welcome, a second poster with its own Se connecter, rather
// than by the sign-in form. App opens the sign-in at once instead, and
// its ‹ goes back to the page it came from.
export const SIGNIN_PARAM = 'signin'

const NONE = Object.freeze({ entry: null, back: '/' })

/**
 * What the landing page asked for on this load: `{ entry, back }`, where
 * `entry` is 'board', 'signin' or null and `back` is the page to return
 * to when the learner backs out of the first screen it opened -- the
 * landing page they came from (its language included), else `/`.
 */
export function takeEntry(win = typeof window === 'undefined' ? null : window) {
  if (!win) return NONE
  let url
  try { url = new URL(win.location.href) } catch { return NONE }
  const entry = url.searchParams.has(BOARD_PARAM) ? 'board'
    : url.searchParams.has(SIGNIN_PARAM) ? 'signin'
      : null
  if (!entry) return NONE
  url.searchParams.delete(BOARD_PARAM)
  url.searchParams.delete(SIGNIN_PARAM)
  try {
    win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash)
  } catch { /* a browser refusing replaceState: the marker stays, harmlessly */ }
  return { entry, back: pageBehind(win.document?.referrer, url.origin) }
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
