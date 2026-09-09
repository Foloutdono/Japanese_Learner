// ── 改札 — what the round trip brought back ──────────────────────
// On the WEB, signing in (or linking) with Google leaves the page and
// comes back as a fresh load. When Supabase refused the exchange, the
// only trace of WHY is in the URL it sent us back to:
//
//   /#error=server_error
//    &error_code=identity_already_exists
//    &error_description=Identity+is+already+linked+to+another+user
//
// Nothing read it, so a refusal looked exactly like a tap that did
// nothing: away to Google, back to the same screen, not a word said.
// (In the shell this never happened — the WebView does not navigate,
// so lib/oauth.js reads the refusal in-process and hands it to the
// button. The web had no such moment, which is why "it works on my
// phone and not on my PC" was the shape of the bug.)
//
// Read and taken OFF the URL at IMPORT time, before lib/supabase.js
// constructs the client — that import is what guarantees the order.
// supabase-js reads the same URL in its own initialize(), and an error
// there makes it return early WITHOUT recovering the stored session;
// handing it a plain URL keeps that path normal. The success shapes
// (`#access_token=…`, `?code=…`) are never touched: those are its to
// read.

const ERROR_KEYS = ['error', 'error_code', 'error_description']

// Backing out at Google is an answer, not a fault — the shell already
// treats it as one (lib/oauth.js's `cancelled`), and the web says
// nothing rather than printing an error for a decision.
const CANCELLED = ['access_denied', 'user_cancelled', 'user_denied']

/**
 * The refusal on a callback URL, and the URL without it.
 *
 * Supabase puts these in the fragment on the implicit flow and in the
 * query on PKCE; both are read, so turning PKCE on (docs/oauth.md)
 * does not quietly blind this.
 *
 * -> null when the URL carries no refusal (the ordinary load).
 * -> { error, code, description, cleaned }
 */
export function parseAuthRedirect(href) {
  let url
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const read = key => url.searchParams.get(key) ?? hash.get(key)
  const error = read('error')
  const code = read('error_code')
  const description = read('error_description')
  if (!error && !code && !description) return null

  for (const key of ERROR_KEYS) {
    url.searchParams.delete(key)
    hash.delete(key)
  }
  const rest = hash.toString()
  url.hash = rest ? `#${rest}` : ''
  return { error, code, description, cleaned: url.toString() }
}

/** A learner who changed their mind at Google, rather than a failure. */
export function isCancellation(err) {
  if (!err) return false
  if (err.code) return CANCELLED.includes(err.code)
  return CANCELLED.includes(err.error ?? '')
}

/** The Google account is on somebody else's pass already. */
export function isAlreadyLinked(err) {
  return err?.code === 'identity_already_exists'
}

/**
 * The sentence for a learner. Supabase's own `error_description` is
 * the fallback: it is English-only and written for developers, but a
 * true sentence beats a shrug, and the two refusals that actually
 * happen are named above it.
 */
export function authRedirectMessage(err, t) {
  if (!err) return null
  if (isAlreadyLinked(err)) return t.oauthAlreadyLinked
  if (err.code === 'manual_linking_disabled') return t.oauthLinkingOff
  return err.description || t.genericError
}

// The capture, once, at import.
let refusal = null
try {
  const found = parseAuthRedirect(window.location.href)
  if (found) {
    window.history.replaceState(window.history.state, '', found.cleaned)
    refusal = isCancellation(found) ? null : found
  }
} catch { /* no window (the node lane), or a browser refusing replaceState */ }

/**
 * The refusal this page load came back with, or null.
 *
 * Idempotent on purpose, and read straight from a render: it is a fact
 * about THIS load, not a message queue. Every new attempt leaves the
 * page and returns as a new load, so there is nothing to clear — and a
 * reader that consumed it could not be a pure render, which is where
 * this belongs (an effect that setStates is neither pure nor allowed:
 * react-hooks/set-state-in-effect).
 */
export function authRedirectError() {
  return refusal
}
