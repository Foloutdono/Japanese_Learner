// ── 故障 — the errors nobody reported (plan 215) ──────────────────────
//
// An uncaught exception or a rejected promise nobody handled is, for the
// learner, a button that did nothing or a screen that went blank, and
// until now it reached no one. This records THAT one happened and on
// which screen -- never its message and never its stack: either can
// quote what was on the screen or what was typed into it, which is the
// rule the whole trail exists to keep (backend/core/events.py).
//
// One row per (screen, kind) a minute, the way lib/apiTrail.js dedupes:
// an error thrown on every frame is one problem, not sixty rows.
import { routePattern } from './routePattern'
import { track } from './track'

const GAP_MS = 60_000
const last = new Map()

export function recordClientError(where, pathname = window.location.pathname) {
  const route = routePattern(pathname)
  if (!route) return
  const key = `${route}:${where}`
  const now = Date.now()
  if (now - (last.get(key) ?? -Infinity) < GAP_MS) return
  last.set(key, now)
  track('client_error', { route, where })
}

let watching = false

/** Wired once, from App.jsx beside watchApiFailures. */
export function watchClientErrors() {
  if (watching || typeof window === 'undefined') return
  watching = true
  window.addEventListener('error', event => {
    // A resource that failed to load (an <img>, a <script>) fires
    // `error` on its element, not as a script error; that is the
    // network's story, which lib/apiTrail.js already tells for the API.
    if (event?.target && event.target !== window) return
    recordClientError('error')
  })
  window.addEventListener('unhandledrejection', () => recordClientError('rejection'))
}

export function _reset() { last.clear() }
