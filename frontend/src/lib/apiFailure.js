// ── 足跡 — where a failed request is announced ──────────────────────
// lib/api.js says THAT a request failed; whoever registered here decides
// what to do about it (lib/apiTrail.js records it). A module of its own,
// rather than an export of api.js, so that the many tests which replace
// './api' wholesale with a factory still import an App that can register.
//
// Only what a learner cannot have caused is reported: a server error
// (5xx) or a request that never got an answer (status 0). A 4xx is the
// endpoint doing its job -- the fare gate's 402, a 401 the recovery in
// api.js mends -- and an aborted request is a screen that went away.
let listener = null

export function onApiFailure(fn) {
  listener = typeof fn === 'function' ? fn : null
}

export function reportApiFailure(path, status) {
  if (!listener) return
  try { listener({ path, status }) } catch { /* bookkeeping never breaks a request */ }
}
