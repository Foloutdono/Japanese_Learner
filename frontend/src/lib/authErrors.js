// ── 改札 — Supabase's refusals, said to a learner ─────────────────
// Every auth refusal reaches the app in one of two shapes: as a
// returned value (`{ code, message }` off supabase-js) when the call
// stayed inside this page, and as a URL (`error_code`,
// `error_description`) when the round trip left for Google and came
// back (lib/authRedirect.js). Both carry the same `code`, so both are
// named here, once — two tables would have been two screens
// disagreeing about what the same refusal means.
//
// Only the codes that actually happen get a sentence of their own.
// Anything else falls back to Supabase's own line: English-only and
// written for developers, but a fact rather than a shrug.
//
// `email_address_invalid` is the exception that made this file, and it
// is worth knowing why, because the sentence Supabase sends is not
// merely unfriendly — it is untrue. On the guest claim (lib/guest.js)
// the message quotes the address the mail was going OUT to, and for a
// guest that field is empty, so the learner is shown
//
//     Email address "" is invalid
//
// with their own address sitting filled in directly above it. The one
// thing they can act on is the only thing the sentence does not say.
//
// This module is imported by lib/authRedirect.js, which loads before
// lib/supabase.js builds the client. Nothing here may gain an import
// with a side effect, or that ordering breaks.
const NAMED = {
  // The provider round trip.
  identity_already_exists: t => t.oauthAlreadyLinked,
  manual_linking_disabled: t => t.oauthLinkingOff,
  // Putting an address on the pass.
  email_exists: t => t.claimEmailTaken,
  user_already_exists: t => t.claimEmailTaken,
  email_address_invalid: t => t.claimEmailUnreachable,
  email_address_not_authorized: t => t.claimEmailUnreachable,
  weak_password: t => t.claimWeakPassword,
  over_email_send_rate_limit: t => t.claimTooSoon,
  over_request_rate_limit: t => t.claimTooSoon,
}

// The empty quoted address, for a deployment that sends the sentence
// without a `code` beside it. Unmistakable, and the one message that
// must never reach a learner verbatim.
const EMPTY_ADDRESS = /^email address\s*""\s*is invalid/i

/**
 * The sentence for a learner, from whichever refusal shape arrived.
 *
 * `fallback` is what Supabase itself said — `error_description` off a
 * callback URL, `message` off a returned error. It is preferred to a
 * shrug for anything unnamed, and ignored for the codes above.
 */
export function authErrorMessage(err, t, fallback = null) {
  if (!err) return null
  const named = NAMED[err.code]
  if (named) return named(t)
  if (EMPTY_ADDRESS.test(err.message ?? '')) return t.claimEmailUnreachable
  return fallback || t.genericError
}
