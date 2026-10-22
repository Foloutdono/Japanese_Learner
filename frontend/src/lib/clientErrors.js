// ── 故障 — the errors nobody reported (plan 218) ──────────────────────
//
// An uncaught exception or a rejected promise nobody handled is, for the
// learner, a button that did nothing or a screen that went blank, and
// until now it reached no one. This records THAT one happened and on
// which screen -- never its message and never its stack: either can
// quote what was on the screen or what was typed into it, which is the
// rule the whole trail exists to keep (backend/core/events.py).
//
// One row per (screen, step, kind) a minute, the way lib/apiTrail.js
// dedupes: an error thrown on every frame is one problem, not sixty rows.
import { routePattern } from './routePattern'
import { track } from './track'

const GAP_MS = 60_000
const last = new Map()

// The step of the boarding or the first ride on screen, as their
// boarding_step / ride_step name it, or null. Those flows live on one
// route each, so the route alone could not say where a learner lost
// their boarding (2026-10-16: an error on `/` and the learner gone,
// with nothing to say which question had thrown). A step name the
// app wrote, closed in events.VALUES like every string the trail keeps.
let step = null

/** Set by hooks/useErrorStep.js while a flow's step is on screen. */
export function noteStep(name) {
  step = name ?? null
}

// The classes an error may be recorded as: the closed list
// VALUES.client_error.kind (lib/track.js). A thrown string or a plain
// object has no class, and is 'other'.
const KINDS = ['TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError', 'EvalError', 'Error']

/** The class name of a thrown value, from KINDS, or 'other'. Never the message. */
export function errorKind(thrown) {
  const name = thrown && typeof thrown === 'object' ? thrown.name : undefined
  return KINDS.includes(name) ? name : 'other'
}

export function recordClientError(where, pathname = window.location.pathname, kind = 'other') {
  const route = routePattern(pathname)
  if (!route) return
  const key = `${route}:${step ?? ''}:${where}`
  const now = Date.now()
  if (now - (last.get(key) ?? -Infinity) < GAP_MS) return
  last.set(key, now)
  track('client_error', step ? { route, step, where, kind } : { route, where, kind })
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
    recordClientError('error', undefined, errorKind(event.error))
  })
  window.addEventListener('unhandledrejection', event => recordClientError('rejection', undefined, errorKind(event.reason)))
}

export function _reset() { last.clear(); step = null }
